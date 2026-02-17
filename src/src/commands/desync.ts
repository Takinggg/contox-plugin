import * as vscode from 'vscode';
import type { StatusBarManager } from '../providers/status-bar';
import type { SessionWatcher } from '../providers/session-watcher';
import type { GitWatcher } from '../providers/git-watcher';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Desync / Connect — Temporarily pause and resume sync without logging out
 *
 * - contox.desync: Flush pending events, stop all watchers, show disconnected
 * - contox.connect: Re-start watchers, re-sync brain, restore normal status
 *
 * State is persisted in workspaceState so it survives VS Code restarts.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const STATE_KEY = 'contox.desynced';

export function isDesynced(context: vscode.ExtensionContext): boolean {
  return context.workspaceState.get<boolean>(STATE_KEY, false);
}

export function registerDesyncCommand(
  statusBar: StatusBarManager,
  sessionWatcher: SessionWatcher,
  gitWatcher: GitWatcher,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.desync', async () => {
    // Flush any pending captured events before disconnecting
    await gitWatcher.flush();

    // Stop watchers
    sessionWatcher.stop();
    gitWatcher.stop();

    // Persist state
    await context.workspaceState.update(STATE_KEY, true);

    // Update status bar
    statusBar.setDisconnected();

    void vscode.window.showInformationMessage(
      'Contox: Sync paused. Capture and polling stopped.',
      'Reconnect',
    ).then((action) => {
      if (action === 'Reconnect') {
        void vscode.commands.executeCommand('contox.connect');
      }
    });
  });
}

export function registerConnectCommand(
  client: { getApiKey: () => Promise<string | null> },
  statusBar: StatusBarManager,
  sessionWatcher: SessionWatcher,
  gitWatcher: GitWatcher,
  context: vscode.ExtensionContext,
  getProjectId: () => string | null,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.connect', async () => {
    const projectId = getProjectId();
    if (!projectId) {
      void vscode.window.showWarningMessage(
        'Contox: No project configured. Run "Contox: Setup Wizard" first.',
      );
      return;
    }

    const key = await client.getApiKey();
    if (!key) {
      void vscode.window.showWarningMessage(
        'Contox: Not authenticated. Run "Contox: Login" first.',
      );
      return;
    }

    // Clear desynced state
    await context.workspaceState.update(STATE_KEY, false);

    // Restart watchers
    sessionWatcher.start(projectId);
    gitWatcher.start(projectId);

    // Re-sync brain
    statusBar.setSyncing();
    await vscode.commands.executeCommand('contox.sync');

    void vscode.window.showInformationMessage('Contox: Reconnected — sync resumed.');
  });
}
