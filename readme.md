# Contox — AI Context Memory

Give your AI tools persistent memory across sessions. Contox captures your project's architecture, conventions, and decisions so Claude, Cursor, Copilot, and Windsurf always have the right context.

## What's in this repo

| Package | Description | Install |
|---------|-------------|---------|
| **VS Code Extension** | Auto-captures git events, deploys MCP server, configures all AI tools | [Marketplace](https://marketplace.visualstudio.com/items?itemName=contox.contox-vscode) |
| **contox-mcp** | Standalone MCP server for Claude, Cursor, Copilot, Windsurf | `npm install -g contox-mcp` |
| **contox-cli** | Terminal-based memory access and scanning | `npm install -g contox-cli` |

## Quick Start

1. **Sign up** at [contox.dev](https://contox.dev)
2. **Install the VS Code extension** from the marketplace (or `.vsix`)
3. **Connect** — the extension auto-configures MCP for all your AI tools
4. Your AI assistant now has persistent project memory

## How It Works

```
Your Code Editor
    ├── VS Code Extension (captures git events, file saves)
    │     └── MCP Server (bundled, auto-deployed)
    │           ├── Claude (.mcp.json)
    │           ├── Cursor (.cursor/mcp.json)
    │           ├── Copilot (.vscode/mcp.json)
    │           └── Windsurf (~/.codeium/windsurf/mcp_config.json)
    └── contox.dev API (stores contexts, embeddings, sessions)
```

## MCP Server Tools

The MCP server exposes these tools to your AI assistant:

| Tool | Description |
|------|-------------|
| `contox_get_memory` | Load project context at session start |
| `contox_save_session` | Save session work into categorized sub-contexts |
| `contox_search` | Semantic search across project memory |
| `contox_scan` | Auto-extract architecture from codebase |
| `contox_ask` | Natural language questions about your project |
| `contox_context_pack` | Get focused context for the current task |
| `contox_create/update/delete_context` | CRUD operations on contexts |
| `contox_git_digest` | Read git commits since last save |
| `contox_hygiene` | Clean up and organize memory |

## Development

```bash
# Extension
npm install
npm run build        # builds extension + MCP bundle

# MCP Server
cd packages/mcp-server
npm install && npm run build

# CLI
cd packages/cli
npm install && npm run build
```

## License

MIT
