import * as vscode from 'vscode';

import type { GitWatcher } from '../providers/git-watcher';
import { getWorkspaceConfig } from '../extension';

/**
 * "Contox: End Session & Start New"
 *
 * Flushes pending capture events, closes the active session via the API,
 * and resets the buffer so the next activity starts a fresh session.
 */
export function registerEndSessionCommand(
  gitWatcher: GitWatcher,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.endSession', async () => {
    const config = getWorkspaceConfig();
    if (!config) {
      void vscode.window.showWarningMessage(
        'Contox: No project linked. Connect via dashboard first.',
      );
      return;
    }

    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Contox: Ending session…',
        cancellable: false,
      },
      async () => gitWatcher.endSession(),
    );

    if (result.closed) {
      const msg = result.newSessionId
        ? `Contox: Session closed — new session started.`
        : `Contox: Session closed. Next activity will start a new session.`;
      void vscode.window.showInformationMessage(msg);
    } else {
      void vscode.window.showWarningMessage(
        'Contox: No active session found, or failed to close it.',
      );
    }
  });
}
