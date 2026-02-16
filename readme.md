# Contox: AI Context Memory

**Give your AI tools persistent memory across sessions.**

Contox captures your project's architecture, conventions, and decisions so Claude, Cursor, Copilot, Windsurf, and Antigravity always have the right context. No more repeating yourself.

## Features

### Automatic Context Capture
The extension watches your git commits and file saves, building a rich memory of your project over time. No manual setup required.

### Works With All AI Tools
One extension configures MCP (Model Context Protocol) for all your AI assistants:
- **Claude** (Claude Code, Claude Desktop)
- **Cursor**
- **GitHub Copilot**
- **Windsurf**
- **Antigravity** (Google's AI IDE, with Skill integration for Gemini)

### Smart Memory System
- **Genesis Scan**: Auto-extract architecture, conventions, security patterns, and data flow from your codebase
- **Semantic Search**: Find anything in your project memory using natural language
- **Ask AI**: Ask questions about your project and get sourced answers
- **Session Tracking**: Automatic git commit enrichment with AI-generated summaries

### MCP Server (Bundled)
The extension bundles and auto-deploys an MCP server that exposes 15+ tools to your AI assistant:

| Tool | What it does |
|------|-------------|
| `contox_get_memory` | Load full project context at session start |
| `contox_save_session` | Save work into categorized sub-contexts |
| `contox_search` | Semantic search across project memory |
| `contox_scan` | Auto-extract architecture from codebase |
| `contox_ask` | Natural language questions about your project |
| `contox_context_pack` | Get focused context for the current task |
| `contox_git_digest` | Read git commits since last save |
| `contox_hygiene` | Clean up and organize memory |

## Quick Start

1. **Sign up** at [contox.dev](https://contox.dev)
2. **Install this extension**
3. **Click "Connect"** in the Contox sidebar, or use the deep link from your dashboard
4. Done. Your AI assistant now has persistent project memory.

## How It Works

```
Contox Extension
  ├── Captures git commits & file saves
  ├── Auto-deploys MCP server
  │     ├── Claude (.mcp.json)
  │     ├── Cursor (.cursor/mcp.json)
  │     ├── Copilot (.vscode/mcp.json)
  │     ├── Windsurf (~/.codeium/windsurf/mcp_config.json)
  │     └── Antigravity (~/.gemini/antigravity/mcp_config.json)
  ├── Deploys Antigravity Skill (.agent/skills/contox/)
  └── Syncs with contox.dev API
```

The MCP server is bundled inside the extension. No separate install needed. It's automatically deployed to a stable location and configured for all your AI tools.

## Commands

| Command | Description |
|---------|-------------|
| `Contox: Setup Wizard` | Configure API connection and AI tools |
| `Contox: Load Memory` | Load project memory into the sidebar |
| `Contox: Sync Contexts` | Manually sync contexts |
| `Contox: End Session & Start New` | Close current session and start fresh |
| `Contox: Disconnect` | Pause sync without removing config |
| `Contox: Reconnect` | Resume sync |

## Also Available

- **CLI**: `npm install -g contox-cli`. Terminal-based memory access.
- **MCP Server**: `npm install -g contox-mcp`. Standalone MCP server for non-VS Code setups.

## Requirements

- VS Code 1.85+ (or Cursor, Windsurf, Antigravity)
- Node.js 18+ (for MCP server)
- A free account at [contox.dev](https://contox.dev)

## Privacy & Data Collection

This extension collects and transmits the following data to the Contox API (`contox.dev`):

### What data is collected
- **Git commit metadata**: commit SHA, message, author name, timestamp, list of files changed
- **Code diffs**: truncated to max 2KB per commit (can be fully disabled or anonymized in settings)
- **File save events**: file paths of saved files (no file contents)
- **Project metadata**: project name, workspace root path
- **Session data**: session start/end times, event counts

### What is NOT collected
- Full source code or file contents (only truncated diffs)
- Files matching exclude patterns: `.env`, `.key`, `.pem`, `.p12`, `.pfx`, `node_modules/`, `.git/`, `dist/`
- Any data from outside the connected workspace

### Purpose
Data is used to build a persistent project memory that AI tools can query via MCP. This includes generating context summaries, semantic search indexes, and session enrichment.

### Data sharing
- Data is transmitted to `contox.dev` (Contox API) over HTTPS
- Requests are signed with HMAC-SHA256 for tamper protection
- Data is accessible only to your team members (role-based access control)
- Data is **not** shared with third parties, sold, or used for advertising

### Storage & retention
- All data is stored in the **EU (Frankfurt region)** on Appwrite Cloud infrastructure
- Data is retained for the lifetime of your account
- You can delete individual sessions, contexts, or your entire project at any time from the dashboard
- Account deletion removes all associated data

### User controls
- **`contox.capture.enabled`**: Disable all event capture (default: enabled)
- **`contox.capture.includeDiffs`**: Disable code diff capture (default: enabled)
- **`contox.capture.anonymizeDiffs`**: Strip code content, keep only file paths and stats (default: disabled)
- **`contox.capture.excludePatterns`**: Customize file exclusion patterns
- **`Contox: Disconnect`** command: Pause all sync without removing configuration

## Links

- [Website](https://contox.dev)
- [Documentation](https://contox.dev/docs)
- [GitHub](https://github.com/Takinggg/contox-plugin)
- [Report Issues](https://github.com/Takinggg/contox-plugin/issues)

## License

MIT
