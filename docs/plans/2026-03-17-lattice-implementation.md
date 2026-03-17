# Lattice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-machine agentic dashboard for Claude Code with mesh networking, full project proxy, and a React + TanStack frontend.

**Architecture:** Bun monorepo with three packages: `shared` (TypeScript types for the WS protocol), `server` (Bun daemon with WebSocket, mDNS, SDK bridge), and `client` (Vite + React SPA). The daemon manages local projects and connects to peer nodes over WebSocket mesh. All features from Clay are ported minus multi-user.

**Tech Stack:** Bun, TypeScript, Vite, React, TanStack (Router, Query, Virtual, Hotkeys, Store), xterm.js, @anthropic-ai/claude-agent-sdk, multicast-dns, node-pty, qrcode

**Design Spec:** `docs/plans/2026-03-17-lattice-design.md`

---

## Phase 1: Foundation (Monorepo + Shared Types + Daemon Shell)

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (workspace root)
- Create: `bunfig.toml`
- Create: `tsconfig.json` (root)
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `.gitignore`
- Create: `.editorconfig`

**Step 1: Create root workspace config**

`package.json`:
```json
{
  "name": "lattice",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter 'shared' build && bun run --filter 'client' build",
    "lint": "biome check .",
    "typecheck": "tsc --build"
  }
}
```

`bunfig.toml`:
```toml
[install]
peer = false
```

Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "references": [
    { "path": "./shared" },
    { "path": "./server" },
    { "path": "./client" }
  ]
}
```

`.gitignore`:
```
node_modules/
dist/
.turbo/
*.tsbuildinfo
.env
.env.local
```

`.editorconfig`:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**Step 2: Create shared package**

`shared/package.json`:
```json
{
  "name": "@lattice/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

`shared/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

`shared/src/index.ts`:
```typescript
export * from "./constants";
export * from "./messages";
export * from "./models";
```

**Step 3: Create server package**

`server/package.json`:
```json
{
  "name": "@lattice/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts"
  },
  "dependencies": {
    "@lattice/shared": "workspace:*"
  }
}
```

`server/tsconfig.json`:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

`server/src/index.ts`:
```typescript
console.log("[lattice] Starting...");
```

**Step 4: Create client package**

`client/package.json`:
```json
{
  "name": "@lattice/client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@lattice/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "vite": "^6.0.0",
    "typescript": "^5.7.0"
  }
}
```

`client/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:2635",
        ws: true,
      },
    },
  },
});
```

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lattice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`client/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`client/src/App.tsx`:
```tsx
export function App() {
  return <div>Lattice</div>;
}
```

**Step 5: Install dependencies and verify**

Run: `cd /home/aequasi/projects/cryptiklemur/lattice && bun install`
Run: `bun run --filter '@lattice/server' start` — expect "[lattice] Starting..."
Run: `bun run --filter '@lattice/client' dev` — expect Vite dev server starts

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Bun monorepo with shared, server, and client packages"
```

---

### Task 2: Shared Types — WebSocket Protocol

**Files:**
- Create: `shared/src/constants.ts`
- Create: `shared/src/models.ts`
- Create: `shared/src/messages.ts`

**Step 1: Define constants**

`shared/src/constants.ts`:
```typescript
export const DEFAULT_PORT = 2635;
export const PROTOCOL_VERSION = 1;
export const MDNS_SERVICE_TYPE = "_lattice._tcp";
export const LATTICE_HOME_DIR = ".lattice";
export const DAEMON_SOCKET_NAME = "daemon.sock";
export const DAEMON_PID_FILE = "daemon.pid";
export const DAEMON_LOG_FILE = "daemon.log";
```

**Step 2: Define data models**

`shared/src/models.ts`:
```typescript
export interface NodeInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  online: boolean;
  isLocal: boolean;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  slug: string;
  path: string;
  title: string;
  nodeId: string;
}

export interface ProjectInfo extends ProjectSummary {
  nodeName: string;
  isRemote: boolean;
}

export interface SessionSummary {
  id: string;
  projectSlug: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
}

export interface Attachment {
  type: "file" | "image";
  name: string;
  content: string;
}

export interface HistoryMessage {
  type: string;
  uuid?: string;
  text?: string;
  toolId?: string;
  name?: string;
  args?: string;
  content?: string;
  timestamp: number;
}

export interface PeerInfo {
  id: string;
  name: string;
  addresses: string[];
  publicKey: string;
  pairedAt: number;
}

export interface LatticeConfig {
  port: number;
  name: string;
  passphraseHash?: string;
  tls: boolean;
  debug: boolean;
  globalEnv: Record<string, string>;
  projects: Array<{
    path: string;
    slug: string;
    title: string;
    env: Record<string, string>;
  }>;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  variant: "dark" | "light";
  colors: Record<string, string>;
}
```

**Step 3: Define all WebSocket message types**

`shared/src/messages.ts`:
```typescript
import type {
  Attachment,
  FileEntry,
  HistoryMessage,
  LatticeConfig,
  NodeInfo,
  ProjectInfo,
  SessionSummary,
} from "./models";

// --- Client → Server ---

export interface SessionCreateMessage {
  type: "session:create";
  projectSlug: string;
}

export interface SessionActivateMessage {
  type: "session:activate";
  projectSlug: string;
  sessionId: string;
}

export interface SessionRenameMessage {
  type: "session:rename";
  sessionId: string;
  title: string;
}

export interface SessionDeleteMessage {
  type: "session:delete";
  sessionId: string;
}

export interface ChatSendMessage {
  type: "chat:send";
  text: string;
  attachments?: Attachment[];
}

export interface ChatPermissionResponseMessage {
  type: "chat:permission_response";
  requestId: string;
  allow: boolean;
}

export interface ChatRewindMessage {
  type: "chat:rewind";
  messageUuid: string;
}

export interface ChatCancelMessage {
  type: "chat:cancel";
}

export interface FsListMessage {
  type: "fs:list";
  path: string;
}

export interface FsReadMessage {
  type: "fs:read";
  path: string;
}

export interface FsWriteMessage {
  type: "fs:write";
  path: string;
  content: string;
}

export interface TerminalCreateMessage {
  type: "terminal:create";
}

export interface TerminalInputMessage {
  type: "terminal:input";
  termId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: "terminal:resize";
  termId: string;
  cols: number;
  rows: number;
}

export interface SettingsGetMessage {
  type: "settings:get";
}

export interface SettingsUpdateMessage {
  type: "settings:update";
  settings: Partial<LatticeConfig>;
}

export interface SettingsRestartMessage {
  type: "settings:restart";
}

export interface MeshPairMessage {
  type: "mesh:pair";
  code: string;
}

export interface MeshGenerateInviteMessage {
  type: "mesh:generate_invite";
}

export interface MeshUnpairMessage {
  type: "mesh:unpair";
  nodeId: string;
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionActivateMessage
  | SessionRenameMessage
  | SessionDeleteMessage
  | ChatSendMessage
  | ChatPermissionResponseMessage
  | ChatRewindMessage
  | ChatCancelMessage
  | FsListMessage
  | FsReadMessage
  | FsWriteMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | SettingsGetMessage
  | SettingsUpdateMessage
  | SettingsRestartMessage
  | MeshPairMessage
  | MeshGenerateInviteMessage
  | MeshUnpairMessage;

// --- Server → Client ---

export interface SessionListMessage {
  type: "session:list";
  projectSlug: string;
  sessions: SessionSummary[];
}

export interface SessionCreatedMessage {
  type: "session:created";
  session: SessionSummary;
}

export interface SessionHistoryMessage {
  type: "session:history";
  messages: HistoryMessage[];
}

export interface ChatUserMessage {
  type: "chat:user_message";
  text: string;
  uuid: string;
}

export interface ChatDeltaMessage {
  type: "chat:delta";
  text: string;
}

export interface ChatToolStartMessage {
  type: "chat:tool_start";
  toolId: string;
  name: string;
  args: string;
}

export interface ChatToolResultMessage {
  type: "chat:tool_result";
  toolId: string;
  content: string;
}

export interface ChatDoneMessage {
  type: "chat:done";
  cost: number;
  duration: number;
}

export interface ChatErrorMessage {
  type: "chat:error";
  message: string;
}

export interface ChatPermissionRequestMessage {
  type: "chat:permission_request";
  requestId: string;
  tool: string;
  args: string;
}

export interface FsListResultMessage {
  type: "fs:list_result";
  path: string;
  entries: FileEntry[];
}

export interface FsReadResultMessage {
  type: "fs:read_result";
  path: string;
  content: string;
}

export interface FsChangedMessage {
  type: "fs:changed";
  path: string;
}

export interface TerminalCreatedMessage {
  type: "terminal:created";
  termId: string;
}

export interface TerminalOutputMessage {
  type: "terminal:output";
  termId: string;
  data: string;
}

export interface TerminalExitedMessage {
  type: "terminal:exited";
  termId: string;
  code: number;
}

export interface MeshNodesMessage {
  type: "mesh:nodes";
  nodes: NodeInfo[];
}

export interface MeshInviteCodeMessage {
  type: "mesh:invite_code";
  code: string;
  qrDataUrl: string;
}

export interface MeshPairedMessage {
  type: "mesh:paired";
  node: NodeInfo;
}

export interface MeshNodeOnlineMessage {
  type: "mesh:node_online";
  nodeId: string;
}

export interface MeshNodeOfflineMessage {
  type: "mesh:node_offline";
  nodeId: string;
}

export interface ProjectsListMessage {
  type: "projects:list";
  projects: ProjectInfo[];
}

export interface SettingsDataMessage {
  type: "settings:data";
  config: LatticeConfig;
}

export type ServerMessage =
  | SessionListMessage
  | SessionCreatedMessage
  | SessionHistoryMessage
  | ChatUserMessage
  | ChatDeltaMessage
  | ChatToolStartMessage
  | ChatToolResultMessage
  | ChatDoneMessage
  | ChatErrorMessage
  | ChatPermissionRequestMessage
  | FsListResultMessage
  | FsReadResultMessage
  | FsChangedMessage
  | TerminalCreatedMessage
  | TerminalOutputMessage
  | TerminalExitedMessage
  | MeshNodesMessage
  | MeshInviteCodeMessage
  | MeshPairedMessage
  | MeshNodeOnlineMessage
  | MeshNodeOfflineMessage
  | ProjectsListMessage
  | SettingsDataMessage;

// --- Mesh (Node ↔ Node) ---

export interface MeshHelloMessage {
  type: "mesh:hello";
  nodeId: string;
  name: string;
  projects: Array<{ slug: string; title: string }>;
}

export interface MeshProxyRequestMessage {
  type: "mesh:proxy_request";
  projectSlug: string;
  requestId: string;
  payload: ClientMessage;
}

export interface MeshProxyResponseMessage {
  type: "mesh:proxy_response";
  projectSlug: string;
  requestId: string;
  payload: ServerMessage;
}

export type MeshMessage =
  | MeshHelloMessage
  | MeshProxyRequestMessage
  | MeshProxyResponseMessage;
```

**Step 4: Verify types compile**

Run: `cd /home/aequasi/projects/cryptiklemur/lattice && bunx tsc --noEmit -p shared/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add shared/
git commit -m "feat(shared): define WebSocket protocol types, data models, and constants"
```

---

### Task 3: Config + Identity + Daemon Lifecycle

**Files:**
- Create: `server/src/config.ts`
- Create: `server/src/identity.ts`
- Create: `server/src/daemon.ts`
- Modify: `server/src/index.ts`

**Step 1: Config module**

`server/src/config.ts`:
```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT, LATTICE_HOME_DIR } from "@lattice/shared";
import type { LatticeConfig } from "@lattice/shared";

const home = join(homedir(), LATTICE_HOME_DIR);

export function getLatticeHome(): string {
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true });
  }
  return home;
}

export function getConfigPath(): string {
  return join(getLatticeHome(), "config.json");
}

export function loadConfig(): LatticeConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return createDefaultConfig();
  }
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as LatticeConfig;
}

export function saveConfig(config: LatticeConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function createDefaultConfig(): LatticeConfig {
  const hostname = require("node:os").hostname();
  const config: LatticeConfig = {
    port: DEFAULT_PORT,
    name: hostname,
    tls: false,
    debug: false,
    globalEnv: {},
    projects: [],
  };
  saveConfig(config);
  return config;
}
```

**Step 2: Identity module**

`server/src/identity.ts`:
```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getLatticeHome } from "./config";

interface NodeIdentity {
  id: string;
  createdAt: number;
}

export function getIdentityPath(): string {
  return join(getLatticeHome(), "identity.json");
}

export function loadOrCreateIdentity(): NodeIdentity {
  const path = getIdentityPath();
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8")) as NodeIdentity;
  }
  const identity: NodeIdentity = {
    id: randomUUID(),
    createdAt: Date.now(),
  };
  writeFileSync(path, JSON.stringify(identity, null, 2), "utf-8");
  return identity;
}
```

**Step 3: Daemon with Bun HTTP + WebSocket server**

`server/src/daemon.ts`:
```typescript
import { join } from "node:path";
import { loadConfig, getLatticeHome } from "./config";
import { loadOrCreateIdentity } from "./identity";
import type { ServerWebSocket } from "bun";

interface WsData {
  id: string;
}

export async function startDaemon(): Promise<void> {
  const config = loadConfig();
  const identity = loadOrCreateIdentity();

  console.log(`[lattice] Node: ${config.name} (${identity.id})`);
  console.log(`[lattice] Home: ${getLatticeHome()}`);

  const clientDir = join(import.meta.dir, "../../client/dist");

  const server = Bun.serve<WsData>({
    port: config.port,
    hostname: "0.0.0.0",

    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const upgraded = server.upgrade(req, {
          data: { id: crypto.randomUUID() },
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Serve static client files
      const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(join(clientDir, filePath));
      if (await file.exists()) {
        return new Response(file);
      }

      // SPA fallback
      const index = Bun.file(join(clientDir, "index.html"));
      if (await index.exists()) {
        return new Response(index);
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        console.log(`[lattice] Client connected: ${ws.data.id}`);
      },
      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        const text = typeof message === "string" ? message : message.toString();
        try {
          const msg = JSON.parse(text);
          console.log(`[lattice] Message: ${msg.type}`);
          // TODO: Route to handlers
        } catch {
          console.error("[lattice] Invalid JSON message");
        }
      },
      close(ws: ServerWebSocket<WsData>) {
        console.log(`[lattice] Client disconnected: ${ws.data.id}`);
      },
    },
  });

  console.log(`[lattice] Listening on http://0.0.0.0:${config.port}`);
}
```

**Step 4: Entry point with daemon spawn logic**

`server/src/index.ts`:
```typescript
import { startDaemon } from "./daemon";

const args = process.argv.slice(2);
const command = args[0] || "daemon";

switch (command) {
  case "daemon":
    await startDaemon();
    break;
  case "stop":
    console.log("[lattice] Stop not yet implemented");
    process.exit(0);
    break;
  default:
    console.log(`[lattice] Unknown command: ${command}`);
    process.exit(1);
}
```

**Step 5: Verify daemon starts**

Run: `cd /home/aequasi/projects/cryptiklemur/lattice && bun server/src/index.ts`
Expected: Prints node info and "Listening on http://0.0.0.0:2635"
Run: `curl -s http://localhost:2635/` — expect 404 (no client built yet)
Kill the server with Ctrl+C.

**Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): add config, identity, and daemon with Bun HTTP/WebSocket server"
```

---

### Task 4: WebSocket Router + Broadcast

**Files:**
- Create: `server/src/ws/server.ts`
- Create: `server/src/ws/router.ts`
- Create: `server/src/ws/broadcast.ts`
- Modify: `server/src/daemon.ts`

**Step 1: Client tracking and broadcast**

`server/src/ws/broadcast.ts`:
```typescript
import type { ServerWebSocket } from "bun";

const clients = new Map<string, ServerWebSocket<{ id: string }>>();

export function addClient(ws: ServerWebSocket<{ id: string }>): void {
  clients.set(ws.data.id, ws);
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function broadcast(message: object, excludeId?: string): void {
  const text = JSON.stringify(message);
  for (const [id, ws] of clients) {
    if (id !== excludeId) {
      ws.send(text);
    }
  }
}

export function sendTo(id: string, message: object): void {
  const ws = clients.get(id);
  if (ws) {
    ws.send(JSON.stringify(message));
  }
}

export function getClientCount(): number {
  return clients.size;
}
```

**Step 2: Message router**

`server/src/ws/router.ts`:
```typescript
import type { ClientMessage } from "@lattice/shared";
import { sendTo } from "./broadcast";

type Handler = (clientId: string, message: ClientMessage) => void | Promise<void>;

const handlers = new Map<string, Handler>();

export function registerHandler(prefix: string, handler: Handler): void {
  handlers.set(prefix, handler);
}

export function routeMessage(clientId: string, message: ClientMessage): void {
  const prefix = message.type.split(":")[0];
  const handler = handlers.get(prefix);
  if (handler) {
    handler(clientId, message);
  } else {
    console.warn(`[lattice] No handler for message type: ${message.type}`);
    sendTo(clientId, { type: "error", message: `Unknown message type: ${message.type}` });
  }
}
```

**Step 3: WebSocket server wrapper**

`server/src/ws/server.ts`:
```typescript
export { addClient, removeClient, broadcast, sendTo, getClientCount } from "./broadcast";
export { registerHandler, routeMessage } from "./router";
```

**Step 4: Wire into daemon**

Update `server/src/daemon.ts` to import and use the WS modules — replace the `open`, `message`, and `close` handlers:

```typescript
import { addClient, removeClient, routeMessage } from "./ws/server";
```

In the websocket handlers:
- `open`: call `addClient(ws)`
- `message`: parse JSON and call `routeMessage(ws.data.id, msg)`
- `close`: call `removeClient(ws.data.id)`

**Step 5: Verify**

Run daemon, connect with `wscat -c ws://localhost:2635/ws`, send `{"type":"settings:get"}`.
Expected: Console shows "No handler for message type: settings:get"

**Step 6: Commit**

```bash
git add server/src/ws/
git commit -m "feat(server): add WebSocket message router and broadcast system"
```

---

### Task 5: Project Registry

**Files:**
- Create: `server/src/project/registry.ts`
- Modify: `server/src/daemon.ts`

**Step 1: Project registry**

`server/src/project/registry.ts`:
```typescript
import { existsSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig, saveConfig } from "../config";
import type { ProjectSummary } from "@lattice/shared";

export function listProjects(nodeId: string): ProjectSummary[] {
  const config = loadConfig();
  return config.projects.map((p) => ({
    slug: p.slug,
    path: p.path,
    title: p.title,
    nodeId,
  }));
}

export function addProject(path: string, title?: string): ProjectSummary | null {
  if (!existsSync(path)) return null;

  const config = loadConfig();
  const slug = generateSlug(basename(path), config.projects.map((p) => p.slug));

  if (config.projects.some((p) => p.path === path)) return null;

  const project = { path, slug, title: title || basename(path), env: {} };
  config.projects.push(project);
  saveConfig(config);

  return { slug: project.slug, path: project.path, title: project.title, nodeId: "" };
}

export function removeProject(slug: string): boolean {
  const config = loadConfig();
  const idx = config.projects.findIndex((p) => p.slug === slug);
  if (idx === -1) return false;
  config.projects.splice(idx, 1);
  saveConfig(config);
  return true;
}

export function getProjectBySlug(slug: string): { path: string; slug: string; title: string; env: Record<string, string> } | undefined {
  const config = loadConfig();
  return config.projects.find((p) => p.slug === slug);
}

function generateSlug(name: string, existing: string[]): string {
  let slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "project";
  let candidate = slug;
  let counter = 1;
  while (existing.includes(candidate)) {
    candidate = `${slug}-${counter++}`;
  }
  return candidate;
}
```

**Step 2: Wire settings handler to return project list**

Register a `settings` handler and a `projects` handler in the daemon startup that responds to `settings:get` and sends the project list.

**Step 3: Commit**

```bash
git add server/src/project/
git commit -m "feat(server): add project registry with add/remove/list"
```

---

## Phase 2: Client Foundation

### Task 6: React SPA Shell + TanStack Router

**Files:**
- Modify: `client/package.json` (add TanStack deps)
- Create: `client/src/routes/__root.tsx`
- Create: `client/src/routes/index.tsx`
- Create: `client/src/components/sidebar/Sidebar.tsx`
- Create: `client/src/components/chat/ChatView.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`

**Step 1: Install TanStack dependencies**

```bash
cd client && bun add @tanstack/react-router @tanstack/react-query @tanstack/react-store @tanstack/react-virtual @tanstack/react-hotkeys
```

**Step 2: Set up TanStack Router with root layout**

Create the root route with sidebar + main content area layout. Create the index route that shows the chat view or a welcome screen.

**Step 3: Create sidebar shell**

`Sidebar.tsx` — renders node rail, project list, session list, and user island sections as placeholder divs with proper CSS grid/flex layout.

**Step 4: Create chat view shell**

`ChatView.tsx` — renders the session header, message area (empty), and chat input bar as placeholder.

**Step 5: Build and verify**

```bash
cd client && bun run build
```

Then run the daemon and navigate to `http://localhost:2635`. Should see the shell layout.

**Step 6: Commit**

```bash
git add client/
git commit -m "feat(client): add React SPA shell with TanStack Router and layout"
```

---

### Task 7: WebSocket Hook + Connection

**Files:**
- Create: `client/src/hooks/useWebSocket.ts`
- Create: `client/src/providers/WebSocketProvider.tsx`
- Modify: `client/src/App.tsx`

**Step 1: WebSocket hook**

`useWebSocket.ts`:
- Connects to `ws(s)://host/ws`
- Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Parses incoming JSON as `ServerMessage`
- Provides `send(msg: ClientMessage)` function
- Exposes connection status: `connected`, `connecting`, `disconnected`
- Uses React context so all components share one connection

**Step 2: Provider component**

Wraps the app, creates the WebSocket, provides context.

**Step 3: Wire into App**

Wrap the router in the WebSocket provider.

**Step 4: Verify**

Run daemon + client dev. Browser console should show WebSocket connection. Daemon console should show "Client connected".

**Step 5: Commit**

```bash
git add client/src/hooks/ client/src/providers/
git commit -m "feat(client): add WebSocket connection with auto-reconnect"
```

---

### Task 8: Theme System

**Files:**
- Copy: `themes/` directory from Clay's theme JSON files
- Create: `client/src/hooks/useTheme.ts`
- Create: `client/src/stores/theme.ts`
- Create: `client/src/components/settings/Appearance.tsx`
- Create: `client/src/styles/themes.css`

**Step 1: Port theme JSON files**

Copy all `.json` theme files from Clay's `lib/themes/` to `themes/` in the Lattice root. These are base16-style theme definitions.

**Step 2: Theme store**

Uses `@tanstack/react-store`. Stores:
- Current mode (`"dark"` | `"light"`)
- Selected dark theme ID
- Selected light theme ID
- Persists to localStorage with keys `lattice-theme-dark`, `lattice-theme-light`, `lattice-theme-mode`

**Step 3: useTheme hook**

Reads the store, applies CSS variables to `document.documentElement` when theme changes.

**Step 4: Appearance component**

Shows all themes grouped by dark/light, with color swatches. Click to apply. Checkmark on active theme.

**Step 5: CSS variables**

`themes.css` defines the CSS variable names that all components reference:
```css
:root {
  --bg-primary: var(--theme-base00);
  --bg-secondary: var(--theme-base01);
  --text-primary: var(--theme-base05);
  /* etc */
}
```

**Step 6: Commit**

```bash
git add themes/ client/src/hooks/useTheme.ts client/src/stores/theme.ts client/src/components/settings/ client/src/styles/
git commit -m "feat(client): add theme system with per-variant persistence and appearance picker"
```

---

## Phase 3: Core Features

### Task 9: Session Management (Server)

**Files:**
- Create: `server/src/project/session.ts`
- Wire into WS router

JSONL-based session persistence. Port Clay's session manager pattern:
- `createSession(projectSlug)` → new JSONL file
- `activateSession(projectSlug, sessionId)` → load history from JSONL
- `appendToSession(sessionId, message)` → append line to JSONL
- `listSessions(projectSlug)` → read meta lines from all JSONL files
- `deleteSession(sessionId)` → remove JSONL file
- `renameSession(sessionId, title)` → update meta line

Register `session` handler in WS router.

**Commit:** `feat(server): add JSONL-based session manager`

---

### Task 10: SDK Bridge (Server)

**Files:**
- Create: `server/src/project/sdk-bridge.ts`
- Wire into session handler

Port Clay's SDK bridge pattern:
- Dynamic import of `@anthropic-ai/claude-agent-sdk`
- Async iterable message queue for feeding user messages to SDK
- Permission request/response flow with pending promises
- Stream deltas, tool starts, tool results to WS broadcast
- Model list via `stream.supportedModels()` + known models supplement
- Environment variable merging (global → project → session)

Register `chat` handler in WS router.

**Commit:** `feat(server): add Claude Agent SDK bridge with streaming and permissions`

---

### Task 11: Chat UI (Client)

**Files:**
- Create/modify chat components: `ChatView.tsx`, `Message.tsx`, `ChatInput.tsx`, `ModelSelector.tsx`
- Create: `client/src/hooks/useSession.ts`

Build the chat interface:
- Message list with TanStack Virtual for performance
- Streaming delta rendering (append text as it arrives)
- Tool call display (collapsible, shows name + args + result)
- Permission request UI (Allow/Deny buttons)
- Chat input with send button, keyboard shortcut (Enter to send, Shift+Enter for newline)
- Model selector dropdown (model, mode, effort, thinking)

**Commit:** `feat(client): add chat UI with streaming messages and model selector`

---

### Task 12: Session List + Project List (Client)

**Files:**
- Modify: `client/src/components/sidebar/` components

Build sidebar:
- Project list grouped by node (local only for now)
- Session list for active project with create/rename/delete
- Context menu on sessions (right-click)
- Active session highlighting

**Commit:** `feat(client): add sidebar with project and session lists`

---

### Task 13: File Browser (Server + Client)

**Files:**
- Create: `server/src/project/file-browser.ts`
- Create: `client/src/components/panels/FileBrowser.tsx`

Server:
- `listDirectory(projectPath, relativePath)` → FileEntry[]
- `readFile(projectPath, relativePath)` → string content
- `writeFile(projectPath, relativePath, content)` → void
- Path validation (resolve symlinks, prevent directory escape)
- File watcher using Bun's `fs.watch`

Client:
- Tree view with expand/collapse
- File preview with syntax highlighting
- File editor (basic textarea or CodeMirror if scope allows)
- Live reload on file changes

Register `fs` handler in WS router.

**Commit:** `feat: add file browser with safe path traversal and live reload`

---

### Task 14: Terminal (Server + Client)

**Files:**
- Create: `server/src/project/terminal.ts`
- Create: `client/src/components/panels/Terminal.tsx`

Server:
- PTY management with `node-pty` (or Bun-compatible alternative)
- Create/destroy terminals
- Relay stdin/stdout over WebSocket
- Handle resize events

Client:
- xterm.js integration with React
- Multi-tab terminal support
- Resize handling (fit addon)

Register `terminal` handler in WS router.

**Commit:** `feat: add PTY terminal with xterm.js and multi-tab support`

---

## Phase 4: Settings + UI Polish

### Task 15: Settings Panel (Client)

**Files:**
- Create: `client/src/components/settings/Settings.tsx` (modal shell)
- Create: `client/src/components/settings/Status.tsx`
- Create: `client/src/components/settings/ClaudeSettings.tsx`
- Create: `client/src/components/settings/Environment.tsx`
- Modify: `Appearance.tsx` (already created in Task 8)

Build the settings modal:
- Navigation sidebar with sections
- Status: node info, version, uptime
- Appearance: theme picker (already built)
- Claude Settings: CLAUDE.md editor (global + per-project)
- Environment: key-value editor for env vars
- Restart/Shutdown buttons

**Commit:** `feat(client): add settings panel with status, claude config, and environment`

---

### Task 16: User Island + First-Time Setup

**Files:**
- Create: `client/src/components/sidebar/UserIsland.tsx`
- Create: `client/src/components/setup/SetupWizard.tsx`

User island:
- Node name + version display
- Dark/light mode toggle
- Settings gear button

Setup wizard:
- Shown on first launch (no config exists)
- Steps: Welcome → Name → Theme → Security → Claude Settings → Add Project → Done
- Skippable steps
- Saves config on completion

**Commit:** `feat(client): add user island and first-time setup wizard`

---

## Phase 5: Mesh Networking

### Task 17: mDNS Discovery (Server)

**Files:**
- Create: `server/src/mesh/discovery.ts`

Using `multicast-dns` or `bonjour-service`:
- Broadcast `_lattice._tcp` service on startup
- Listen for other Lattice nodes
- Emit events when nodes appear/disappear
- Store discovered (unpaired) nodes for UI display

**Commit:** `feat(server): add mDNS service discovery for LAN nodes`

---

### Task 18: Pairing + Peer Management (Server)

**Files:**
- Create: `server/src/mesh/pairing.ts`
- Create: `server/src/mesh/peers.ts`

Pairing:
- Generate invite code: `LTCE-XXXX-XXXX` (base62 encoded address + one-time token)
- QR code generation (server-side with `qrcode` package)
- Handshake endpoint: validate token, exchange identity
- Store peer in `peers.json`

Peers:
- Load/save peer list from `~/.lattice/peers.json`
- Track online/offline status
- Unpair (remove from peer list)

Register `mesh` handler in WS router.

**Commit:** `feat(server): add node pairing with invite codes and QR generation`

---

### Task 19: Mesh Connector + Proxy (Server)

**Files:**
- Create: `server/src/mesh/connector.ts`
- Create: `server/src/mesh/proxy.ts`

Connector:
- Maintain WSS connections to all paired nodes
- Auto-reconnect with exponential backoff
- Send `mesh:hello` on connect with local project list
- Broadcast `mesh:node_online`/`mesh:node_offline` to browser clients

Proxy:
- When browser sends a message for a remote project, wrap in `mesh:proxy_request`
- When receiving `mesh:proxy_response`, unwrap and send to browser client
- For streaming (chat deltas), proxy each message individually

**Commit:** `feat(server): add mesh connector with WebSocket proxy for remote projects`

---

### Task 20: Mesh UI (Client)

**Files:**
- Create: `client/src/components/sidebar/NodeRail.tsx`
- Create: `client/src/components/mesh/PairingDialog.tsx`
- Create: `client/src/components/mesh/NodeBadge.tsx`
- Create: `client/src/components/settings/MeshStatus.tsx`
- Create: `client/src/hooks/useMesh.ts`
- Create: `client/src/stores/mesh.ts`

Node rail:
- Left edge icons for each connected node
- Local node first, then remote nodes
- Online/offline indicator
- Click to filter projects by node

Pairing dialog:
- Generate invite button → shows code + QR
- Input field for entering a received code
- Status feedback during handshake

Mesh status (in settings):
- List of paired nodes with latency, connection status
- Unpair button per node

**Commit:** `feat(client): add mesh UI with node rail, pairing dialog, and status panel`

---

## Phase 6: Advanced Features

### Task 21: Ralph Loop (Server + Client)

Port Clay's autonomous iteration system:
- Server: Loop runner that executes PROMPT.md, evaluates with JUDGE.md
- Server: Up to 20 iterations per loop, fresh session each
- Server: Git-aware (commit per iteration)
- Client: Loop status UI, iteration counter, judge feedback

**Commit:** `feat: add Ralph Loop autonomous iteration system`

---

### Task 22: Scheduler (Server + Client)

Port Clay's cron-based task scheduling:
- Server: 5-field cron expressions, 30-second polling
- Server: Persist schedules in JSONL
- Client: Cron editor UI, schedule list, enable/disable

**Commit:** `feat: add cron-based task scheduler`

---

### Task 23: Sticky Notes (Server + Client)

Port Clay's sticky notes:
- Server: JSONL persistence, CRUD operations
- Client: Notes panel, markdown rendering

**Commit:** `feat: add sticky notes with JSONL persistence`

---

### Task 24: PWA + Mobile

- PWA manifest + service worker
- Mobile responsive layout
- Swipe navigation (sidebar show/hide)
- Touch-friendly controls

**Commit:** `feat: add PWA support and mobile responsive layout`

---

### Task 25: Optional Passphrase Auth

**Files:**
- Modify: `server/src/auth/passphrase.ts`
- Create: `client/src/components/auth/PassphrasePrompt.tsx`

Server:
- Hash passphrase with scrypt
- Cookie-based session after authentication
- Skip auth if no passphrase configured

Client:
- Passphrase prompt shown when server requires auth
- Set/change/remove passphrase in settings

**Commit:** `feat: add optional passphrase authentication`

---

## Phase 7: Polish + Production

### Task 26: TLS + Auto-Certs

Auto-generate self-signed TLS certificates on first run. Store in `~/.lattice/certs/`. Serve over HTTPS when certs are available.

**Commit:** `feat: add auto-generated TLS certificates`

---

### Task 27: Daemon CLI (spawn/stop/status)

Full daemon lifecycle management:
- `lattice` → spawn daemon if not running, open browser
- `lattice stop` → send stop command via IPC socket
- `lattice daemon` → foreground mode for systemd
- PID file management
- Log rotation

**Commit:** `feat: add daemon spawn/stop/status CLI commands`

---

### Task 28: Error Handling + Reconnection

- WebSocket reconnection with state recovery
- Graceful degradation when mesh nodes go offline
- Error boundaries in React
- Toast notifications for errors

**Commit:** `feat: add error handling, reconnection, and error boundaries`
