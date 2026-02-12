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
  ) {}

  async handleUri(uri: vscode.Uri): Promise<void> {
    const params = new URLSearchParams(uri.query);
    const token = params.get('token');
    const teamId = params.get('teamId');
    const projectId = params.get('projectId');
    const projectName = params.get('projectName');
    const hmacSecret = params.get('hmacSecret');

    if (uri.path === '/setup' && token) {
      await this.handleSetup(token, teamId, projectId, projectName, hmacSecret);
    }
  }

  private async handleSetup(
    token: string,
    teamId: string | null,
    projectId: string | null,
    projectName: string | null,
    hmacSecret: string | null,
  ): Promise<void> {
    // 1. Store the API key
    await this.client.setApiKey(token);

    // 2. Store per-project HMAC secret for capture signing
    if (hmacSecret) {
      await this.context.secrets.store('contox-hmac-secret', hmacSecret);
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

    // Store HMAC secret in SecretStorage (if provided via deep link)
    if (hmacSecret) {
      await this.context.secrets.store('contox-hmac-secret', hmacSecret);
    }

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
      fs.writeFileSync(rcPath, JSON.stringify(rcConfig, null, 2) + '\n', 'utf-8');
    } catch {
      // Non-critical
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
  const client = new ContoxClient(context.secrets);
  const treeProvider = new ContextTreeProvider(client);
  const statusBar = new StatusBarManager();
  const sessionWatcher = new SessionWatcher(client, statusBar);
  const gitWatcher = new GitWatcher(client, statusBar, context.secrets);
  sessionWatcher.setGitWatcher(gitWatcher);

  // Register the tree view in the activity-bar panel
  const treeView = vscode.window.createTreeView('contoxContexts', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  // Flag to skip auto-init when activated by a deep link (URI handler will handle setup)
  let handledByUri = false;

  // Register URI handler for deep links from dashboard
  const uriHandler = new ContoxUriHandler(client, treeProvider, statusBar, sessionWatcher, gitWatcher, context);
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
    vscode.commands.registerCommand('contox.flushCapture', () => {
      void gitWatcher.flush();
    }),
    treeView,
    statusBar,
    sessionWatcher,
    gitWatcher,
    vscode.window.registerUriHandler(uriHandler),
  );

  // Auto-open setup wizard if not configured, otherwise auto-sync + start watcher.
  // Small delay to let the URI handler run first when activated by onUri.
  void (async () => {
    await new Promise((r) => { setTimeout(r, 500); });
    if (handledByUri) { return; }

    const key = await client.getApiKey();
    const config = getWorkspaceConfig();

    const wsFolders = vscode.workspace.workspaceFolders;
    if (key && config && wsFolders && wsFolders.length > 0) {
      // Already configured — auto-sync + load memory + start watchers
      await vscode.commands.executeCommand('contox.sync');
      void loadMemorySilent(client, wsFolders[0]!.uri.fsPath, config.projectId);

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
