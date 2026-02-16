# Contox MCP Server

Model Context Protocol (MCP) server that gives Claude persistent project memory. Connects to the Contox API to store, retrieve, and manage context across coding sessions.

## Setup

### 1. Install

```bash
cd packages/mcp-server
npm install
npm run build
```

### 2. Configure Claude

Add to your Claude Code MCP settings (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "contox": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "CONTOX_API_KEY": "your-api-key",
        "CONTOX_TEAM_ID": "your-team-id",
        "CONTOX_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

### 3. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTOX_API_KEY` | Yes | API key from dashboard |
| `CONTOX_TEAM_ID` | Yes | Team ID |
| `CONTOX_PROJECT_ID` | Yes | Project ID |
| `CONTOX_API_URL` | No | API base URL (defaults to production) |
| `CONTOX_HMAC_SECRET` | No | HMAC secret for V2 pipeline signing |

The server also reads `.contox.json` in the project root and can resolve project info from the git repo name.

## Tools Reference (21 tools)

### Memory Management

| Tool | Description |
|------|-------------|
| `contox_get_memory` | Load the complete brain document at session start |
| `contox_save_session` | Save session work into categorized sub-contexts (user-initiated only) |
| `contox_context_pack` | Build a focused, token-budgeted context pack for the current task |

### CRUD Operations

| Tool | Description |
|------|-------------|
| `contox_list_contexts` | List all contexts with metadata |
| `contox_get_context` | Get a context by ID with full content |
| `contox_create_context` | Create a new context manually |
| `contox_update_context` | Update name, description, or content (replaces, not appends) |
| `contox_delete_context` | Delete a context permanently |

### Brain Hierarchy

| Tool | Description |
|------|-------------|
| `contox_populate` | Batch-create/update contexts by schemaKey with audit trail |
| `contox_get_tree` | Get the hierarchical brain tree |
| `contox_approve` | Approve or deprecate a context (state machine: draft -> approved -> deprecated) |
| `contox_add_entry` | Add an idempotent entry to a journal-like context |
| `contox_compact` | Summarize all entries into a single content block |

### Knowledge Graph

| Tool | Description |
|------|-------------|
| `contox_get_links` | Get incoming/outgoing links for a context |
| `contox_add_link` | Create a directed link (see-also, depends-on, child-of, related) |

### Search & Discovery

| Tool | Description |
|------|-------------|
| `contox_search` | Semantic search across all context content via V2 embeddings |
| `contox_explain_schemakey` | Deep-dive into any brain schemaKey with metadata and links |
| `contox_oncall_view` | Operational summary: recent sessions, stale drafts, brain health |

### Codebase Integration

| Tool | Description |
|------|-------------|
| `contox_scan` | Walk filesystem and push ~15-20 hierarchical sub-contexts |
| `contox_git_digest` | Read git commits since last save for enrichment |

### Maintenance

| Tool | Description |
|------|-------------|
| `contox_hygiene` | Two-phase memory hygiene: analyze then apply (rename, merge, deprecate) |

## Architecture

```
src/
  index.ts           # MCP server entry — registers all 21 tools
  api/
    client.ts        # V1 REST API client (CRUD, populate, tree, links)
    v2-client.ts     # V2 pipeline client (ingest, search, brain, hygiene)
  lib/
    categories.ts    # Memory category definitions
    scanner.ts       # Filesystem scanner (routes, components, libs, hooks)
    context-builder.ts  # Builds sub-contexts from scan results
    context-pack.ts  # Assembles token-budgeted context packs
    claude-md.ts     # Updates CLAUDE.md with brain summary
    git-digest.ts    # Git commit reader with SHA-based range tracking
    oncall-view.ts   # Builds operational health summary
    explain-schema-key.ts  # SchemaKey deep-dive builder
    project-resolver.ts    # Resolves project from .contox.json / git / env
```

## Development

```bash
npm run dev    # Watch mode (tsc --watch)
npm run build  # Production build
```

## Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `zod`: Input validation for tool parameters
- `ulid`: Monotone-ordered IDs for journal entries
