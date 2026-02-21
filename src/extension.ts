import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { writeContoxRc } from './lib/contoxrc-crypto';

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
import { deployMcpServer, getMcpServerPath } from './lib/mcp-deployer';
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
  ) { }

  async handleUri(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const token = params.get('token');
    const teamId = params.get('teamId');
    const projectId = params.get('projectId');
    const projectName = params.get('projectName');

    if (uri.path === '/setup' && token) {
      await this.handleSetup(token, teamId, projectId, projectName);
    } else if (uri.path === '/reconnect') {
      await this.handleReconnect();
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

  /**
   * Handle /reconnect deep link — force re-verify and re-configure everything.
   * Uses existing workspace config + stored API key (no URL params needed).
   */
  private async handleReconnect(): Promise<void> {
    const config = getWorkspaceConfig();
    const apiKey = await this.client.getApiKey();

    if (!config || !apiKey) {
      void vscode.window.showWarningMessage(
        'Contox: Not configured yet. Use "Connect IDE" from the dashboard first.',
      );
      return;
    }

    const wsFolders = vscode.workspace.workspaceFolders;
    if (!wsFolders || wsFolders.length === 0) {
      void vscode.window.showWarningMessage('Contox: Open a workspace folder first.');
      return;
    }

    const rootPath = wsFolders[0]!.uri.fsPath;
    const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');

    // Ensure MCP server binary is deployed
    try {
      await this.mcpReady;
    } catch { /* already logged */ }

    // Fetch HMAC secret if missing
    let hmac = await this.context.secrets.get('contox-hmac-secret');
    if (!hmac) {
      try {
        const result = await this.client.getProjectHmacSecret(config.projectId);
        if (result.data?.hmacSecret) {
          hmac = result.data.hmacSecret;
          await this.context.secrets.store('contox-hmac-secret', hmac);
        }
      } catch { /* non-critical */ }
    }

    // Force re-configure ALL MCP configs
    try {
      configureAllMcp(apiKey, apiUrl, config.teamId, config.projectId, rootPath, hmac ?? undefined, this.context);
    } catch (err) {
      console.error('Contox: Reconnect MCP config failed:', err);
    }

    // Restart watchers
    this.sessionWatcher.start(config.projectId);
    this.gitWatcher.start(config.projectId);

    // Re-sync
    await vscode.commands.executeCommand('contox.sync', { silent: true });

    void vscode.window.showInformationMessage(
      `$(check) Contox: Reconnected to "${config.projectName}" — all MCP configs refreshed`,
    );
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

    // Write ~/.contoxrc for CLI auth (encrypted — matches CLI's AES-256-GCM scheme)
    try {
      const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
      writeContoxRc({
        apiKey: token,
        apiUrl,
        teamId,
        projectId,
        ...(hmacSecret ? { hmacSecret } : {}),
      });
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
 * MCP Health Check — verify configs match workspace, binary exists, keys match
 * ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Thoroughly verify MCP configuration.
 * Returns a reason string if reconfiguration is needed, or null if everything is OK.
 */
function checkMcpNeedsReconfigure(
  rootPath: string,
  config: ContoxWorkspaceConfig,
  apiKey: string,
  extensionContext: vscode.ExtensionContext,
): string | null {
  const mcpConfigPath = path.join(rootPath, '.mcp.json');

  // 1. Check if .mcp.json exists and has contox entry
  let parsed: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return 'mcp_config_missing';
  }

  const servers = parsed['mcpServers'] as Record<string, unknown> | undefined;
  const contox = servers?.['contox'] as Record<string, unknown> | undefined;
  if (!contox) {
    return 'contox_server_missing';
  }

  // 2. Check if MCP server binary exists at the configured path
  const args = contox['args'] as string[] | undefined;
  const configuredPath = args?.[0];
  if (!configuredPath) {
    return 'no_server_path';
  }

  // Old relative path format → needs update
  if (configuredPath.includes('packages/mcp-server')) {
    return 'old_path_format';
  }

  // Binary doesn't exist → needs redeploy + reconfig
  if (!fs.existsSync(configuredPath)) {
    return 'binary_missing';
  }

  // 3. Check the expected path matches current extension's globalStorage
  const expectedPath = getMcpServerPath(extensionContext);
  if (path.normalize(configuredPath) !== path.normalize(expectedPath)) {
    return 'path_mismatch';
  }

  // 4. Check env vars match workspace config
  const env = contox['env'] as Record<string, string> | undefined;
  if (!env) {
    return 'no_env';
  }

  if (env['CONTOX_API_KEY'] !== apiKey) {
    return 'api_key_mismatch';
  }
  if (env['CONTOX_TEAM_ID'] !== config.teamId) {
    return 'team_id_mismatch';
  }
  if (env['CONTOX_PROJECT_ID'] !== config.projectId) {
    return 'project_id_mismatch';
  }

  return null; // All good
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Extension lifecycle
 * ═══════════════════════════════════════════════════════════════════════════════ */

export function activate(context: vscode.ExtensionContext): void {
  // Deploy MCP server to globalStorage (fire-and-forget, awaited before setup/deep link)
  const mcpReady = deployMcpServer(context).catch((err) => {
    console.error('Contox: Failed to deploy MCP server:', err);
  });

  const outputChannel = vscode.window.createOutputChannel('Contox');
  context.subscriptions.push(outputChannel);

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
    registerInitCommand(client, context),
    registerSyncCommand(client, treeProvider, statusBar, outputChannel),
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
      // Already configured — auto-sync (silent: no error toast) + load memory
      await vscode.commands.executeCommand('contox.sync', { silent: true });
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

      // Verify MCP is properly configured for all AI tools
      const rootPath = wsFolders[0]!.uri.fsPath;
      const currentHmac = await context.secrets.get('contox-hmac-secret');

      if (key && config) {
        const needsReconfigure = checkMcpNeedsReconfigure(rootPath, config, key, context);
        if (needsReconfigure) {
          try {
            const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
            configureAllMcp(key, apiUrl, config.teamId, config.projectId, rootPath, currentHmac ?? undefined, context);
            console.log('Contox: MCP auto-configured for all AI tools (reason:', needsReconfigure, ')');
          } catch (err) {
            console.error('Contox: Failed to auto-configure MCP:', err);
          }
        }
      }
    } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      // Workspace open but not configured — show a subtle prompt
      const action = await vscode.window.showInformationMessage(
        'Contox: Set up AI memory for this project?',
        'Setup from Dashboard',
        'I Have a Key',
      );
      if (action === 'Setup from Dashboard') {
        const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
        void vscode.env.openExternal(vscode.Uri.parse(`${apiUrl}/dashboard/cli`));
      } else if (action === 'I Have a Key') {
        openSetupWizard(client, treeProvider, statusBar, context);
      }
    }
  })();
}

export function deactivate(): void {
  // Cleanup is handled by VS Code disposing subscriptions
}
