import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContoxClient, ContoxProject, ContoxTeam } from '../api/client';
import { ContextTreeProvider } from '../providers/context-tree';
import { StatusBarManager } from '../providers/status-bar';
import { getMcpServerPath } from '../lib/mcp-deployer';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Setup Wizard — Guided onboarding webview panel
 *
 * Step-by-step GUI that walks the user through:
 * 1. Welcome + API key login
 * 2. Select or create a team/org
 * 3. Select or create a project
 * 4. Choose AI tools (Claude, Cursor, Copilot, etc.) → auto-configure
 * 5. First scan → done
 * ═══════════════════════════════════════════════════════════════════════════════ */

let currentPanel: vscode.WebviewPanel | undefined;

export function registerSetupWizardCommand(
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.commands.registerCommand('contox.setup', () => {
    openSetupWizard(client, treeProvider, statusBar, context);
  });
}

export function openSetupWizard(
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
  context: vscode.ExtensionContext,
): void {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'contoxSetup',
    'Contox Setup',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  currentPanel.webview.html = getWebviewContent();

  // Handle messages from the webview
  currentPanel.webview.onDidReceiveMessage(
    async (message: WebviewMessage) => {
      await handleMessage(message, client, treeProvider, statusBar, currentPanel!, context);
    },
    undefined,
    context.subscriptions,
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  // Check if already logged in and send initial state
  void (async () => {
    const key = await client.getApiKey();
    if (key) {
      currentPanel?.webview.postMessage({ type: 'alreadyLoggedIn' });
    }
  })();
}

/* ── Message types ──────────────────────────────────────────────────────── */

interface WebviewMessage {
  type: string;
  apiKey?: string;
  teamId?: string;
  projectName?: string;
  projectId?: string;
  aiTools?: string[];
}

/* ── Message handler ────────────────────────────────────────────────────── */

async function handleMessage(
  message: WebviewMessage,
  client: ContoxClient,
  treeProvider: ContextTreeProvider,
  statusBar: StatusBarManager,
  panel: vscode.WebviewPanel,
  extensionContext: vscode.ExtensionContext,
): Promise<void> {
  const post = (msg: Record<string, unknown>): void => {
    void panel.webview.postMessage(msg);
  };

  switch (message.type) {
    case 'login': {
      if (!message.apiKey) {
        post({ type: 'loginResult', success: false, error: 'No API key provided' });
        return;
      }
      await client.setApiKey(message.apiKey);

      // Validate key
      const validation = await client.getContext('__ping__');
      if (validation.error === 'Unauthorized') {
        await client.clearApiKey();
        post({ type: 'loginResult', success: false, error: 'Invalid API key' });
        return;
      }

      post({ type: 'loginResult', success: true });
      break;
    }

    case 'loadTeams': {
      const teamsResult = await client.listTeams();
      if (teamsResult.error) {
        post({ type: 'teamsLoaded', success: false, error: teamsResult.error });
        return;
      }
      post({
        type: 'teamsLoaded',
        success: true,
        teams: (teamsResult.data ?? []).map((t: ContoxTeam) => ({
          id: t.id,
          name: t.name,
          members: t.members,
        })),
      });
      break;
    }

    case 'loadProjects': {
      if (!message.teamId) {
        post({ type: 'projectsLoaded', success: false, error: 'No team ID provided' });
        return;
      }
      const result = await client.listProjects(message.teamId);
      if (result.error) {
        post({ type: 'projectsLoaded', success: false, error: result.error });
        return;
      }
      post({
        type: 'projectsLoaded',
        success: true,
        projects: (result.data ?? []).map((p: ContoxProject) => ({
          id: p.id,
          name: p.name,
          contextsCount: p.contextsCount,
        })),
      });
      break;
    }

    case 'selectProject': {
      if (!message.teamId || !message.projectId || !message.projectName) { return; }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        post({ type: 'projectSelected', success: false, error: 'No workspace folder open' });
        return;
      }

      const rootPath = workspaceFolders[0]!.uri.fsPath;
      const configPath = path.join(rootPath, '.contox.json');
      const config = {
        teamId: message.teamId,
        projectId: message.projectId,
        projectName: message.projectName,
      };

      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

        // Fetch and store the per-project HMAC secret for auto-capture signing
        const hmacResult = await client.getProjectHmacSecret(message.projectId);
        if (hmacResult.data?.hmacSecret) {
          await extensionContext.secrets.store('contox-hmac-secret', hmacResult.data.hmacSecret);
        }

        post({ type: 'projectSelected', success: true });

        // Sync the sidebar with V2 brain
        statusBar.setSyncing();
        const brainResult = await client.getBrain(message.projectId);
        if (!brainResult.error && brainResult.data) {
          treeProvider.setTree(brainResult.data.tree, brainResult.data.itemsLoaded);
        }
        statusBar.setSynced();
      } catch (err) {
        post({ type: 'projectSelected', success: false, error: String(err) });
      }
      break;
    }

    case 'configureAI': {
      const tools = message.aiTools ?? [];
      const results: string[] = [];

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const rootPath = workspaceFolders?.[0]?.uri.fsPath ?? '';

      // Read existing .contox.json for teamId/projectId
      let teamId = '';
      let projectId = '';
      try {
        const raw = fs.readFileSync(path.join(rootPath, '.contox.json'), 'utf-8');
        const cfg = JSON.parse(raw) as Record<string, string>;
        teamId = cfg['teamId'] ?? '';
        projectId = cfg['projectId'] ?? '';
      } catch {
        // continue
      }

      const apiKey = await client.getApiKey() ?? '';
      const apiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');
      const hmacSecret = await extensionContext.secrets.get('contox-hmac-secret') ?? '';

      // Configure Claude (MCP server)
      if (tools.includes('claude')) {
        try {
          configureClaude(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
          results.push('Claude MCP server configured');
        } catch (err) {
          results.push(`Claude: ${String(err)}`);
        }
      }

      // Configure Cursor (MCP server)
      if (tools.includes('cursor')) {
        try {
          configureCursor(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
          results.push('Cursor MCP server configured');
        } catch (err) {
          results.push(`Cursor: ${String(err)}`);
        }
      }

      // Configure Copilot (MCP server via .vscode/mcp.json)
      if (tools.includes('copilot')) {
        try {
          configureCopilot(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
          results.push('Copilot MCP server configured');
        } catch (err) {
          results.push(`Copilot: ${String(err)}`);
        }
      }

      // Configure Windsurf (MCP server via global config)
      if (tools.includes('windsurf')) {
        try {
          configureWindsurf(apiKey, apiUrl, teamId, extensionContext);
          results.push('Windsurf MCP server configured');
        } catch (err) {
          results.push(`Windsurf: ${String(err)}`);
        }
      }

      // Configure Antigravity (MCP server via ~/.gemini/antigravity/mcp_config.json)
      if (tools.includes('antigravity')) {
        try {
          configureAntigravity(apiKey, apiUrl, teamId, projectId, extensionContext);
          results.push('Antigravity MCP server configured');
        } catch (err) {
          results.push(`Antigravity: ${String(err)}`);
        }
      }

      post({ type: 'aiConfigured', results });
      break;
    }

    case 'runScan': {
      // Run contox scan with API key passed via environment
      post({ type: 'scanStarted' });

      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          post({ type: 'scanResult', success: false, error: 'No workspace open' });
          return;
        }

        const scanApiKey = await client.getApiKey() ?? '';
        const scanApiUrl = vscode.workspace.getConfiguration('contox').get<string>('apiUrl', 'https://contox.dev');

        // Write ~/.contoxrc so the CLI can authenticate
        const contoxRcPath = path.join(os.homedir(), '.contoxrc');
        fs.writeFileSync(contoxRcPath, JSON.stringify({ apiKey: scanApiKey, apiUrl: scanApiUrl }, null, 2), 'utf-8');

        const terminal = vscode.window.createTerminal('Contox Scan');
        terminal.sendText('node packages/cli/dist/index.js scan');
        terminal.show();

        post({ type: 'scanResult', success: true });
      } catch (err) {
        post({ type: 'scanResult', success: false, error: String(err) });
      }
      break;
    }

    case 'finish': {
      panel.dispose();
      void vscode.window.showInformationMessage('Contox: Setup complete! Your AI now has persistent memory.');
      break;
    }
  }
}

/* ── AI Tool Configuration Helpers ──────────────────────────────────────── */

/**
 * Configure MCP for all AI tools at once. Called by the deep link handler.
 */
export function configureAllMcp(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId: string,
  rootPath: string,
  hmacSecret: string | undefined,
  extensionContext: vscode.ExtensionContext,
): void {
  configureClaude(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
  configureCursor(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
  configureCopilot(apiKey, apiUrl, teamId, projectId, rootPath, hmacSecret, extensionContext);
  configureWindsurf(apiKey, apiUrl, teamId, extensionContext);
  configureAntigravity(apiKey, apiUrl, teamId, projectId, extensionContext);
}

/* ── Internal helpers ──────────────────────────────────────────────────── */

function buildMcpEnv(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId?: string,
  hmacSecret?: string,
): Record<string, string> {
  const env: Record<string, string> = {
    CONTOX_API_KEY: apiKey,
    CONTOX_API_URL: apiUrl,
    CONTOX_TEAM_ID: teamId,
  };
  if (projectId) { env['CONTOX_PROJECT_ID'] = projectId; }
  if (hmacSecret) { env['CONTOX_HMAC_SECRET'] = hmacSecret; }
  return env;
}

/** Merge a contox MCP server into an existing config without overwriting other servers. */
function mergeServerConfig(
  configPath: string,
  serverKey: string,
  serverConfig: Record<string, unknown>,
  serversField: string = 'mcpServers',
): void {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    // File doesn't exist or invalid JSON — start fresh
  }

  const existingServers = (existing[serversField] ?? {}) as Record<string, unknown>;
  const merged = {
    ...existing,
    [serversField]: { ...existingServers, [serverKey]: serverConfig },
  };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');
}

function configureClaude(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId: string,
  rootPath: string,
  hmacSecret: string | undefined,
  extensionContext: vscode.ExtensionContext,
): void {
  const mcpServerPath = getMcpServerPath(extensionContext);
  const env = buildMcpEnv(apiKey, apiUrl, teamId, projectId, hmacSecret);

  mergeServerConfig(
    path.join(rootPath, '.mcp.json'),
    'contox',
    { command: 'node', args: [mcpServerPath], env },
  );
}

function configureCursor(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId: string,
  rootPath: string,
  hmacSecret: string | undefined,
  extensionContext: vscode.ExtensionContext,
): void {
  const cursorDir = path.join(rootPath, '.cursor');
  if (!fs.existsSync(cursorDir)) { fs.mkdirSync(cursorDir, { recursive: true }); }

  const mcpServerPath = getMcpServerPath(extensionContext);
  const env = buildMcpEnv(apiKey, apiUrl, teamId, projectId, hmacSecret);

  mergeServerConfig(
    path.join(cursorDir, 'mcp.json'),
    'contox',
    { command: 'node', args: [mcpServerPath], env },
  );
}

function configureCopilot(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId: string,
  rootPath: string,
  hmacSecret: string | undefined,
  extensionContext: vscode.ExtensionContext,
): void {
  const vscodeDir = path.join(rootPath, '.vscode');
  if (!fs.existsSync(vscodeDir)) { fs.mkdirSync(vscodeDir, { recursive: true }); }

  const mcpServerPath = getMcpServerPath(extensionContext);
  const env = buildMcpEnv(apiKey, apiUrl, teamId, projectId, hmacSecret);

  // VS Code Copilot uses "servers" key (not "mcpServers") and requires type: 'stdio'
  mergeServerConfig(
    path.join(vscodeDir, 'mcp.json'),
    'contox',
    { type: 'stdio', command: 'node', args: [mcpServerPath], env },
    'servers',
  );
}

function configureWindsurf(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  extensionContext: vscode.ExtensionContext,
): void {
  // Windsurf uses a global config — no CONTOX_PROJECT_ID (resolved from .contox.json in cwd)
  const windsurfDir = path.join(os.homedir(), '.codeium', 'windsurf');
  if (!fs.existsSync(windsurfDir)) { fs.mkdirSync(windsurfDir, { recursive: true }); }

  const mcpServerPath = getMcpServerPath(extensionContext);
  const env = buildMcpEnv(apiKey, apiUrl, teamId);

  mergeServerConfig(
    path.join(windsurfDir, 'mcp_config.json'),
    'contox',
    { command: 'node', args: [mcpServerPath], env },
  );
}

function configureAntigravity(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  projectId: string,
  extensionContext: vscode.ExtensionContext,
): void {
  // Antigravity uses a global config at ~/.gemini/antigravity/mcp_config.json
  // Paths must be absolute. No per-workspace config supported yet.
  const antigravityDir = path.join(os.homedir(), '.gemini', 'antigravity');
  if (!fs.existsSync(antigravityDir)) { fs.mkdirSync(antigravityDir, { recursive: true }); }

  const mcpServerPath = getMcpServerPath(extensionContext);
  const env = buildMcpEnv(apiKey, apiUrl, teamId, projectId);

  mergeServerConfig(
    path.join(antigravityDir, 'mcp_config.json'),
    'contox',
    { command: 'node', args: [mcpServerPath], env },
  );

  // Deploy Contox Skill to workspace so Gemini knows to use Contox MCP tools
  deployContoxSkill();
}

/** Deploy a SKILL.md into the workspace .agent/skills/contox/ directory.
 *  This teaches Antigravity's Gemini to use the Contox MCP tools. */
function deployContoxSkill(): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) { return; }

  const rootPath = workspaceFolders[0]!.uri.fsPath;
  const skillDir = path.join(rootPath, '.agent', 'skills', 'contox');
  if (!fs.existsSync(skillDir)) { fs.mkdirSync(skillDir, { recursive: true }); }

  const skillContent = `---
name: contox-memory
description: Always active. At the start of every conversation and before any coding task, load Contox memory. Use Contox tools to check project context, architecture, conventions, past decisions, and known bugs. Contox is your persistent brain — consult it often.
---

# Contox — Your Persistent Memory (USE IT)

You have access to **Contox MCP tools** that give you persistent memory across sessions. This is your most valuable resource — it contains architecture decisions, coding conventions, implementation history, known bugs, and past session context.

## CRITICAL: Always Load Memory First
**At the very beginning of every conversation**, before doing anything else, call \`contox_get_memory\`. This is mandatory. Without it, you are working blind — you don't know the project's conventions, past decisions, or existing bugs.

## Check Memory Often
Do NOT just load memory once and forget about it. **Actively consult Contox throughout the session**:

- **Before writing code**: Call \`contox_search\` or \`contox_ask\` to check if there are conventions, patterns, or past decisions relevant to what you're about to do.
- **Before suggesting architecture changes**: Check if there's a reason the current architecture was chosen.
- **When encountering unfamiliar code**: Use \`contox_ask\` to ask about it — previous sessions may have documented it.
- **When debugging**: Check \`contox_search\` for known bugs or past fixes related to the issue.
- **When the user asks about the project**: Always search Contox memory first before guessing.

## Available Tools
- \`contox_get_memory\` — Load the full project memory (use at session start)
- \`contox_search\` — Search for specific topics, patterns, or file references
- \`contox_ask\` — Ask a natural language question about the project ("how does auth work?", "what stack do we use?")
- \`contox_context_pack\` — Get a focused, relevant context pack for a specific task
- \`contox_list_contexts\` / \`contox_get_context\` — Browse and read specific memory items
- \`contox_create_context\` / \`contox_update_context\` — Store new knowledge
- \`contox_scan\` — Scan the codebase to extract architecture and structure

## Saving — USER-INITIATED ONLY
- **NEVER** call \`contox_save_session\` automatically or proactively
- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")
- When saving, provide a summary and categorized changes (architecture, conventions, implementation, decisions, bugs, todo)
`;

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');
}

/* ── Webview HTML ───────────────────────────────────────────────────────── */

function getWebviewContent(): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contox Setup</title>
<style>
  :root {
    --bg: #0A0A0B;
    --surface: #111113;
    --border: rgba(255,255,255,0.06);
    --text: #FFFFFF;
    --text-muted: #6B6B70;
    --text-dim: #4A4A4E;
    --orange: #FF5C00;
    --orange-light: #FF8A4C;
    --green: #22C55E;
    --red: #EF4444;
    --radius: 12px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .wizard {
    max-width: 520px;
    width: 100%;
  }

  .step { display: none; }
  .step.active { display: block; }

  .logo {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo h1 {
    font-size: 1.75rem;
    font-weight: 700;
    background: linear-gradient(135deg, var(--orange), var(--orange-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .logo p {
    color: var(--text-muted);
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .step-indicator {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-dim);
    transition: all 0.3s;
  }
  .step-dot.active {
    background: var(--orange);
    width: 24px;
    border-radius: 4px;
  }
  .step-dot.done { background: var(--green); }

  h2 {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  p.desc {
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 1.25rem;
    line-height: 1.5;
  }

  input[type="text"], input[type="password"] {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus {
    border-color: rgba(255,92,0,0.5);
    box-shadow: 0 0 0 2px rgba(255,92,0,0.15);
  }
  input::placeholder { color: var(--text-dim); }

  .input-group {
    margin-bottom: 1rem;
  }
  .input-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
    color: var(--text-muted);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1.5rem;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    width: 100%;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--orange), var(--orange-light));
    color: white;
    box-shadow: 0 0 20px rgba(255,92,0,0.3);
  }
  .btn-primary:hover {
    box-shadow: 0 0 30px rgba(255,92,0,0.5);
    transform: translateY(-1px);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: rgba(255,255,255,0.06);
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover { background: rgba(255,255,255,0.1); }

  .btn-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .btn-row .btn { flex: 1; }

  .error {
    color: var(--red);
    font-size: 0.8rem;
    margin-top: 0.5rem;
    display: none;
  }
  .error.show { display: block; }

  .success {
    color: var(--green);
    font-size: 0.85rem;
    text-align: center;
    padding: 0.5rem;
  }

  /* Project list */
  .project-list {
    max-height: 250px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .project-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .project-item:hover {
    background: rgba(255,92,0,0.05);
    border-color: rgba(255,92,0,0.3);
  }
  .project-item.selected {
    background: rgba(255,92,0,0.1);
    border-color: var(--orange);
  }
  .project-item .name { font-weight: 500; font-size: 0.9rem; }
  .project-item .meta { color: var(--text-dim); font-size: 0.75rem; }

  /* AI tool checkboxes */
  .ai-tools {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .ai-tool {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
  }
  .ai-tool:hover { background: rgba(255,255,255,0.03); }
  .ai-tool.checked {
    background: rgba(255,92,0,0.08);
    border-color: rgba(255,92,0,0.4);
  }

  .ai-tool input { display: none; }
  .ai-tool .checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--text-dim);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
  }
  .ai-tool.checked .checkbox {
    background: var(--orange);
    border-color: var(--orange);
  }
  .ai-tool.checked .checkbox::after {
    content: '\\2713';
    color: white;
    font-size: 12px;
    font-weight: bold;
  }
  .ai-tool .info .name { font-size: 0.85rem; font-weight: 500; }
  .ai-tool .info .desc { font-size: 0.7rem; color: var(--text-dim); }

  .config-results {
    margin-top: 1rem;
  }
  .config-results li {
    color: var(--green);
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
    list-style: none;
    padding-left: 1rem;
  }
  .config-results li::before {
    content: '\\2713 ';
    margin-left: -1rem;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .final-card {
    text-align: center;
    padding: 2rem;
  }
  .final-card .icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  .final-card h2 { margin-bottom: 0.75rem; }
  .final-card p { color: var(--text-muted); font-size: 0.85rem; line-height: 1.6; margin-bottom: 1.5rem; }

  .help-link {
    color: var(--orange);
    text-decoration: none;
    font-size: 0.8rem;
    margin-top: 1rem;
    display: block;
    text-align: center;
  }
</style>
</head>
<body>
<div class="wizard">
  <div class="logo">
    <h1>Contox</h1>
    <p>Persistent AI memory for your projects</p>
  </div>

  <div class="step-indicator">
    <div class="step-dot active" data-step="0"></div>
    <div class="step-dot" data-step="1"></div>
    <div class="step-dot" data-step="2"></div>
    <div class="step-dot" data-step="3"></div>
    <div class="step-dot" data-step="4"></div>
  </div>

  <!-- Step 0: Welcome + Login -->
  <div class="step active" data-step="0">
    <div class="card">
      <h2>Connect your account</h2>
      <p class="desc">Enter your API key from the Contox dashboard. You can find it at Settings &gt; API Keys.</p>
      <div class="input-group">
        <label>API Key</label>
        <input type="password" id="apiKey" placeholder="ctx_xxxxxxxxxxxxxxxx" />
      </div>
      <div class="error" id="loginError"></div>
      <button class="btn btn-primary" id="loginBtn" onclick="doLogin()">
        Connect
      </button>
    </div>
  </div>

  <!-- Step 1: Select Team -->
  <div class="step" data-step="1">
    <div class="card">
      <h2>Your organization</h2>
      <p class="desc">Select the organization you want to connect this workspace to.</p>
      <div class="project-list" id="teamList">
        <p style="color: var(--text-dim); text-align: center; padding: 2rem;"><span class="spinner"></span> Loading teams...</p>
      </div>
      <div class="error" id="teamError"></div>
      <button class="btn btn-primary" id="teamBtn" disabled onclick="confirmTeam()">
        Continue
      </button>
    </div>
  </div>

  <!-- Step 2: Select Project -->
  <div class="step" data-step="2">
    <div class="card">
      <h2>Select a project</h2>
      <p class="desc">Link this workspace to a Contox project. Your AI memory will be stored here.</p>
      <div class="project-list" id="projectList">
        <p style="color: var(--text-dim); text-align: center; padding: 2rem;">Loading projects...</p>
      </div>
      <div class="error" id="projectError"></div>
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="goStep(1)">Back</button>
        <button class="btn btn-primary" id="selectProjectBtn" disabled onclick="selectProject()">
          Link project
        </button>
      </div>
    </div>
  </div>

  <!-- Step 3: AI Tools -->
  <div class="step" data-step="3">
    <div class="card">
      <h2>Configure your AI tools</h2>
      <p class="desc">Select which AI coding tools you use. We'll auto-configure each one to use Contox memory.</p>
      <div class="ai-tools">
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="claude" checked />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Claude Code</div>
            <div class="desc">.mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="cursor" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Cursor</div>
            <div class="desc">.cursor/mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="copilot" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">GitHub Copilot</div>
            <div class="desc">.vscode/mcp.json</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="windsurf" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Windsurf</div>
            <div class="desc">global MCP config</div>
          </div>
        </label>
        <label class="ai-tool" onclick="toggleTool(this)">
          <input type="checkbox" value="antigravity" />
          <div class="checkbox"></div>
          <div class="info">
            <div class="name">Antigravity</div>
            <div class="desc">~/.gemini/antigravity/</div>
          </div>
        </label>
      </div>
      <ul class="config-results" id="configResults"></ul>
      <button class="btn btn-primary" id="configBtn" onclick="configureAI()">
        Configure selected tools
      </button>
    </div>
  </div>

  <!-- Step 4: Done -->
  <div class="step" data-step="4">
    <div class="card final-card">
      <div class="icon">&#x1f680;</div>
      <h2>You're all set!</h2>
      <p>
        Your AI now has persistent memory.<br>
        It will remember everything across sessions.<br><br>
        <strong>How it works:</strong><br>
        Session start: AI loads context automatically<br>
        Session end: AI saves what was done
      </p>
      <button class="btn btn-primary" onclick="runScan()">
        Run first scan
      </button>
      <div style="margin-top: 0.75rem;">
        <button class="btn btn-secondary" onclick="finish()">
          Skip &amp; finish
        </button>
      </div>
    </div>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();
  let currentStep = 0;
  let selectedTeamId = null;
  let selectedTeamName = null;
  let selectedProjectId = null;
  let selectedProjectName = null;

  function goStep(n) {
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.querySelector('.step[data-step="' + n + '"]').classList.add('active');

    document.querySelectorAll('.step-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < n) dot.classList.add('done');
      if (i === n) dot.classList.add('active');
    });

    currentStep = n;
  }

  function doLogin() {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) return;

    const btn = document.getElementById('loginBtn');
    btn.innerHTML = '<span class="spinner"></span> Connecting...';
    btn.disabled = true;
    document.getElementById('loginError').classList.remove('show');

    vscode.postMessage({ type: 'login', apiKey: key });
  }

  function loadTeams() {
    vscode.postMessage({ type: 'loadTeams' });
  }

  function pickTeam(el, id, name) {
    document.querySelectorAll('#teamList .project-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedTeamId = id;
    selectedTeamName = name;
    document.getElementById('teamBtn').disabled = false;
  }

  function confirmTeam() {
    if (!selectedTeamId) return;

    const btn = document.getElementById('teamBtn');
    btn.innerHTML = '<span class="spinner"></span> Loading projects...';
    btn.disabled = true;

    vscode.postMessage({ type: 'loadProjects', teamId: selectedTeamId });
  }

  function selectProject() {
    if (!selectedProjectId) return;

    const btn = document.getElementById('selectProjectBtn');
    btn.innerHTML = '<span class="spinner"></span> Linking...';
    btn.disabled = true;

    vscode.postMessage({
      type: 'selectProject',
      teamId: selectedTeamId,
      projectId: selectedProjectId,
      projectName: selectedProjectName,
    });
  }

  function toggleTool(el) {
    const input = el.querySelector('input');
    input.checked = !input.checked;
    el.classList.toggle('checked', input.checked);
  }

  function configureAI() {
    const tools = [];
    document.querySelectorAll('.ai-tool input:checked').forEach(input => {
      tools.push(input.value);
    });

    if (tools.length === 0) {
      goStep(4);
      return;
    }

    const btn = document.getElementById('configBtn');
    btn.innerHTML = '<span class="spinner"></span> Configuring...';
    btn.disabled = true;

    vscode.postMessage({ type: 'configureAI', aiTools: tools });
  }

  function runScan() {
    vscode.postMessage({ type: 'runScan' });
    finish();
  }

  function finish() {
    vscode.postMessage({ type: 'finish' });
  }

  // Initialize checked state visual
  document.querySelectorAll('.ai-tool').forEach(el => {
    const input = el.querySelector('input');
    if (input.checked) el.classList.add('checked');
  });

  // Handle messages from the extension
  window.addEventListener('message', event => {
    const msg = event.data;

    switch (msg.type) {
      case 'alreadyLoggedIn':
        goStep(1);
        loadTeams();
        break;

      case 'loginResult':
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        if (msg.success) {
          loginBtn.innerHTML = '&#x2713; Connected';
          setTimeout(() => {
            goStep(1);
            loadTeams();
          }, 500);
        } else {
          loginBtn.innerHTML = 'Connect';
          const err = document.getElementById('loginError');
          err.textContent = msg.error || 'Login failed';
          err.classList.add('show');
        }
        break;

      case 'teamsLoaded': {
        const teamList = document.getElementById('teamList');
        if (msg.success) {
          const teams = msg.teams || [];
          if (teams.length === 0) {
            teamList.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 1rem;">No organizations found. Create one on the dashboard first.</p>';
          } else {
            teamList.innerHTML = teams.map(t =>
              '<div class="project-item" onclick="pickTeam(this, \\'' + t.id + '\\', \\'' + t.name.replace(/'/g, "\\\\'") + '\\')">' +
              '<div class="name">' + t.name + '</div>' +
              '<div class="meta">' + (t.members || 0) + ' members</div>' +
              '</div>'
            ).join('');
          }
        } else {
          teamList.innerHTML = '<p style="color: var(--red); text-align: center; padding: 1rem;">' + (msg.error || 'Failed to load teams') + '</p>';
        }
        break;
      }

      case 'projectsLoaded':
        const teamBtn = document.getElementById('teamBtn');
        teamBtn.disabled = false;
        teamBtn.innerHTML = 'Continue';

        if (msg.success) {
          const list = document.getElementById('projectList');
          const projects = msg.projects || [];

          if (projects.length === 0) {
            list.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 1rem;">No projects found. Create one on the dashboard first.</p>';
          } else {
            list.innerHTML = projects.map(p =>
              '<div class="project-item" onclick="pickProject(this, \\'' + p.id + '\\', \\'' + p.name.replace(/'/g, "\\\\'") + '\\')">' +
              '<div class="name">' + p.name + '</div>' +
              '<div class="meta">' + p.contextsCount + ' contexts</div>' +
              '</div>'
            ).join('');
          }
          goStep(2);
        } else {
          const err = document.getElementById('teamError');
          err.textContent = msg.error || 'Failed to load projects';
          err.classList.add('show');
        }
        break;

      case 'projectSelected':
        if (msg.success) {
          goStep(3);
        } else {
          const err = document.getElementById('projectError');
          err.textContent = msg.error || 'Failed';
          err.classList.add('show');
          const btn = document.getElementById('selectProjectBtn');
          btn.disabled = false;
          btn.innerHTML = 'Link project';
        }
        break;

      case 'aiConfigured':
        const configBtn = document.getElementById('configBtn');
        configBtn.disabled = false;
        configBtn.innerHTML = 'Configure selected tools';

        const results = document.getElementById('configResults');
        results.innerHTML = (msg.results || []).map(r => '<li>' + r + '</li>').join('');

        setTimeout(() => goStep(4), 1000);
        break;
    }
  });

  function pickProject(el, id, name) {
    document.querySelectorAll('.project-item').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedProjectId = id;
    selectedProjectName = name;
    document.getElementById('selectProjectBtn').disabled = false;
  }
</script>
</body>
</html>`;
}
