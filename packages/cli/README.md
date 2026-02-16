# Contox CLI

Universal command-line interface for managing Contox AI contexts. Works with any AI tool: Claude, Cursor, Windsurf, GPT, and more.

## Installation

```bash
cd packages/cli
npm install
npm run build
```

The binary is available as `contox` after linking:

```bash
npm link
```

## Quick Start

```bash
# 1. Store your API key
contox login

# 2. Initialize a project
contox init

# 3. Load project memory
contox memory

# 4. Save session work
contox save "Added auth middleware and fixed login bug"

# 5. Scan codebase for automatic context
contox scan
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `contox login` | Store your Contox API key |
| `contox whoami` | Verify API key and show connection info |
| `contox init` | Initialize Contox for the current project directory |

### Memory (Core)

| Command | Description |
|---------|-------------|
| `contox memory` | Load the full project memory (use at session start) |
| `contox save <summary>` | Save session work into project memory (use at session end) |

**Memory options:**

```bash
contox memory                    # Print to stdout
contox memory --file out.md      # Write to file
contox memory --json             # Output as JSON

contox save "summary"            # Simple save
contox save --json '{"summary":"...", "changes":[...]}'  # Structured save
```

### Context Management

| Command | Description |
|---------|-------------|
| `contox push <files...>` | Push local files as contexts to Contox |
| `contox pull` | Pull contexts from Contox to local files |
| `contox scan` | Scan project and generate hierarchical AI contexts |
| `contox status` | Show status of contexts in the current project |

### Operational

| Command | Description |
|---------|-------------|
| `contox oncall` | View on-call summary (recent sessions, stale drafts, health) |
| `contox explain <schemaKey>` | Deep-dive into a brain schemaKey (metadata, content, links) |
| `contox context <task>` | Build a focused context pack for a task (V2) |
| `contox approve` | Flush daemon and show updated brain stats |

### Background Daemon

| Command | Description |
|---------|-------------|
| `contox daemon start` | Start the background daemon |
| `contox daemon stop` | Stop the running daemon |
| `contox daemon stats` | Show daemon statistics |
| `contox daemon flush` | Trigger immediate flush |

### Advanced

| Command | Description |
|---------|-------------|
| `contox collect` | Collect session evidence (file changes, commits, transcripts) and send to V2 |
| `contox export` | Export brain document for different AI tools |
| `contox hygiene` | Run memory hygiene agent (analyze + apply cleanup actions) |

## Architecture

```
src/
  index.ts              # Entry point — registers all commands via Commander.js
  commands/
    login.ts            # API key storage
    whoami.ts           # Connection verification
    init.ts             # Project initialization
    memory.ts           # Load brain document
    save.ts             # Save session work
    push.ts             # Upload local files
    pull.ts             # Download contexts
    scan.ts             # Filesystem scanner
    status.ts           # Context status
    oncall.ts           # Operational summary
    explain.ts          # SchemaKey deep-dive
    context-pack.ts     # Token-budgeted context pack
    approve.ts          # Context approval
    collect.ts          # Evidence collection
    export.ts           # Brain export
    hygiene.ts          # Memory cleanup
    daemon.ts           # Background daemon management
  lib/
    api.ts              # REST API client
    v2-api.ts           # V2 pipeline client
    config.ts           # Config file management (~/.contox)
    scanner.ts          # Filesystem walker (routes, components, hooks, stores)
    context-builder.ts  # Builds sub-contexts from scan results (~908 lines)
    transcript.ts       # Session transcript handling
    evidence-collector.ts  # File change + git evidence collection
    claude-md.ts        # CLAUDE.md file management
```

## Configuration

The CLI stores config in `~/.contox/`:

- `config.json`: API key, team ID, default project
- `.contox.json`: Per-project config (created by `contox init`)

## Dependencies

- `commander`: CLI framework
- `chalk`: Terminal colors

## Development

```bash
npm run dev    # Watch mode (tsup --watch)
npm run build  # Production build (tsup)
```
