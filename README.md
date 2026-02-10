# Contox Plugin for Claude Code

Persistent AI project memory with Brain V5.3 — hierarchical knowledge tree, state machine, context links, entries timeline, compaction, and codebase scanning.

## What it does

This plugin gives Claude Code persistent memory for your projects:

- **Auto-loads context** at session start (architecture, conventions, past decisions)
- **Search** through stored knowledge during conversations
- **Save session work** automatically into categorized memory
- **Manage contexts** — create, update, delete project knowledge
- **Brain V5.3** — hierarchical tree, state machine (approve/deprecate), context links, entries compaction
- **Codebase scanning** — scan project files and push structured sub-contexts to your brain

## Installation

### From marketplace

```
/plugin marketplace add Takinggg/contox-plugin
/plugin install contox
```

### Local development

```bash
claude --plugin-dir ./packages/claude-plugin
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

The plugin provides 18 MCP tools:

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
| `contox_populate` | Batch-create/update contexts by schemaKey with content-hash dedup |
| `contox_add_entry` | Add an entry to a journal-like context (event-sourced) |
| `contox_get_tree` | Get hierarchical brain tree for the project |
| `contox_approve` | Approve or deprecate a context (state machine) |
| `contox_get_links` | Get links for a context by schemaKey |
| `contox_add_link` | Create a directed link between two contexts |
| `contox_compact` | Compact entries for a journal-like context |
| `contox_oncall_view` | Get on-call engineering view with alerts and runbooks |
| `contox_explain_schemakey` | Explain what a schemaKey path means in the brain tree |
| `contox_scan` | Scan local codebase and push hierarchical sub-contexts to the brain |

## Building

```bash
cd packages/claude-plugin
npm run build
```

This bundles the MCP server into a single self-contained `server/index.js` file (~360KB).
