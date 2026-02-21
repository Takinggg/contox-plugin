# Changelog

## [1.1.8] — 2026-02-21

### Added
- **Extension version tracking**: the extension now reports its version to the Contox API on every ingest. The dashboard detects outdated versions and shows an update banner.
- **Smart Connect IDE flow**: the "Connect IDE" modal now checks connection status before connecting, detects if the extension is installed, and routes to the right step (install, reconnect, or fresh setup).
- **Install extension step**: if the extension was never configured, the modal guides the user to install it from the VS Code Marketplace or Open VSX (for Cursor, Windsurf, Antigravity).
- **Reconnect deep link**: `vscode://contox.contox-vscode/reconnect` force re-verifies and re-configures all MCP configs without needing a new deep link.
- **MCP health check**: on activation, the extension runs a 6-point verification (config exists, binary exists, path matches, API key matches, team/project ID matches) and auto-repairs if anything is off.
- **All tools shown in modal**: the "Ready" and "Already Connected" steps now list all 7 auto-configured AI tools (Claude Code, Cursor, Copilot, Windsurf, Antigravity, Cline, Gemini CLI).

### Changed
- Marketplace URLs for Cursor, Windsurf, and Antigravity now point to Open VSX instead of VS Code Marketplace.

## [1.1.7] — 2026-02-21

### Added
- **Cline MCP auto-config**: auto-configures MCP server in Cline's globalStorage settings
- **Gemini CLI MCP auto-config**: auto-configures MCP server at `~/.gemini/settings.json`
- **Silent MCP setup on activation**: MCP configs are written on every activation (no user prompt needed)

### Changed
- `configureAllMcp()` now configures 7 AI tools (was 5): added Cline and Gemini CLI

## [1.1.6] — 2026-02-20

### Fixed
- **Silent auto-sync**: sync no longer shows noisy error toasts on transient network failures
- **Retry with backoff**: failed ingest events are queued and retried with exponential backoff (up to 3 attempts)
- **Fetch error unwrapping**: Node/undici "fetch failed" errors now show the real cause instead of a generic message

### Added
- **Dashboard setup flow**: users without an API key are guided to open the dashboard from the setup wizard

## [1.1.5] — 2026-02-19

### Added
- **Auto-learn from commits**: every meaningful commit (3+ diff lines) triggers automatic memory enrichment. Memory grows as you code without any manual saves.
- **Auto-enrich setting**: `contox.autoEnrich` (default: true) lets users disable automatic learning if they prefer manual control.

### Fixed
- **Antigravity IDE detection**: improved `detectIdeSource()` to correctly detect Antigravity/Gemini from `appName`, `uriScheme`, and `appHost`

## [1.1.4] — 2026-02-18

### Security
- **Encrypted credentials**: `~/.contoxrc` is now AES-256-GCM encrypted at rest instead of plaintext JSON
- **Timing-safe comparisons**: HMAC signature validation uses constant-time comparison to prevent timing attacks
- **Strict rate limiting**: all API endpoints enforce per-user rate limits

### Fixed
- **HMAC secret propagation**: Windsurf and Antigravity MCP configs now correctly receive the HMAC secret

## [1.1.3] — 2026-02-17

### Fixed
- **HMAC secret for Windsurf & Antigravity**: MCP server config now includes `CONTOX_HMAC_SECRET` for Windsurf and Antigravity

## [1.1.2] — 2026-02-17

### Fixed
- **Source validation**: server now accepts `cursor`, `windsurf`, `antigravity` as valid sources
- **Session isolation**: each IDE now gets its own session (no more shared sessions across VS Code, Cursor, etc.)
- **Event loss prevention**: pending events are flushed before buffer reset when a session is closed externally

## [1.1.1] — 2026-02-16

### Fixed
- Sessions now show the correct IDE source (Cursor, Windsurf, Antigravity) instead of always "VS Code"
- IDE detected automatically via `vscode.env.appName`

## [1.1.0] — 2026-02-16

### Added
- **Antigravity IDE support**: auto-configures MCP server at `~/.gemini/antigravity/mcp_config.json`
- **Antigravity Skill**: deploys `.agent/skills/contox/SKILL.md` to teach Gemini to use Contox memory
- **Multi-IDE dashboard**: "Connect IDE" modal lets you choose between VS Code, Cursor, Windsurf, and Antigravity
- Deep link support for Antigravity (`antigravity://` protocol)

### Changed
- Setup wizard shows accurate MCP config paths for each tool
- Dashboard "Connect VS Code" replaced with "Connect IDE" supporting all IDEs

## [1.0.1] — 2026-02-16

### Fixed
- Extension now activates on startup so first-time users see the setup prompt

## [1.0.0] — 2026-02-16

### Added
- MCP server bundled and auto-deployed to globalStorage
- Auto-configure MCP for Claude, Cursor, Copilot & Windsurf
- AI-powered Genesis scan: auto-extract architecture, conventions, security & data flow
- Semantic search across project memory
- Ask AI: natural language questions about your codebase
- Session capture: automatic git commit tracking with diff context
- Deep link onboarding: one-click setup from the dashboard
- Privacy controls: disable capture, anonymize diffs, custom exclude patterns
- Sidebar with brain tree view
