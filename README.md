# Contox Plugin for Claude Code

Persistent AI project memory — give Claude context that survives across sessions.

## What it does

This plugin gives Claude Code persistent memory for your projects:

- **Auto-loads context** at session start (architecture, conventions, past decisions)
- **Search** through stored knowledge during conversations
- **Save session work** automatically into categorized memory
- **Manage contexts** — create, update, delete project knowledge

## Installation

### From marketplace

```
/plugin marketplace add Takinggg/contox-plugin
/plugin install contox
```

### Local development

```bash
claude --plugin-dir .
```

## Setup

Set these environment variables:

```bash
export CONTOX_API_KEY="ctx_your_api_key_here"
export CONTOX_TEAM_ID="your_team_id"
export CONTOX_PROJECT_ID="your_project_id"
```

Get your API key at [contox.dev/dashboard/keys](https://contox.dev/dashboard/keys).

## Slash Commands

| Command | Description |
|---------|-------------|
| `/contox:memory` | Load project memory from previous sessions |
| `/contox:save` | Save current session's work to persistent memory |
| `/contox:search <query>` | Search through all stored context content |
| `/contox:contexts` | List and manage project contexts |

## Auto-Invoke Skill

The plugin includes a **context-memory** skill that Claude uses automatically:
- Loads memory at the start of new sessions
- Searches context when it needs project-specific information
- Saves session work when asked

## MCP Tools

The plugin provides 8 MCP tools:

| Tool | Description |
|------|-------------|
| `contox_get_memory` | Load complete project memory |
| `contox_save_session` | Save session work into categorized sub-contexts |
| `contox_search` | Full-text search across all context content |
| `contox_list_contexts` | List all project contexts |
| `contox_get_context` | Get a specific context by ID |
| `contox_create_context` | Create a new context |
| `contox_update_context` | Update an existing context |
| `contox_delete_context` | Delete a context |

## Building (for contributors)

```bash
npm run build
```

This bundles the MCP server into a single self-contained `server/index.js` file (338KB).

## Links

- [Contox website](https://contox.dev)
- [Plugin documentation](https://contox.dev/plugins/claude-code)
- [Main repository](https://github.com/Takinggg/contox) (private)
