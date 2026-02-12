import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { ContoxClient, ContoxProject } from '../api/client';

/**
 * "Contox: Initialize Project"
 *
 * Walks the user through selecting a project (from the API) and writes
 * a .contox.json config file in the workspace root so other commands
 * know which teamId / projectId to use.
 */
export function registerInitCommand(client: ContoxClient): vscode.Disposable {
  return vscode.commands.registerCommand('contox.init', async () => {
    // Must be authenticated
    const key = await client.getApiKey();
    if (!key) {
      void vscode.window.showWarningMessage('Contox: Not logged in. Run "Contox: Login" first.');
      return;
    }

    // Must have a workspace folder open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      void vscode.window.showErrorMessage('Contox: Open a workspace folder first.');
      return;
    }

    const rootPath = workspaceFolders[0]!.uri.fsPath;
    const configPath = path.join(rootPath, '.contox.json');

    // If already initialized, ask whether to reconfigure
    if (fs.existsSync(configPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        'Contox: This workspace is already initialized. Reconfigure?',
        'Yes',
        'No',
      );
      if (overwrite !== 'Yes') {
        return;
      }
    }

    // Ask for teamId — the user's organization ID
    const teamId = await vscode.window.showInputBox({
      prompt: 'Enter your Contox organization (team) ID',
      placeHolder: 'e.g. 6632a1…',
      ignoreFocusOut: true,
    });

    if (!teamId) {
      return;
    }

    // Fetch projects for that team
    const projectsResult = await client.listProjects(teamId);
    if (projectsResult.error) {
      void vscode.window.showErrorMessage(`Contox: ${projectsResult.error}`);
      return;
    }

    const projects = projectsResult.data ?? [];

    // Let the user pick an existing project or create a new one
    interface ProjectQuickPickItem extends vscode.QuickPickItem {
      project?: ContoxProject;
    }

    const items: ProjectQuickPickItem[] = [
      ...projects.map((p) => ({
        label: p.name,
        description: `${p.contextsCount} context${p.contextsCount === 1 ? '' : 's'}`,
        project: p,
      })),
      { label: '$(add) Create a new project...', description: '' },
    ];

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a project to link to this workspace',
      ignoreFocusOut: true,
    });

    if (!picked) {
      return;
    }

    let selectedProject: ContoxProject | undefined = picked.project;

    // Handle "create new project" flow — the user creates it on the web
    if (!selectedProject) {
      void vscode.window.showInformationMessage(
        'Create a new project on the Contox dashboard, then run "Contox: Initialize Project" again.',
      );
      return;
    }

    // Write .contox.json
    const config = {
      teamId,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    void vscode.window.showInformationMessage(
      `Contox: Linked workspace to project "${selectedProject.name}"`,
    );

    // Trigger a sync so the sidebar populates immediately
    await vscode.commands.executeCommand('contox.sync');
  });
}
