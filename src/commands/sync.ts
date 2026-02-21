import * as vscode from 'vscode';
import { ContoxClient } from '../api/client';
import { ContextTreeProvider } from '../providers/context-tree';
import { StatusBarManager } from '../providers/status-bar';
import { getWorkspaceConfig } from '../extension';

/** How many times auto-sync retries before giving up silently. */
const AUTO_SYNC_RETRIES = 2;
const RETRY_DELAY_MS = 3_000;

/**
 * "Contox: Sync Contexts"
 *
 * Fetches the V2 brain for the currently linked project (from .contox.json)
 * and refreshes the sidebar tree view.
 *
 * Accepts an optional `{ silent: true }` arg — when silent the command logs
 * to the output channel instead of showing toast errors (used by auto-sync
 * at activation).
 */
export function registerSyncCommand(
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
  outputChannel: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.sync', async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;

    const key = await client.getApiKey();
    if (!key) {
      if (!silent) {
        void vscode.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');
      }
      return;
    }

    const config = getWorkspaceConfig();
    if (!config) {
      if (!silent) {
        void vscode.window.showWarningMessage(
          'Contox: No project linked. Run "Contox: Initialize Project" first.',
        );
      }
      return;
    }

    statusBar.setSyncing();

    // Retry loop — helps when the extension host just started and DNS / TLS
    // isn't fully warmed up yet (common cause of "fetch failed" on Windows).
    const maxAttempts = silent ? AUTO_SYNC_RETRIES : 1;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await client.getBrain(config.projectId);

      if (!result.error) {
        const tree = result.data?.tree ?? [];
        const itemsLoaded = result.data?.itemsLoaded ?? 0;
        treeProvider.setTree(tree, itemsLoaded);
        statusBar.setSynced();
        if (!silent) {
          void vscode.window.showInformationMessage(
            `Contox: Loaded ${itemsLoaded} memory items from "${config.projectName}"`,
          );
        } else {
          outputChannel.appendLine(`[Sync] Loaded ${String(itemsLoaded)} items (attempt ${String(attempt)})`);
        }
        return;
      }

      lastError = result.error;
      outputChannel.appendLine(`[Sync] Attempt ${String(attempt)}/${String(maxAttempts)} failed: ${lastError}`);

      if (attempt < maxAttempts) {
        await new Promise((r) => { setTimeout(r, RETRY_DELAY_MS); });
      }
    }

    // All attempts exhausted
    statusBar.setError();
    if (!silent) {
      void vscode.window.showErrorMessage(`Contox sync failed: ${lastError}`);
    } else {
      outputChannel.appendLine(`[Sync] Gave up after ${String(maxAttempts)} attempts.`);
    }
  });
}
