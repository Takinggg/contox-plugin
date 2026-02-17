import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { ContoxClient } from './api/client';
import { ContextTreeProvider } from './providers/context-tree';
import { StatusBarManager } from './providers/status-bar';
import { SessionWatcher } from './providers/session-watcher';
import { GitWatcher } from './providers/git-watcher';
import { registerLoginCommand } from './commands/login';
import { registerInitCommand } from './commands/init';
import { registerSyncCommand } from './commands/sync';
import { registerCreateCommand } from './commands/create';
import { registerSetupWizardCommand, openSetupWizard } from './commands/setup-wizard';
import { registerResetCommand } from './commands/reset';
import { registerLoadMemoryCommand, loadMemorySilent } from './commands/load-memory';
import { registerEndSessionCommand } from './commands/end-session';
import { registerDesyncCommand, registerConnectCommand, isDesynced } from './commands/desync';
import { ContextInjector } from './providers/context-injector';
import { deployMcpServer } from './lib/mcp-deployer';
import { configureAllMcp } from './commands/setup-wizard';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Workspace configuration stored in .contox.json
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ContoxWorkspaceConfig {
  teamId: string;
  projectId: string;
  projectName: string;
}

/**
 * Read .contox.json from the first workspace folder.
 * Returns null when no workspace is open or the config is missing / invalid.
 */
export function getWorkspaceConfig(): ContoxWorkspaceConfig | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const rootPath = workspaceFolders[0]!.uri.fsPath;
  const configPath = path.join(rootPath, '.contox.json');

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const teamId = parsed['teamId'];
    const projectId = parsed['projectId'];
    const projectName = parsed['projectName'];

    if (typeof teamId === 'string' && typeof projectId === 'string') {
      return {
        teamId,
        projectId,
        projectName: typeof projectName === 'string' ? projectName : 'Unknown',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * URI Handler — Deep links from the Contox dashboard
 *
 * Handles: vscode://contox.contox-vscode/setup?token=xxx&teamId=xxx&projectId=xxx
 * Auto-configures the extension without manual setup.
 * ═══════════════════════════════════════════════════════════════════════════════ */

class ContoxUriHandler implements vscode.UriHandler {
  constructor(
    private readonly client: ContoxClient,
    private readonly treeProvider: ContextTreeProvider,
    private readonly statusBar: StatusBarManager,
    private readonly sessionWatcher: SessionWatcher,
    private readonly gitWatcher: GitWatcher,
    private readonly context: vscode.ExtensionContext,
    private readonly mcpReady: Promise<string | void>,
  ) {}

  async handleUri(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const token = params.get('token');
    const teamId = params.get('teamId');
    const projectId = params.get('projectId');
    const projectName = params.get('projectName');

    if (uri.path === '/setup' && token) {
      await this.handleSetup(token, teamId, projectId, projectName);
    } else if (uri.path === '/desync') {
      await vscode.commands.executeCommand('contox.desync');
    } else if (uri.path === '/connect') {
      await vscode.commands.executeCommand('contox.connect');
    }
  }

  private async handleSetup(
    token: string,
    teamId: string | null,
    projectId: string | null,
    projectName: string | null,
  ): Promise<void> {
    // 1. Store the API key
    await this.client.setApiKey(token);

    // 2. Fetch HMAC secret securely via API (not from deep link URL)
    let hmacSecret: string | null = null;
    if (projectId) {
      try {
        const result = await this.client.getProjectHmacSecret(projectId);
        if (result.data?.hmacSecret) {
          hmacSecret = result.data.hmacSecret;
          await this.context.secrets.store('contox-hmac-secret', hmacSecret);
        }
      } catch {
        console.warn('Contox: Failed to fetch HMAC secret — git capture will retry later');
      }
    }

    // 3. If projectId provided, auto-configure workspace
    if (teamId && projectId) {
      await this.autoConfigureProject(token, teamId, projectId, projectName ?? 'Project', hmacSecret);
    } else if (teamId) {
      // teamId only → show project picker
      await this.showProjectPicker(teamId);
    } else {
      // Token only → open setup wizard for project selection
      void vscode.window.showInformationMessage(
        '$(check) Contox: Authenticated! Choose a project to get started.',
        'Open Setup',
      ).then((action) => {
        if (action === 'Open Setup') {
          openSetupWizard(this.client, this.treeProvider, this.statusBar, this.context);
        }
      });
      return;
    }
  }

  private async autoConfigureProject(
    token: string,
    teamId: string,
    projectId: string,
    projectName: string,
    hmacSecret?: string | null,
  ): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      void vscode.window.showWarningMessage(
        'Contox: Open a workspace folder first, then try again.',
      );
      return;
    }

    // Write .contox.json
    const rootPath = workspaceFolders[0]!.uri.fsPath;
    const configPath = path.join(rootPath, '.contox.json');
    const config = { teamId, projectId, projectName };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    // Write ~/.contoxrc for CLI auth (includes hmacSecret for CLI V2 ingest)
    try {
      const rcPath = path.join(require('os').homedir(), '.contoxrc');
      const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
      const rcConfig: Record<string, string> = {
        apiKey: token,
        apiUrl,
        teamId,
        projectId,
      };
      if (hmacSecret) { rcConfig['hmacSecret'] = hmacSecret; }
      fs.writeFileSync(rcPath, JSON.stringify(rcConfig, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
    } catch {
      // Non-critical
    }

    // Configure MCP server for all AI tools (Claude, Cursor, Copilot, Windsurf)
    const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
    try {
      await this.mcpReady;
      configureAllMcp(token, apiUrl, teamId, projectId, rootPath, hmacSecret ?? undefined, this.context);
    } catch (err) {
      console.error('Contox: Failed to configure MCP:', err);
    }

    // Start watchers
    this.sessionWatcher.start(projectId);
    this.gitWatcher.start(projectId);

    // Sync contexts + load memory into .contox/memory.md + inject AI rules
    await vscode.commands.executeCommand('contox.sync');
    void loadMemorySilent(this.client, rootPath, projectId);

    void vscode.window.showInformationMessage(
      `$(check) Contox: Connected to "${projectName}" — memory loaded for all AI tools`,
    );
  }

  private async showProjectPicker(teamId: string): Promise<void> {
    const result = await this.client.listProjects(teamId);
    if (result.error || !result.data) {
      void vscode.window.showErrorMessage(`Contox: Failed to load projects — ${result.error ?? 'unknown error'}`);
      return;
    }

    const projects = result.data;
    if (projects.length === 0) {
      void vscode.window.showWarningMessage('Contox: No projects found for this team. Create one on the dashboard first.');
      return;
    }

    const pick = await vscode.window.showQuickPick(
      projects.map((p) => ({
        label: p.name,
        description: p.description ?? '',
        detail: `${p.contextsCount} contexts`,
        projectId: p.id,
      })),
      { placeHolder: 'Choose a project' },
    );

    if (pick) {
      const token = await this.client.getApiKey();
      if (token) {
        await this.autoConfigureProject(token, teamId, pick.projectId, pick.label, null);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Extension lifecycle
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function activate(context: vscode.ExtensionContext): void {
  // Deploy MCP server to globalStorage (fire-and-forget, awaited before setup/deep link)
  const mcpReady = deployMcpServer(context).catch((err) => {
    console.error('Contox: Failed to deploy MCP server:', err);
  });

  const client = new ContoxClient(context.secrets);
  const treeProvider = new ContextTreeProvider(client);
  const statusBar = new StatusBarManager();
  const sessionWatcher = new SessionWatcher(client, statusBar);
  const gitWatcher = new GitWatcher(client, statusBar, context.secrets);
  const contextInjector = new ContextInjector(client);
  sessionWatcher.setGitWatcher(gitWatcher);

  // Register the tree view in the activity-bar panel
  const treeView = vscode.window.createTreeView('contoxContexts', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  // Flag to skip auto-init when activated by a deep link (URI handler will handle setup)
  let handledByUri = false;

  // Register URI handler for deep links from dashboard
  const uriHandler = new ContoxUriHandler(client, treeProvider, statusBar, sessionWatcher, gitWatcher, context, mcpReady);
  const originalHandleUri = uriHandler.handleUri.bind(uriHandler);
  uriHandler.handleUri = async (uri: vscode.Uri): Promise<void> => {
    handledByUri = true;
    return originalHandleUri(uri);
  };

  // Register all commands
  context.subscriptions.push(
    registerLoginCommand(client),
    registerInitCommand(client),
    registerSyncCommand(client, treeProvider, statusBar),
    registerCreateCommand(client, treeProvider, statusBar),
    registerSetupWizardCommand(client, treeProvider, statusBar, context),
    registerResetCommand(client),
    registerLoadMemoryCommand(client),
    registerEndSessionCommand(gitWatcher),
    registerDesyncCommand(statusBar, sessionWatcher, gitWatcher, context),
    registerConnectCommand(client, statusBar, sessionWatcher, gitWatcher, context, () => {
      const cfg = getWorkspaceConfig();
      return cfg?.projectId ?? null;
    }),
    vscode.commands.registerCommand('contox.flushCapture', () => {
      void gitWatcher.flush();
    }),
    treeView,
    statusBar,
    sessionWatcher,
    gitWatcher,
    contextInjector,
    vscode.window.registerUriHandler(uriHandler),
  );

  // Auto-open setup wizard if not configured, otherwise auto-sync + start watcher.
  // Small delay to let the URI handler run first when activated by onUri.
  void (async () => {
    await Promise.all([
      new Promise((r) => { setTimeout(r, 500); }),
      mcpReady,
    ]);
    if (handledByUri) { return; }

    const key = await client.getApiKey();
    const config = getWorkspaceConfig();

    const wsFolders = vscode.workspace.workspaceFolders;
    if (key && config && wsFolders && wsFolders.length > 0) {
      // Already configured — auto-sync + load memory
      await vscode.commands.executeCommand('contox.sync');
      void loadMemorySilent(client, wsFolders[0]!.uri.fsPath, config.projectId);

      // If user previously desynced, stay disconnected
      if (isDesynced(context)) {
        statusBar.setDisconnected();
        return;
      }

      // Ensure HMAC secret is available before starting capture
      const hmac = await context.secrets.get('contox-hmac-secret');
      if (!hmac) {
        try {
          const hmacResult = await client.getProjectHmacSecret(config.projectId);
          if (hmacResult.data?.hmacSecret) {
            await context.secrets.store('contox-hmac-secret', hmacResult.data.hmacSecret);
          }
        } catch {
          // Non-critical — GitWatcher has its own fallback
        }
      }

      sessionWatcher.start(config.projectId);
      gitWatcher.start(config.projectId);
      contextInjector.start(config.projectId);

      // Check if MCP is configured for AI tools — prompt if not
      const rootPath = wsFolders[0]!.uri.fsPath;
      const mcpConfigPath = path.join(rootPath, '.mcp.json');
      let needsMcpSetup = true;
      try {
        const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const servers = parsed['mcpServers'] as Record<string, unknown> | undefined;
        const contox = servers?.['contox'] as Record<string, unknown> | undefined;
        const args = contox?.['args'] as string[] | undefined;
        // Already configured with globalStorage path (not old relative path)
        if (args?.[0] && !args[0].includes('packages/mcp-server')) {
          needsMcpSetup = false;
        }
      } catch {
        // .mcp.json doesn't exist or is invalid
      }

      if (needsMcpSetup) {
        const action = await vscode.window.showInformationMessage(
          'Contox: Configure MCP server for your AI tools (Claude, Cursor, Copilot, Windsurf)?',
          'Configure',
          'Later',
        );
        if (action === 'Configure') {
          openSetupWizard(client, treeProvider, statusBar, context);
        }
      }
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      // Workspace open but not configured — show a subtle prompt
      const action = await vscode.window.showInformationMessage(
        'Contox: Set up AI memory for this project?',
        'Setup',
        'Later',
      );
      if (action === 'Setup') {
        openSetupWizard(client, treeProvider, statusBar, context);
      }
    }
  })();
}

export function deactivate(): void {
  // Cleanup is handled by VS Code disposing subscriptions
}
