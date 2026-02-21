# Contox: AI Context Memory

**Give your AI tools persistent memory across sessions.**

Contox captures your project's architecture, conventions, and decisions so all your AI assistants always have the right context. No more repeating yourself.

## Supported AI Tools

One extension, all your tools. Contox auto-configures MCP (Model Context Protocol) for:

| Tool | Config location |
|------|----------------|
| **Claude Code** | `.mcp.json` |
| **Cursor** | `.cursor/mcp.json` |
| **GitHub Copilot** | `.vscode/mcp.json` |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` |
| **Antigravity** | `~/.gemini/antigravity/mcp_config.json` |
| **Cline** | VS Code globalStorage |
| **Gemini CLI** | `~/.gemini/settings.json` |

All configs are written automatically when you connect. No manual editing needed.

## Features

### Automatic Context Capture
The extension watches your git commits and file saves, building a rich memory of your project over time. Every meaningful commit is enriched with AI-generated summaries.

### Smart Connect Flow
Click "Connect IDE" from the dashboard and the extension:
1. Checks if the extension is already installed and up-to-date
2. Detects if the IDE is already connected
3. Auto-creates an API key if needed
4. Deploys the MCP server binary
5. Configures all 7 AI tools at once
6. Starts capturing immediately

If something breaks, use "Reconnect" to re-verify and repair all configs.

### MCP Server (Bundled)
The extension bundles and auto-deploys an MCP server that exposes tools to your AI assistant:

| Tool | What it does |
|------|-------------|
| `contox_get_memory` | Load full project context at session start |
| `contox_save_session` | Save work into categorized sub-contexts |
| `contox_search` | Semantic search across project memory |
| `contox_ask` | Natural language questions about your project |
| `contox_context_pack` | Get focused context for the current task |
| `contox_scan` | Auto-extract architecture from codebase |
| `contox_git_digest` | Read git commits since last save |
| `contox_hygiene` | Clean up and organize memory |

### Genesis Scan
Auto-extract architecture, conventions, security patterns, and data flow from your codebase. Results feed directly into your project memory.

### Smart Context Injection
The extension auto-injects Contox instructions into all detected AI agent config files (`.cursorrules`, `.windsurfrules`, `.clinerules`, `.github/copilot-instructions.md`). MCP-capable agents get protocol instructions; non-MCP agents get file-based instructions. When available, a project brief from the brain summary is included.

### Active File Context
When you switch files, the extension searches your project memory for relevant items and writes a focused context file at `.contox/context.md`. Search uses composite scoring with file-overlap boosting for better relevance.

### Version Tracking
The dashboard detects your installed extension version and shows an update banner when a new version is available.

## Quick Start

1. **Sign up** at [contox.dev](https://contox.dev)
2. **Install this extension** in VS Code, Cursor, Windsurf, or Antigravity
3. **Click "Connect IDE"** from the dashboard -- it handles everything
4. Done. Your AI assistant now has persistent project memory.

## How It Works

```
You code normally
   |
Contox Extension captures git commits + file saves
   |
Events are signed (HMAC-SHA256) and sent to Contox API
   |
AI enrichment extracts architecture, conventions, decisions
   |
MCP server exposes memory to Claude, Cursor, Copilot, etc.
   |
Your AI assistant knows your project across sessions
```

## Commands

| Command | Description |
|---------|-------------|
| `Contox: Setup Wizard` | Guided setup with API key, team, project, and AI tool selection |
| `Contox: Load Memory` | Load project memory into the sidebar |
| `Contox: Sync Contexts` | Manually sync contexts |
| `Contox: End Session & Start New` | Close current session and start fresh |
| `Contox: Disconnect` | Pause sync without removing config |
| `Contox: Reconnect` | Resume sync |

## Requirements

- VS Code 1.85+ (or Cursor, Windsurf, Antigravity)
- Node.js 18+ (for MCP server)
- A free account at [contox.dev](https://contox.dev)

## Privacy & Data Collection

### What data is collected
- **Git commit metadata**: commit SHA, message, author name, timestamp, list of files changed
- **Code diffs**: truncated to max 3KB per commit (can be disabled in settings)
- **File save events**: file paths of saved files (no file contents)
- **Project metadata**: project name, workspace root path
- **Session data**: session start/end times, event counts, extension version

### What is NOT collected
- Full source code or file contents (only truncated diffs)
- Files matching exclude patterns: `.env`, `.key`, `.pem`, `.p12`, `.pfx`, `node_modules/`, `.git/`, `dist/`
- Any data from outside the connected workspace

### Purpose
Data is used to build a persistent project memory that AI tools can query via MCP. This includes generating context summaries, semantic search indexes, and session enrichment.

### Data sharing
- Data is transmitted to `contox.dev` over HTTPS
- Requests are signed with HMAC-SHA256 for tamper protection
- Data is accessible only to your team members (role-based access control)
- Data is **not** shared with third parties, sold, or used for advertising

### Storage & retention
- All data is stored in the **EU (Frankfurt region)** on Appwrite Cloud infrastructure
- Data is retained for the lifetime of your account
- You can delete sessions, contexts, or your entire project from the dashboard
- Account deletion removes all associated data

### User controls
- **`contox.capture.enabled`**: Disable all event capture (default: enabled)
- **`contox.capture.includeDiffs`**: Disable code diff capture (default: enabled)
- **`contox.capture.anonymizeDiffs`**: Strip code content, keep only file paths and stats (default: disabled)
- **`contox.capture.excludePatterns`**: Customize file exclusion patterns
- **`contox.autoEnrich`**: Disable automatic learning from commits (default: enabled)
- **`Contox: Disconnect`** command: Pause all sync without removing configuration

## Links

- [Website](https://contox.dev)
- [Documentation](https://contox.dev/docs)
- [GitHub](https://github.com/Takinggg/contox-plugin)
- [Report Issues](https://github.com/Takinggg/contox-plugin/issues)

## License

MIT
