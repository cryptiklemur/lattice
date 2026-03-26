<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Lattice Dashboard" width="720" />
</p>

<h1 align="center">Lattice</h1>

<p align="center">
  Multi-machine agentic dashboard for Claude Code.<br/>
  Monitor sessions, manage projects, track costs, and orchestrate across mesh-networked nodes.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cryptiklemur/lattice"><img src="https://img.shields.io/npm/v/@cryptiklemur/lattice?style=flat-square&color=blue" alt="npm version" /></a>
  <a href="https://github.com/cryptiklemur/lattice/actions"><img src="https://img.shields.io/github/actions/workflow/status/cryptiklemur/lattice/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/cryptiklemur/lattice/blob/main/LICENSE"><img src="https://img.shields.io/github/license/cryptiklemur/lattice?style=flat-square" alt="License" /></a>
  <a href="https://github.com/cryptiklemur/lattice"><img src="https://img.shields.io/github/stars/cryptiklemur/lattice?style=flat-square" alt="Stars" /></a>
</p>

> **Alpha** — Lattice is under active development. APIs and features may change.

---

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/cryptiklemur/lattice/main/install.sh | bash
lattice
```

Opens at `http://localhost:7654`. No runtime dependencies — the binary includes everything.

<details>
<summary>Other install methods</summary>

**Custom install directory:**

```bash
LATTICE_INSTALL_DIR=~/.local/bin curl -fsSL https://raw.githubusercontent.com/cryptiklemur/lattice/main/install.sh | bash
```

**Via npm** (requires [Bun](https://bun.sh)):

```bash
bun install -g @cryptiklemur/lattice
lattice
```

**Manual download:**

Download the binary for your platform from [GitHub Releases](https://github.com/cryptiklemur/lattice/releases), `chmod +x`, and run it.

</details>

<details>
<summary>Development setup</summary>

```bash
git clone https://github.com/cryptiklemur/lattice.git
cd lattice
bun install
bun run dev
```

Hot-reloads both server and client automatically.

</details>

<details>
<summary>Updating</summary>

```bash
lattice update
```

The server also checks for updates automatically and shows a banner in the UI when a new version is available.

</details>

---

## Features

### Chat & Sessions

Send messages, approve tool use, and monitor context window usage with per-message token counts. Browse, rename, delete, and search sessions with date range filtering and hover previews. Sessions automatically get descriptive titles from the first exchange.

![Chat View](docs/screenshots/chat-view.png)

### Analytics & Cost Tracking

Track spending, token usage, cache efficiency, and session patterns with 15+ chart types. Set daily cost budgets with configurable enforcement (warning, confirm, or hard block).

![Analytics](docs/screenshots/analytics.png)

### Workspace

Open multiple sessions as tabs and switch between them. Split-pane via right-click context menu. Pin important messages with bookmarks — jump between them per-session or browse the global bookmarks view. Per-project tab state persists across navigation.

Press `?` for keyboard shortcuts, `Ctrl+K` for the command palette.

![Keyboard Shortcuts](docs/screenshots/keyboard-shortcuts.png)

### Themes & Settings

23 base16 themes (12 dark, 11 light) with OKLCH color space. Configure MCP servers, environment variables, rules, permissions, and Claude settings through the UI.

![Settings](docs/screenshots/settings.png)

### Plugin Management

Install, update, and remove Claude Code plugins from the UI. Browse all plugins across registered marketplaces sorted by popularity, view details (skills, hooks, rules, author info), and enable/disable plugins per project.

### Infrastructure

- **Mesh networking** — Connect multiple machines with automatic discovery and session proxying
- **MCP servers** — Add, edit, and remove at global or project level
- **Plugins & skills** — Browse marketplaces, install plugins, manage per-project
- **Memory management** — View and edit Claude's project memories
- **Self-updating** — Automatic update checks with in-app banner and `lattice update` CLI

### Mobile

Responsive design with touch targets, swipe-to-open sidebar, and optimized layouts.

<img src="docs/screenshots/mobile-chat.png" width="300" alt="Mobile chat view" />

---

## Architecture

Bun monorepo with three packages, compiled into a standalone binary via `bun build --compile`:

| Package | Stack |
|---------|-------|
| `shared/` | TypeScript types, message protocol, constants |
| `server/` | Bun WebSocket server, analytics engine, mesh networking |
| `client/` | React 19, Vite, Tailwind, daisyUI, 23 themes |

The client is built by Vite, then embedded into the server binary as base64-encoded assets. The result is a single executable with zero runtime dependencies.

Communication via typed WebSocket messages. Sessions managed through the [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk). Client state via Tanstack Store + Router.

### Security

| Feature | Detail |
|---------|--------|
| Authentication | Passphrase with scrypt hashing, 24-hour token expiration |
| Rate limiting | 100 messages per 10-second window per client |
| Attachments | 10MB upload limit |
| Bash commands | `cd` boundary-checked against project directory |
| Mesh pairing | Tokens expire after 5 minutes |
| Shutdown | Graceful drain of active streams |

### Testing

```bash
bun run dev            # start server
bunx playwright test   # run tests
```

Playwright suite covers onboarding, session flow, keyboard shortcuts, accessibility, message actions, and session previews.

## Configuration

| Path | Purpose |
|------|---------|
| `~/.lattice/config.json` | Daemon config (port, name, TLS, projects, cost budget) |
| `~/.lattice/bookmarks.json` | Message bookmarks across all sessions |
| `~/.claude/CLAUDE.md` | Global Claude instructions |
| `~/.claude.json` | Global MCP server configuration |

**Environment variables:**

- `ANTHROPIC_API_KEY` — Optional. Uses `claude setup-token` if not set.
- `DEBUG=lattice:*` — Structured debug logging.
- Server binds to `0.0.0.0:7654`. Override with `lattice --port <port>`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and pull request guidelines.

## License

[MIT](LICENSE)
