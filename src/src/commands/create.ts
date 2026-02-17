import * as vscode from 'vscode';
import { ContoxClient } from '../api/client';
import { ContextTreeProvider } from '../providers/context-tree';
import { StatusBarManager } from '../providers/status-bar';
import { getWorkspaceConfig } from '../extension';

/**
 * "Contox: Create Context"
 *
 * Creates a new context inside the currently linked project.
 * Requires .contox.json with teamId and projectId.
 */
export function registerCreateCommand(
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.create', async () => {
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

    const name = await vscode.window.showInputBox({
      prompt: 'Context name',
      placeHolder: 'e.g. API Documentation',
      ignoreFocusOut: true,
    });

    if (!name) {
      return;
    }

    const description = await vscode.window.showInputBox({
      prompt: 'Description (optional)',
      placeHolder: 'e.g. REST API docs for the backend',
      ignoreFocusOut: true,
    });

    const result = await client.createContext(
      name,
      config.teamId,
      config.projectId,
      description || undefined,
    );

    if (result.error) {
      void vscode.window.showErrorMessage(`Contox: Failed to create context — ${result.error}`);
      return;
    }

    void vscode.window.showInformationMessage(`Contox: Created context "${name}"`);

    // Refresh the brain tree
    statusBar.setSyncing();
    const brainResult = await client.getBrain(config.projectId);
    if (!brainResult.error && brainResult.data) {
      treeProvider.setTree(brainResult.data.tree, brainResult.data.itemsLoaded);
    }
    statusBar.setSynced();
  });
}
