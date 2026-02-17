import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { ContoxClient } from '../api/client';
import { getWorkspaceConfig } from '../extension';
import { injectAllRuleFiles } from '../lib/inject-rules';

/**
 * "Contox: Load Memory"
 *
 * Fetches the compiled V2 brain document and writes it to .contox/memory.md.
 * Also injects Contox instructions into detected AI rule files so every
 * AI tool in the workspace automatically knows about the memory.
 */
export function registerLoadMemoryCommand(
  client: ContoxClient,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.loadMemory', async () => {
    const config = getWorkspaceConfig();
    if (!config) {
      void vscode.window.showWarningMessage(
        'Contox: No project linked. Connect via dashboard first.',
      );
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const rootPath = workspaceFolders[0]!.uri.fsPath;

    // 1. Fetch brain
    const result = await client.getBrain(config.projectId);
    if (result.error) {
      void vscode.window.showErrorMessage(`Contox: Failed to load memory — ${result.error}`);
      return;
    }

    const brain = result.data;
    if (!brain || !brain.document || brain.document.trim().length === 0) {
      void vscode.window.showInformationMessage('Contox: Memory is empty — nothing to load yet.');
      return;
    }

    // 2. Write .contox/memory.md
    const contoxDir = path.join(rootPath, '.contox');
    if (!fs.existsSync(contoxDir)) {
      fs.mkdirSync(contoxDir, { recursive: true });
    }

    const memoryPath = path.join(contoxDir, 'memory.md');
    fs.writeFileSync(memoryPath, brain.document, 'utf-8');

    // Ensure .contox is in .gitignore
    ensureGitignore(rootPath);

    // 3. Inject instructions into AI rule files
    const injected = injectAllRuleFiles(rootPath);

    // 4. Notify
    const injectedStr = injected.length > 0 ? ` → ${injected.join(', ')}` : '';
    void vscode.window.showInformationMessage(
      `Contox: Memory loaded (${String(brain.itemsLoaded)} items, ~${String(brain.tokenEstimate)} tokens)${injectedStr}`,
    );
  });
}

/**
 * Programmatic version (no notifications) for use after connect/sync.
 * Returns true on success.
 */
export async function loadMemorySilent(
  client: ContoxClient,
  rootPath: string,
  projectId: string,
): Promise<boolean> {
  try {
    const result = await client.getBrain(projectId);
    if (result.error || !result.data?.document) {
      return false;
    }

    const contoxDir = path.join(rootPath, '.contox');
    if (!fs.existsSync(contoxDir)) {
      fs.mkdirSync(contoxDir, { recursive: true });
    }

    fs.writeFileSync(path.join(contoxDir, 'memory.md'), result.data.document, 'utf-8');
    ensureGitignore(rootPath);
    injectAllRuleFiles(rootPath);
    return true;
  } catch {
    return false;
  }
}

/** Add .contox/ to .gitignore if not already present */
function ensureGitignore(rootPath: string): void {
  const gitignorePath = path.join(rootPath, '.gitignore');
  try {
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
    if (!content.includes('.contox/')) {
      const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(
        gitignorePath,
        content + separator + '\n# Contox local memory\n.contox/\n',
        'utf-8',
      );
    }
  } catch {
    // Non-critical
  }
}
