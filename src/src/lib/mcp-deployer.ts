import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const MCP_SERVER_FILENAME = 'mcp-server.cjs';
const VERSION_FILENAME = 'mcp-server.version';

/**
 * Deploy the bundled MCP server to globalStorageUri.
 *
 * The extension ships with dist/mcp-server.cjs alongside dist/extension.js.
 * On activation, this copies it to globalStorage if the version has changed.
 * globalStorage is per-extension (shared across all workspaces).
 *
 * Returns the absolute path to the deployed mcp-server.cjs.
 */
export async function deployMcpServer(
  context: vscode.ExtensionContext,
): Promise<string> {
  const extensionVersion = (context.extension.packageJSON as { version: string }).version;

  // Ensure globalStorage directory exists
  const globalStoragePath = context.globalStorageUri.fsPath;
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }

  const targetPath = path.join(globalStoragePath, MCP_SERVER_FILENAME);
  const versionPath = path.join(globalStoragePath, VERSION_FILENAME);

  if (shouldDeploy(targetPath, versionPath, extensionVersion)) {
    // Source: the MCP server bundled inside the extension package
    const sourcePath = path.join(
      context.extensionUri.fsPath,
      'dist',
      MCP_SERVER_FILENAME,
    );

    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `MCP server bundle not found at ${sourcePath}. ` +
        'The extension may not have been built correctly.',
      );
    }

    // Atomic-ish copy: write to .tmp then rename
    const tmpPath = targetPath + '.tmp';
    fs.copyFileSync(sourcePath, tmpPath);
    fs.renameSync(tmpPath, targetPath);

    // Write version marker
    fs.writeFileSync(versionPath, extensionVersion, 'utf-8');
  }

  return targetPath;
}

function shouldDeploy(
  targetPath: string,
  versionPath: string,
  extensionVersion: string,
): boolean {
  if (!fs.existsSync(targetPath)) {
    return true;
  }
  if (!fs.existsSync(versionPath)) {
    return true;
  }
  try {
    const deployedVersion = fs.readFileSync(versionPath, 'utf-8').trim();
    return deployedVersion !== extensionVersion;
  } catch {
    return true;
  }
}

/**
 * Get the absolute path where the MCP server is deployed.
 * Does NOT deploy — just returns the expected path.
 */
export function getMcpServerPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStorageUri.fsPath, MCP_SERVER_FILENAME);
}
