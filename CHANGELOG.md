# Changelog

## [1.1.3] — 2026-02-17

### Fixed
- **HMAC secret for Windsurf & Antigravity**: MCP server config now includes `CONTOX_HMAC_SECRET` for Windsurf and Antigravity — fixes `contox_save_session` failing with "V2_HMAC_SECRET is required for V2 ingest"

## [1.1.2] — 2026-02-17

### Fixed
- **Source validation**: Server now accepts `cursor`, `windsurf`, `antigravity` as valid sources (was rejecting with "Invalid option")
- **Session isolation**: Each IDE now gets its own session — VS Code, Cursor, Windsurf, and Antigravity no longer share sessions
- **Event loss prevention**: Pending events are now flushed before buffer reset when a session is closed externally (e.g. "Generate Memory")
- Sessions no longer auto-close after enrichment, preventing event loss during processing

## [1.1.1] — 2026-02-16

### Fixed
- Sessions now show the correct IDE source (Cursor, Windsurf, Antigravity) instead of always "VS Code"
- IDE detected automatically via `vscode.env.appName`

## [1.1.0] — 2026-02-16

### Added
- **Antigravity IDE support**: auto-configures MCP server at `~/.gemini/antigravity/mcp_config.json`
- **Antigravity Skill**: deploys `.agent/skills/contox/SKILL.md` to teach Gemini to use Contox memory proactively
- **Multi-IDE dashboard**: "Connect IDE" modal now lets you choose between VS Code, Cursor, Windsurf, and Antigravity
- Deep link support for Antigravity (`antigravity://` protocol)

### Changed
- Setup wizard now shows accurate MCP config paths for each tool
- Dashboard "Connect VS Code" replaced with "Connect IDE" supporting all 4 IDEs
- `configureAllMcp()` now configures all 5 AI tools (Claude, Cursor, Copilot, Windsurf, Antigravity)

## [1.0.1] - 2026-02-16

### Fixed
- Extension now activates on startup so first-time users see the setup prompt
- Previously, the extension only activated when `.contox.json` existed or via deep link

## [1.0.0] - 2026-02-16

### Added
- Dashboard with project and context management
- MCP server bundled and auto-deployed to globalStorage
- Auto-configure MCP for Claude, Cursor, Copilot & Windsurf
- AI-powered Genesis scan: auto-extract architecture, conventions, security & data flow
- Semantic search across project memory (Mistral embeddings)
- Ask AI: natural language questions about your codebase
- Session capture: automatic git commit tracking and enrichment
- Deep link onboarding: one-click setup from the dashboard
- Privacy controls: disable capture, anonymize diffs, custom exclude patterns
