# Contox — AI Context Management for VS Code

Persistent AI memory for your projects. Contox keeps your AI tools (Claude, Cursor, Copilot, Windsurf) in sync with your codebase context across sessions.

## Features

- **Context Tree** — Browse all your project contexts in the sidebar
- **Auto-Sync** — Contexts sync automatically when the extension loads
- **Setup Wizard** — Guided onboarding with automatic team & project detection
- **AI Tool Integration** — Auto-configures Claude (MCP), Cursor, Copilot, and Windsurf
- **Reset / Logout** — Clear stored credentials and workspace config to start fresh

## Getting Started

1. Install the extension
2. Open a workspace — the setup wizard will prompt you
3. Enter your API key from [contox.dev](https://contox.dev)
4. Select your team and project
5. Choose which AI tools to configure

## Commands

| Command | Description |
|---------|-------------|
| `Contox: Setup Wizard` | Open the guided setup wizard |
| `Contox: Login` | Authenticate with your API key |
| `Contox: Sync Contexts` | Manually sync contexts |
| `Contox: Create Context` | Create a new context |
| `Contox: Initialize Project` | Link a workspace to a Contox project |
| `Contox: Reset / Logout` | Clear API key and workspace config |

## Requirements

- A [Contox](https://contox.dev) account (free tier available)
- An API key (generate from Dashboard > API Keys)

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `contox.apiUrl` | `https://contox.dev` | Contox API base URL |
| `contox.autoSync` | `true` | Auto-sync contexts on activation |

## Changelog

### v1.1.1
- Fixed scan authentication: extension now writes `~/.contoxrc` so the CLI can authenticate
- Changed to lazy activation (no longer activates on startup) to avoid interfering with other extensions
- CLI now supports `CONTOX_API_KEY` environment variable as fallback

### v1.1.0
- Added `Contox: Reset / Logout` command to clear stored credentials
- Setup wizard now auto-fetches teams instead of manual ID input
- Team selection UI with clickable list

### v1.0.0
- Initial release
