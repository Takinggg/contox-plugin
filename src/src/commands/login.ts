import * as vscode from 'vscode';
import { ContoxClient } from '../api/client';

/**
 * "Contox: Login"
 *
 * Prompts for an API key, stores it in VS Code's secret storage, and
 * validates it by making a lightweight API call.
 */
export function registerLoginCommand(client: ContoxClient): vscode.Disposable {
  return vscode.commands.registerCommand('contox.login', async () => {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your Contox API key',
      password: true,
      placeHolder: 'ctx_xxxxxxxxxxxxxxxx',
      ignoreFocusOut: true,
    });

    if (!key) {
      return;
    }

    await client.setApiKey(key);

    // Validate the key by fetching the user profile
    // We use getContext with a dummy id — a 401 means the key is bad.
    // Instead, try a lightweight call that requires auth.
    // The simplest check: call GET /api/contexts (returns [] when no projectId given
    // but still validates auth). However the /api/contexts GET requires userId auth.
    // Let's call getContext with a non-existent id — if we get 401 the key is invalid,
    // any other response (404, 500) means the key is valid.
    const validation = await client.getContext('__ping__');
    if (validation.error === 'Unauthorized' || validation.error === 'Not authenticated. Run "Contox: Login" first.') {
      await client.clearApiKey();
      void vscode.window.showErrorMessage('Contox: Invalid API key.');
      return;
    }

    void vscode.window.showInformationMessage('Contox: Logged in successfully');

    // If a project is already configured, kick off a sync
    await vscode.commands.executeCommand('contox.sync');
  });
}
