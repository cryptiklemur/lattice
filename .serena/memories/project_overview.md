# Lattice — Project Overview

**Purpose**: Multi-machine agentic dashboard for Claude Code. Web UI for monitoring sessions, managing projects, tracking costs, and orchestrating across mesh-networked nodes.

**Status**: Alpha (pre-1.0), work directly on main branch.

## Tech Stack

- **Runtime**: Bun (server), Node (CI), Vite (client bundler)
- **Server**: Bun WebSocket server with typed message protocol
- **Client**: React 19 + Vite 8 + Tailwind CSS + daisyUI
- **Shared**: TypeScript types and constants (no build step, imported directly)
- **State**: Tanstack Store (client), Tanstack Router (routing)
- **Sessions**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **Charts**: Recharts
- **Testing**: Playwright (chromium only)
- **CI**: GitHub Actions (typecheck + build + Playwright)
- **Release**: semantic-release on push to main

## Monorepo Structure

```
lattice/
├── shared/     — TypeScript types, message definitions, constants
├── server/     — Bun WebSocket server, handlers, analytics, mesh networking
├── client/     — React + Vite dashboard, UI components, 23 themes
├── themes/     — Base16 theme JSON files (dark + light)
├── tests/      — Playwright test files
└── docs/       — Screenshots, audit docs
```

## Architecture

- Server communicates with clients via WebSocket using typed messages defined in `shared/`
- Sessions managed through Claude Agent SDK
- 23 base16 themes with OKLCH color space
- PWA with service worker caching (Workbox)
- Mesh networking for multi-machine orchestration
- Structured logging with `debug` package (lattice:* namespaces)

## Key Features

- Real-time chat with tool approval, context tracking, cost per message
- Session tabs with split-pane support
- Message bookmarks (per-session + global)
- Analytics dashboard (15+ chart types)
- Daily cost budget with configurable enforcement
- Keyboard shortcuts overlay (press ?)
- Session hover previews, auto-titling, date range search
- MCP server management, skill marketplace
- Memory management UI
