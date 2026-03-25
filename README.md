# Lattice

Multi-machine agentic dashboard for Claude Code. Monitor sessions, manage projects, track costs, and orchestrate across mesh-networked nodes.

> **Alpha** — Lattice is under active development. APIs and features may change.

![Dashboard](docs/screenshots/dashboard.png)

## Features

### Chat & Sessions

Send messages, approve tool use, and monitor context window usage with per-message token counts. Browse, rename, delete, and search sessions with date range filtering and hover previews. Sessions automatically get descriptive titles from the first exchange.

![Chat View](docs/screenshots/chat-view.png)

### Analytics & Cost Tracking

Track spending, token usage, cache efficiency, and session patterns with 15+ chart types. Set daily cost budgets with configurable enforcement (warning, confirm, or hard block).

![Analytics](docs/screenshots/analytics.png)

### Workspace

Open multiple sessions as tabs and switch between them. Split-pane via right-click context menu. Pin important messages with bookmarks — jump between them per-session or browse the global bookmarks view. Press `?` for keyboard shortcuts, `Ctrl+K` for the command palette.

![Keyboard Shortcuts](docs/screenshots/keyboard-shortcuts.png)

### Themes & Settings

23 base16 themes (12 dark, 11 light) with OKLCH color space. Configure MCP servers, environment variables, rules, permissions, and Claude settings through the UI. View and edit project memories.

![Settings](docs/screenshots/settings.png)

### Infrastructure

Mesh networking connects multiple machines with automatic discovery and session proxying. Manage MCP servers and install skills from [skills.sh](https://skills.sh). Edit CLAUDE.md, environment variables, rules, and permissions through the UI.

### Mobile

Responsive design with touch targets, swipe-to-open sidebar, and optimized layouts for mobile devices.

<img src="docs/screenshots/mobile-chat.png" width="300" alt="Mobile chat view" />

## Quick Start

### Install

```bash
# With npm
npm install -g @cryptiklemur/lattice

# With bun
bun install -g @cryptiklemur/lattice
```

### Run

```bash
lattice
```

Opens the dashboard at `http://localhost:7654`. Add projects through the UI or by navigating to a directory with a `CLAUDE.md` file.

### Development

```bash
git clone https://github.com/cryptiklemur/lattice.git
cd lattice
bun install
bun run dev
```

The dev server hot-reloads both the Bun server and the Vite client automatically.

## Architecture

Lattice is a Bun monorepo with three packages:

| Package | Description |
|---------|------------|
| `shared/` | TypeScript types, message protocol definitions, constants |
| `server/` | Bun WebSocket server — session management, analytics engine, mesh networking, structured logging |
| `client/` | React 19 + Vite + Tailwind + daisyUI — UI components, state management, 23 themes |

The server communicates with clients via WebSocket using a typed message protocol defined in `shared/`. Sessions are managed through the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk). The client uses Tanstack Store for state and Tanstack Router for routing.

### Security

- Authentication via passphrase with scrypt hashing and 24-hour token expiration
- Per-client WebSocket rate limiting (100 messages per 10-second window)
- Attachment upload size limits (10MB max)
- Bash `cd` commands boundary-checked against project directory
- Mesh pairing tokens expire after 5 minutes
- Graceful server shutdown with active stream draining

### Testing

Playwright test suite covering onboarding, session flow, keyboard shortcuts, accessibility, message actions, and session previews.

```bash
# Start the server first
bun run dev

# Run tests
bunx playwright test

# Single test file
bunx playwright test tests/session-flow.spec.ts
```

## Configuration

Lattice stores its config at `~/.lattice/config.json`. Global Claude settings are read from `~/.claude/` and `~/.claude.json`.

| Path | Purpose |
|------|---------|
| `~/.lattice/config.json` | Daemon config (port, name, TLS, projects, cost budget) |
| `~/.lattice/bookmarks.json` | Message bookmarks across all sessions |
| `~/.claude/CLAUDE.md` | Global Claude instructions |
| `~/.claude.json` | Global MCP server configuration |
| `~/.claude/skills/` | Global skills directory |

Project-level settings are stored in each project's `.claude/` directory and `.mcp.json`.

### Environment

- `ANTHROPIC_API_KEY` — Optional. Server uses the token from `claude setup-token` if not set.
- `DEBUG=lattice:*` — Enable structured debug logging (namespaces: server, ws, chat, session, mesh, auth, fs, analytics)
- Server binds to `0.0.0.0:7654` by default. Override with `lattice --port <port>`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and pull request guidelines.

## License

[MIT](LICENSE)
