import * as vscode from 'vscode';
import { ContoxClient } from '../api/client';
import { ContextTreeProvider } from '../providers/context-tree';
import { StatusBarManager } from '../providers/status-bar';
import { getWorkspaceConfig } from '../extension';

/**
 * "Contox: Sync Contexts"
 *
 * Fetches the V2 brain for the currently linked project (from .contox.json)
 * and refreshes the sidebar tree view.
 */
export function registerSyncCommand(
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.sync', async () => {
    const key = await client.getApiKey();
    if (!key) {
      void vscode.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');
      return;
    }

    const config = getWorkspaceConfig();
    if (!config) {
      void vscode.window.showWarningMessage(
        'Contox: No project linked. Run "Contox: Initialize Project" first.',
      );
      return;
    }

    statusBar.setSyncing();

    const result = await client.getBrain(config.projectId);
    if (result.error) {
      statusBar.setError();
      void vscode.window.showErrorMessage(`Contox sync failed: ${result.error}`);
      return;
    }

    const tree = result.data?.tree ?? [];
    const itemsLoaded = result.data?.itemsLoaded ?? 0;
    treeProvider.setTree(tree, itemsLoaded);
    statusBar.setSynced();
    void vscode.window.showInformationMessage(
      `Contox: Loaded ${itemsLoaded} memory items from "${config.projectName}"`,
    );
  });
}
