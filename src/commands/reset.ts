import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { ContoxClient } from '../api/client';

/**
 * "Contox: Reset / Logout"
 *
 * Clears the stored API key from SecretStorage and removes .contox.json
 * from the workspace root. This allows the user to start fresh.
 */
export function registerResetCommand(client: ContoxClient): vscode.Disposable {
  return vscode.commands.registerCommand('contox.reset', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'Contox: This will log you out and remove the workspace configuration. Continue?',
      { modal: true },
      'Reset',
    );

    if (confirm !== 'Reset') {
      return;
    }

    // Clear API key from SecretStorage
    await client.clearApiKey();

    // Remove .contox.json from workspace root
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      const configPath = path.join(folders[0]!.uri.fsPath, '.contox.json');
      try {
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }
      } catch {
        // ignore
      }
    }

    void vscode.window.showInformationMessage('Contox: Reset complete. Run "Contox: Setup Wizard" to reconfigure.');
  });
}
