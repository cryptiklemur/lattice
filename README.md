# Lattice

Multi-machine agentic dashboard for Claude Code. Monitor sessions, manage MCP servers and skills, orchestrate across mesh-networked nodes.

> **Alpha** — Lattice is under active development. APIs and features may change.

## What is Lattice?

Lattice is a web dashboard that sits alongside your Claude Code sessions. It gives you a unified view across projects, machines, and sessions — with real-time monitoring, configuration management, and a skill marketplace.

### Features

- **Multi-project dashboard** — See recent sessions across all projects at a glance, jump back into any conversation
- **MCP server management** — Add, edit, and remove MCP servers at global or project level through a visual editor
- **Skill marketplace** — Search and install skills from [skills.sh](https://skills.sh), manage installed skills with rendered markdown previews
- **Mesh networking** — Connect multiple machines into a mesh network, see node status and project distribution
- **Session management** — Browse, rename, delete, and resume Claude Code sessions per project
- **Real-time chat** — Send messages, approve tool use, monitor context usage and costs
- **Theme system** — 23 base16 themes (dark and light) with OKLCH color space
- **Configuration editor** — Edit CLAUDE.md, environment variables, rules, and permissions through the UI

## Quick Start

### Install

```bash
# With npm
npm install -g lattice-ai

# With bun
bun install -g lattice-ai
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

## Architecture

Lattice is a monorepo with three packages:

| Package | Description |
|---------|------------|
| `shared/` | TypeScript types, message definitions, constants |
| `server/` | Bun WebSocket server — handlers, session management, mesh networking |
| `client/` | React + Vite dashboard — UI components, state management, themes |

The server communicates with clients via WebSocket using a typed message protocol defined in `shared/`. Sessions are managed through the Claude Agent SDK. The client uses Tanstack Store for state management and Tanstack Router for routing.

## Configuration

Lattice stores its config at `~/.lattice/config.json`. Global Claude settings are read from `~/.claude/` and `~/.claude.json`.

| Path | Purpose |
|------|---------|
| `~/.lattice/config.json` | Lattice daemon config (port, name, TLS, projects) |
| `~/.claude/CLAUDE.md` | Global Claude instructions |
| `~/.claude.json` | Global MCP server configuration |
| `~/.claude/skills/` | Global skills directory |
| `~/.claude/rules/` | Global rules |

Project-level settings are stored in each project's `.claude/` directory and `.mcp.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and pull request guidelines.

## License

[MIT](LICENSE)
