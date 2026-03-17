# Lattice — Design Specification

A multi-machine agentic dashboard for Claude Code. One web UI, many machines.

## Overview

Lattice gives you a single browser interface to manage Claude Code projects across all your computers. Each machine runs a Lattice node. Nodes discover each other on the LAN via mDNS and can be manually paired across WANs (Tailscale recommended but not required). Projects live on their host machines; the UI proxies everything — file browsing, terminal sessions, and Claude conversations — so you can work on any machine from any browser.

**Core principles:**
- Single user, single identity — no multi-user accounts, roles, or permissions
- Code stays on its host machine — Claude runs where the project lives
- Zero-config on LAN — mDNS auto-discovery with explicit pairing for trust
- Privacy first — no cloud relay, no telemetry, all data local

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Language | TypeScript (server, client, shared types) |
| Frontend | Vite + React (SPA) |
| State | @tanstack/react-query (server state), @tanstack/react-store (client state) |
| Routing | @tanstack/react-router |
| Virtualization | @tanstack/react-virtual |
| Hotkeys | @tanstack/react-hotkeys |
| Terminal | xterm.js |
| Transport | WebSocket (client↔node, node↔node) |
| Storage | JSONL (sessions), JSON (config), filesystem |
| Discovery | mDNS (`_lattice._tcp`) + manual peer config |

## Architecture

```
$ lattice                          # CLI (thin client)
    └── Unix Socket IPC ──→ Lattice Daemon (detached Bun process)
                                ├── HTTP/WSS server (:2635)
                                ├── mDNS broadcaster/listener
                                ├── Mesh connections (WSS to peers)
                                ├── Project A → SDK bridge → Claude
                                ├── Project B → SDK bridge → Claude
                                └── Terminal PTY pool
```

### Process Model

Daemon-spawning model, compatible with systemd/launchd:
- `lattice` — Spawns daemon if not running, opens browser to UI
- `lattice stop` — Shuts down the daemon
- `lattice daemon` — Runs in foreground mode (for systemd `ExecStart`)
- Daemon writes PID to `~/.lattice/daemon.pid`, logs to `~/.lattice/daemon.log`
- CLI connects to daemon via Unix socket IPC (`~/.lattice/daemon.sock`)

### High-Level Data Flow

```
Browser (React SPA)
    │
    └── WSS ──→ Local Lattice Node (Bun daemon)
                    │
                    ├── Local projects (SDK bridge → Claude)
                    │
                    └── WSS mesh ──→ Remote Lattice Node
                                        │
                                        └── Remote projects (SDK bridge → Claude)
```

### Claude Authentication

The Claude Agent SDK uses OAuth tokens from `~/.claude/.credentials.json` — the same auth from `claude login`. No API key needed. Each machine in the mesh authenticates independently. The UI proxy doesn't need its own Claude auth because it relays to the host machine which has its own credentials.

## Mesh Networking

### Discovery

**Layer 1: mDNS (automatic, zero-config)**
- Each node broadcasts itself via mDNS service type `_lattice._tcp`
- Nodes on the same LAN auto-discover each other
- Also works transparently over Tailscale (MagicDNS supports mDNS-style resolution)

**Layer 2: Manual peers (explicit config)**
- A `peers` array in config for adding remote nodes by hostname/IP
- Covers edge cases where mDNS doesn't work (firewalled networks, non-Tailscale WAN)

### Pairing Flow

Discovery and trust are separate concerns. mDNS handles discovery, but pairing is always explicit.

**mDNS-discovered nodes (LAN/Tailscale):**
1. Discovered nodes appear in the UI as "nearby nodes"
2. Click "pair" — host generates a short code (6 chars)
3. Enter code on the other machine (or scan QR)
4. Mutual trust established

**Manual WAN nodes:**
1. Node A generates an invite code: `LTCE-XXXX-XXXX` (encodes address + one-time auth token)
2. Code displayed in UI + rendered as QR
3. Node B enters code (or scans QR) → initiates pairing handshake
4. Nodes exchange identity public keys → mutual trust established
5. Both store each other in `peers.json`
6. Future connections authenticate via keypair challenge — no code needed again

### Mesh Protocol

All node-to-node communication is WebSocket + typed JSON messages.

```typescript
// Discovery
{ type: "mesh:hello", nodeId: string, name: string, projects: ProjectSummary[] }
{ type: "mesh:project_list", projects: ProjectSummary[] }

// Proxied operations (laptop → workstation)
{ type: "mesh:proxy_request", projectSlug: string, payload: ClientMessage }
{ type: "mesh:proxy_response", projectSlug: string, payload: ServerMessage }

// Session sync
{ type: "mesh:session_list_request", projectSlug: string }
{ type: "mesh:session_list_response", projectSlug: string, sessions: SessionSummary[] }
```

The mesh protocol is a thin proxy layer. When the browser wants to interact with a remote project, the local node wraps the message in a `mesh:proxy_request` envelope and sends it to the remote node. The remote node unwraps it and handles it like a local client. Zero duplication of logic.

### Node Offline Handling

- Mesh connector detects WSS disconnect
- Broadcasts `mesh:node_offline` to browser
- UI grays out that node's projects
- Auto-reconnect with exponential backoff
- On reconnect: re-sync project list, resume active sessions

## WebSocket Protocol

All client↔server communication uses namespaced typed JSON messages. The `shared` package defines every message type for compile-time safety on both sides.

### Client → Server

```typescript
// Session
{ type: "session:create", projectSlug: string }
{ type: "session:activate", projectSlug: string, sessionId: string }
{ type: "session:rename", sessionId: string, title: string }
{ type: "session:delete", sessionId: string }

// Chat
{ type: "chat:send", text: string, attachments?: Attachment[] }
{ type: "chat:permission_response", requestId: string, allow: boolean }
{ type: "chat:rewind", messageUuid: string }
{ type: "chat:cancel" }

// Files
{ type: "fs:list", path: string }
{ type: "fs:read", path: string }
{ type: "fs:write", path: string, content: string }

// Terminal
{ type: "terminal:create" }
{ type: "terminal:input", termId: string, data: string }
{ type: "terminal:resize", termId: string, cols: number, rows: number }

// Settings
{ type: "settings:get" }
{ type: "settings:update", settings: Partial<Settings> }
{ type: "settings:restart" }

// Mesh
{ type: "mesh:pair", code: string }
{ type: "mesh:generate_invite" }
{ type: "mesh:unpair", nodeId: string }
```

### Server → Client

```typescript
// Session
{ type: "session:list", projectSlug: string, sessions: SessionSummary[] }
{ type: "session:created", session: SessionSummary }
{ type: "session:history", messages: HistoryMessage[] }

// Chat streaming
{ type: "chat:user_message", text: string, uuid: string }
{ type: "chat:delta", text: string }
{ type: "chat:tool_start", toolId: string, name: string, args: string }
{ type: "chat:tool_result", toolId: string, content: string }
{ type: "chat:done", cost: number, duration: number }
{ type: "chat:error", message: string }
{ type: "chat:permission_request", requestId: string, tool: string, args: string }

// Files
{ type: "fs:list_result", path: string, entries: FileEntry[] }
{ type: "fs:read_result", path: string, content: string }
{ type: "fs:changed", path: string }

// Terminal
{ type: "terminal:created", termId: string }
{ type: "terminal:output", termId: string, data: string }
{ type: "terminal:exited", termId: string, code: number }

// Mesh
{ type: "mesh:nodes", nodes: NodeInfo[] }
{ type: "mesh:invite_code", code: string, qrDataUrl: string }
{ type: "mesh:paired", node: NodeInfo }
{ type: "mesh:node_online", nodeId: string }
{ type: "mesh:node_offline", nodeId: string }

// Projects (aggregated across mesh)
{ type: "projects:list", projects: ProjectInfo[] }
```

## Authentication

**Optional passphrase** for web UI access. Not required — if you're on a trusted network, no friction needed. Can be enabled in settings at any time.

**Node-to-node trust** is established during pairing via keypair exchange. After pairing, reconnection is automatic using stored identity keys.

## Storage Layout

```
~/.lattice/
├── config.json          # Node config (port, name, passphrase hash, env vars)
├── identity.json        # Node keypair for mesh auth
├── peers.json           # Paired nodes (id, name, addresses, shared key)
├── daemon.pid           # Daemon process ID
├── daemon.log           # Daemon log output
├── daemon.sock          # Unix socket for CLI ↔ daemon IPC
├── sessions/
│   └── {project-slug}/
│       └── {sessionId}.jsonl
├── certs/               # Auto-generated TLS certs
├── themes/              # Custom theme JSON files
└── notes.jsonl          # Sticky notes
```

## Monorepo Structure

```
lattice/
├── package.json                  # Bun workspace root
├── shared/                       # Shared types package
│   ├── package.json
│   └── src/
│       ├── messages.ts           # All WS message type definitions
│       ├── models.ts             # Project, Session, Node, Peer types
│       └── constants.ts          # Ports, protocol version, etc.
├── server/                       # Bun daemon
│   ├── package.json
│   └── src/
│       ├── index.ts              # Entry — daemon spawn/connect
│       ├── daemon.ts             # HTTP/WSS server, lifecycle
│       ├── config.ts             # Load/save config
│       ├── identity.ts           # Node keypair management
│       ├── project/
│       │   ├── registry.ts       # Project CRUD
│       │   ├── sdk-bridge.ts     # Claude Agent SDK integration
│       │   ├── session.ts        # Session lifecycle + JSONL persistence
│       │   ├── file-browser.ts   # Safe file ops
│       │   └── terminal.ts       # PTY management
│       ├── mesh/
│       │   ├── discovery.ts      # mDNS broadcast + listen
│       │   ├── pairing.ts        # Invite code/QR + handshake
│       │   ├── connector.ts      # WSS connections to peers
│       │   ├── proxy.ts          # Message envelope/unwrap
│       │   └── peers.ts          # Peer store
│       ├── ws/
│       │   ├── server.ts         # WebSocket server + client mgmt
│       │   ├── router.ts         # Message routing
│       │   └── broadcast.ts      # Broadcast to browsers
│       ├── auth/
│       │   └── passphrase.ts     # Optional passphrase hash/verify
│       └── features/
│           ├── themes.ts         # Theme loading
│           ├── ralph-loop.ts     # Autonomous iteration
│           ├── scheduler.ts      # Cron tasks
│           └── sticky-notes.ts   # Notes CRUD
├── client/                       # Vite + React SPA
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── sidebar/
│       │   │   ├── NodeRail.tsx
│       │   │   ├── ProjectList.tsx
│       │   │   ├── SessionList.tsx
│       │   │   └── UserIsland.tsx
│       │   ├── chat/
│       │   │   ├── ChatView.tsx
│       │   │   ├── Message.tsx
│       │   │   ├── ChatInput.tsx
│       │   │   └── ModelSelector.tsx
│       │   ├── panels/
│       │   │   ├── FileBrowser.tsx
│       │   │   └── Terminal.tsx
│       │   ├── settings/
│       │   │   ├── Settings.tsx
│       │   │   ├── Appearance.tsx
│       │   │   ├── Status.tsx
│       │   │   ├── ClaudeSettings.tsx
│       │   │   ├── Environment.tsx
│       │   │   └── MeshStatus.tsx
│       │   └── mesh/
│       │       ├── PairingDialog.tsx
│       │       └── NodeBadge.tsx
│       ├── hooks/
│       │   ├── useWebSocket.ts
│       │   ├── useMesh.ts
│       │   ├── useSession.ts
│       │   └── useTheme.ts
│       ├── stores/
│       │   ├── mesh.ts
│       │   ├── session.ts
│       │   ├── theme.ts
│       │   └── ui.ts
│       └── types/
│           └── index.ts          # Re-exports from shared
└── themes/                       # Built-in theme JSON files
    ├── dracula.json
    ├── amoled-dark.json
    ├── catppuccin-mocha.json
    ├── ayu-light.json
    └── ...
```

## Frontend Layout

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐ ┌──────────────────────────────────────┐│
│ │      │ │  Session Title          [info] [term] ││
│ │ Node │ │──────────────────────────────────────││
│ │ Rail │ │                                      ││
│ │      │ │                                      ││
│ │ ──── │ │         Chat / Session View          ││
│ │      │ │                                      ││
│ │ Proj │ │                                      ││
│ │ List │ │                                      ││
│ │      │ │                                      ││
│ │ ──── │ │──────────────────────────────────────││
│ │      │ │  [attach] [voice]   Model · Effort ↑ ││
│ │ Sess │ │  Message input...                    ││
│ │ List │ │                                      ││
│ │      │ ├──────────────────────────────────────┤│
│ │      │ │  File Browser / Terminal (panels)    ││
│ ├──────┤ └──────────────────────────────────────┘│
│ │ User │                                         │
│ │Island│                                         │
│ └──────┘                                         │
└──────────────────────────────────────────────────┘
```

- **Node rail** — Left edge shows connected nodes as icons. Click to filter projects by node. Local node always first.
- **Project list** — Projects grouped by node. Remote projects show a subtle node badge.
- **No top bar** — Full-width chat area.
- **User island** — Name, version, theme toggle, settings gear.

## First-Time Setup Flow

1. **Welcome** — "Welcome to Lattice" + brief description
2. **Node identity** — Name this machine (defaults to hostname)
3. **Appearance** — Pick a theme, light/dark preference
4. **Security** — Optional passphrase setup
5. **Claude settings** — Global `~/.claude/CLAUDE.md` editor, model defaults, environment variables
6. **Add project** — Pick first local directory
7. **Done** — Dashboard loads

All steps are skippable and configurable later from settings.

## Settings Panel

Accessible from the gear icon in the user island.

**Sections:**
- **Status** — Node info, version, uptime, memory, PID
- **Appearance** — Theme picker (dark/light variants, per-variant persistence)
- **Claude Settings** — Global `~/.claude/CLAUDE.md` editor, per-project `.claude/CLAUDE.md`
- **Model Defaults** — Default model, effort, thinking budget
- **Environment** — Environment variables (global, per-project, per-session)
- **Mesh** — Paired nodes, connection health, pair/unpair, invite generation
- **Notifications** — Browser notification preferences
- **Security** — Passphrase management (set/change/remove)
- **Restart** — Restart the daemon
- **Shutdown** — Stop the daemon

## Feature Inventory

### Carried Over from Clay
- Chat with Claude (streaming, tool calls, permission approvals)
- Session management (create, rename, fork, rewind, delete)
- File browser (tree view, file preview, edit, live reload)
- Terminal (PTY, multi-tab)
- Theme system (base16 JSON themes, dark/light toggle, per-variant persistence, AMOLED dark)
- Appearance settings in server settings
- Settings button in user island
- Full model list (all available models, not just default/sonnet/haiku)
- Model selector (model + mode + effort + thinking)
- Ralph Loop (autonomous iteration with PROMPT.md + JUDGE.md)
- Scheduled tasks (cron)
- Sticky notes
- Skills management
- Daemon restart from UI
- PWA support (installable)
- Mobile responsive + swipe navigation
- JSONL session storage
- Context menu on sessions
- Auto-generated TLS certs
- Environment variable configuration (global + per-project + per-session)

### New for Lattice
- Mesh networking (mDNS discovery + manual peers)
- Node pairing (invite code + QR)
- Full project proxy across machines (files, terminal, Claude)
- Node rail in sidebar (multi-machine navigation)
- Mesh status panel (node health, latency)
- First-time setup wizard
- Claude settings editor (global + per-project CLAUDE.md)
- TypeScript + Bun (type safety everywhere)
- React + TanStack ecosystem
- Shared types package (client/server protocol)

### Stripped (was in Clay)
- Multi-user accounts / roles / permissions
- User profiles / avatars system
- Session visibility (public/private/assigned)
- Direct messages between users
- Per-user project permissions
- Admin panel
- Setup codes for inviting users

## Key Scenarios

### Chat with Claude on a remote project
```
Browser (laptop) → local node WSS
    { type: "chat:send", text: "refactor the API" }
        │
        ├─ Local node sees project belongs to remote node
        ├─ Wraps in proxy envelope → sends over mesh WSS
        │
        Remote node:
        ├─ Unwraps → pushes to SDK message queue
        ├─ SDK drives Claude → streams deltas back
        ├─ Each delta wrapped in proxy envelope → sent back
        │
        Local node:
        └─ Unwraps → broadcasts to browser
            { type: "chat:delta", text: "I'll start by..." }
```

### File browser on remote project
```
Browser requests file listing → local node → mesh proxy → remote node
Remote node reads filesystem → proxy response → local node → browser
```

### Terminal on remote project
```
Browser creates terminal → proxied to remote node
Remote node spawns PTY → streams output back through mesh
Keystrokes proxied in real-time
```

### First-time setup
```
$ lattice
    → No config found, spawns daemon
    → Opens browser to http://localhost:2635
    → Setup wizard (name, theme, security, claude settings, first project)
    → Dashboard appears
    → "Pair another machine" available in mesh settings
```
