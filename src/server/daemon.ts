import { join, resolve } from "node:path";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, writeFileSync, existsSync, createReadStream } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { lookup } from "node:dns";
import express from "express";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { getClientDir } from "./assets";
import { getLatticeHome, loadConfig } from "./config";
import { loadOrCreateIdentity } from "./identity";
import { addClient, removeClient, routeMessage } from "./ws/server";
import { broadcast, broadcastToProject, sendTo, markClientAlive, startHeartbeat, subscribeClientToProject } from "./ws/broadcast";
import { buildNodesMessage } from "./handlers/mesh";
import { startDiscovery } from "./mesh/discovery";
import { startMeshConnections, onPeerConnected, onPeerDisconnected, onPeerMessage, getAllRemoteProjects } from "./mesh/connector";
import { handleProxyRequest, handleProxyResponse } from "./mesh/proxy";
import { verifyPassphrase, generateSessionToken, addSession, isValidSession } from "./auth/passphrase";
import type { ClientMessage, MeshMessage } from "#shared";
import { log } from "./logger";
import { detectIdeProjectName } from "./handlers/settings";
import "./handlers/session";
import "./handlers/chat";
import "./handlers/attachment";
import { loadInterruptedSessions, cleanupClientPermissions, cleanupClientElicitations, getActiveStreamCountForProject } from "./project/sdk-bridge";
import { runWarmup, isWarmupComplete, getWarmupModels, getWarmupAccountInfo, getWarmupRateLimits } from "./project/warmup";
import { clearActiveSession } from "./handlers/chat";
import { clearActiveProject } from "./handlers/fs";
import { clearClientRemoteNode } from "./ws/router";
import "./handlers/fs";
import "./handlers/terminal";
import "./handlers/settings";
import "./handlers/project-settings";
import "./handlers/mesh";
import "./handlers/loop";
import "./handlers/scheduler";
import "./handlers/notes";
import "./handlers/skills";
import "./handlers/memory";
import "./handlers/editor";
import "./handlers/analytics";
import "./handlers/bookmarks";
import "./handlers/brainstorm";
import "./handlers/plugins";
import "./handlers/update";
import "./handlers/themes";
import "./handlers/specs";
import "./handlers/superpowers";
import { installHooks } from "./handlers/context-hooks";
import { handleHookStatusline, handleHookEvent, handleHookToolUse } from "./handlers/hooks";
import { startScheduler } from "./features/scheduler";
import { loadNotes } from "./features/sticky-notes";
import { loadSessionHistory, listSessions as listHistoricalSessions, getSession as getHistoricalSession } from "./features/session-history";
import { loadSpecs, onSpecsReloaded, listSpecs } from "./features/specs";
import { startPeriodicUpdateCheck, getCachedUpdateInfo } from "./update-checker";
import { loadBookmarks } from "./project/bookmarks";
import { listSessions } from "./project/session";
import { startBrainstormWatchers } from "./features/brainstorm";
import { initSuperpowers } from "./features/superpowers";
import { cleanupClientTerminals } from "./handlers/terminal";
import { cleanupClient as cleanupClientAttachments } from "./handlers/attachment";
import { initPush, getVapidPublicKey, addPushSubscription } from "./push";

const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 100;
const clientRateLimits = new Map<string, { count: number; windowStart: number }>();
const wsClientIds = new WeakMap<WebSocket, string>();

function parseCookies(cookieHeader: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = cookieHeader.split(";");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    map.set(key, value);
  }
  return map;
}

function isAuthenticatedReq(req: IncomingMessage, passphraseHash: string | undefined): boolean {
  if (!passphraseHash) {
    return true;
  }
  const cookieHeader = req.headers.cookie || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies.get("lattice_auth");
  if (!token) {
    return false;
  }
  return isValidSession(token);
}

function buildLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lattice — Authenticate</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      background: #0d0d0d;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 2.5rem;
      width: 100%;
      max-width: 360px;
    }
    h1 {
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #a0a0a0;
      margin-bottom: 1.75rem;
    }
    label {
      display: block;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #606060;
      margin-bottom: 0.4rem;
    }
    input[type="password"] {
      width: 100%;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 0.9rem;
      padding: 0.6rem 0.75rem;
      outline: none;
      transition: border-color 0.15s;
    }
    input[type="password"]:focus { border-color: #4a4a4a; }
    button {
      width: 100%;
      margin-top: 1.25rem;
      background: #e0e0e0;
      color: #0d0d0d;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.65rem;
      cursor: pointer;
      transition: background 0.15s;
    }
    button:hover { background: #c0c0c0; }
    .error {
      margin-top: 0.85rem;
      font-size: 0.78rem;
      color: #c07070;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Lattice</h1>
    <form id="form">
      <label for="passphrase">Passphrase</label>
      <input type="password" id="passphrase" name="passphrase" autofocus autocomplete="current-password" />
      <button type="submit">Authenticate</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  <script>
    document.getElementById('form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const passphrase = document.getElementById('passphrase').value;
      try {
        const res = await fetch('/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase: passphrase })
        });
        if (res.ok) {
          window.location.reload();
        } else {
          document.getElementById('error').textContent = 'Invalid passphrase.';
        }
      } catch {
        document.getElementById('error').textContent = 'Connection error.';
      }
    });
  </script>
</body>
</html>`;
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop() || "";
  const mimeTypes: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    ico: "image/x-icon",
    webmanifest: "application/manifest+json",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    txt: "text/plain",
    map: "application/json",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function handleWsOpen(ws: WebSocket, clientId: string): void {
  wsClientIds.set(ws, clientId);
  addClient(clientId, ws);
  log.ws("Client connected: %s", clientId);
  sendTo(clientId, { type: "mesh:nodes", nodes: buildNodesMessage() });
  const connectConfig = loadConfig();
  const connectIdentity = loadOrCreateIdentity();
  const localProjects = connectConfig.projects.map(function (p: typeof connectConfig.projects[number]) {
    return { slug: p.slug, path: p.path, title: p.title, nodeId: connectIdentity.id, nodeName: connectConfig.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path), activeSessions: getActiveStreamCountForProject(p.slug) };
  });
  const connectRemoteProjects = getAllRemoteProjects(connectIdentity.id);
  sendTo(clientId, {
    type: "projects:list",
    projects: localProjects.concat(connectRemoteProjects as unknown as typeof localProjects),
  });
  if (isWarmupComplete()) {
    sendTo(clientId, { type: "warmup:models", models: getWarmupModels() } as any);
    const accountInfo = getWarmupAccountInfo();
    if (accountInfo) {
      sendTo(clientId, {
        type: "warmup:account",
        email: accountInfo.email,
        organization: accountInfo.organization,
        subscriptionType: accountInfo.subscriptionType,
        apiKeySource: accountInfo.apiKeySource,
        apiProvider: accountInfo.apiProvider,
      } as any);
    }
    const cachedRateLimits = getWarmupRateLimits();
    for (let rli = 0; rli < cachedRateLimits.length; rli++) {
      const rl = cachedRateLimits[rli];
      sendTo(clientId, {
        type: "chat:rate_limit",
        status: rl.status,
        utilization: rl.utilization,
        resetsAt: rl.resetsAt,
        rateLimitType: rl.rateLimitType,
        overageStatus: rl.overageStatus,
        overageResetsAt: rl.overageResetsAt,
        isUsingOverage: rl.isUsingOverage,
      } as any);
    }
  }
  for (let pi = 0; pi < connectConfig.projects.length; pi++) {
    const proj = connectConfig.projects[pi];
    subscribeClientToProject(clientId, proj.slug);
    void listSessions(proj.slug, { limit: 40 }).then(function (result) {
      sendTo(clientId, {
        type: "session:list",
        projectSlug: proj.slug,
        sessions: result.sessions,
        totalCount: result.totalCount,
        offset: 0,
      });
    }).catch(function (err) {
      log.session("Failed to pre-populate sessions for %s: %O", proj.slug, err);
    });
  }
}

function handleWsMessage(ws: WebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
  const clientId = wsClientIds.get(ws);
  if (!clientId) return;

  const now = Date.now();
  let limit = clientRateLimits.get(clientId);
  if (!limit || now - limit.windowStart > RATE_LIMIT_WINDOW) {
    limit = { count: 0, windowStart: now };
    clientRateLimits.set(clientId, limit);
  }
  limit.count++;
  if (limit.count > RATE_LIMIT_MAX) {
    sendTo(clientId, { type: "chat:error", message: "Rate limit exceeded, please slow down" });
    return;
  }

  const text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString() : Buffer.from(data as ArrayBuffer).toString();
  try {
    const msg = JSON.parse(text) as ClientMessage;
    routeMessage(clientId, msg);
  } catch (err) {
    log.ws("Invalid JSON message: %O", err);
  }
}

function handleWsClose(ws: WebSocket): void {
  const clientId = wsClientIds.get(ws);
  if (!clientId) return;
  clearActiveSession(clientId);
  clearActiveProject(clientId);
  clearClientRemoteNode(clientId);
  removeClient(clientId);
  cleanupClientTerminals(clientId);
  cleanupClientAttachments(clientId);
  cleanupClientPermissions(clientId);
  cleanupClientElicitations(clientId);
  clientRateLimits.delete(clientId);
  wsClientIds.delete(ws);
  log.ws("Client disconnected: %s", clientId);
}

export async function startDaemon(portOverride?: number | null, tlsOverride?: boolean | null): Promise<void> {
  const config = loadConfig();
  const effectivePort = (portOverride && !isNaN(portOverride)) ? portOverride : config.port;
  if (tlsOverride !== null && tlsOverride !== undefined) {
    config.tls = tlsOverride;
  }
  const identity = loadOrCreateIdentity();

  log.server("Node: %s (%s)", config.name, identity.id);
  log.server("Home: %s", getLatticeHome());

  const clientDir = getClientDir();

  const app = express();
  app.use(express.json());

  const authAttempts = new Map<string, number[]>();
  const AUTH_RATE_LIMIT = 5;
  const AUTH_RATE_WINDOW = 60000;

  app.post("/auth", async function (req, res) {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let attempts = authAttempts.get(ip) || [];
    attempts = attempts.filter(function (t) { return now - t < AUTH_RATE_WINDOW; });

    if (attempts.length >= AUTH_RATE_LIMIT) {
      res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });
      return;
    }

    attempts.push(now);
    authAttempts.set(ip, attempts);

    const passphrase = (req.body as { passphrase?: string }).passphrase || "";
    if (!config.passphraseHash || (await verifyPassphrase(passphrase, config.passphraseHash))) {
      const token = generateSessionToken();
      addSession(token);
      res.setHeader("Set-Cookie", "lattice_auth=" + token + "; HttpOnly; Path=/; SameSite=Strict");
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false });
    }
  });

  app.use(function (req, res, next) {
    if (req.path === "/ws" || req.path === "/auth" || req.path.startsWith("/api/hook/")) {
      next();
      return;
    }
    if (!isAuthenticatedReq(req, config.passphraseHash)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(buildLoginPage());
      return;
    }
    next();
  });

  app.get("/api/vapid-public-key", function (_req, res) {
    res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push-subscribe", function (req, res) {
    try {
      const pushBody = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
      addPushSubscription(pushBody);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.post("/api/hook/statusline", handleHookStatusline);
  app.post("/api/hook/event", handleHookEvent);
  app.post("/api/hook/tool_use", handleHookToolUse);

  app.get("/api/session-history", function (req, res) {
    const projectSlug = req.query.project as string | undefined;
    const activeParam = req.query.active as string | undefined;
    const limitParam = req.query.limit as string | undefined;
    const sessions = listHistoricalSessions({
      projectSlug: projectSlug || undefined,
      active: activeParam === "true" ? true : activeParam === "false" ? false : undefined,
      limit: limitParam ? parseInt(limitParam, 10) : 100,
    });
    res.json(sessions.map(function (s) {
      return { ...s, toolEvents: undefined, toolDeltas: undefined, toolEventCount: s.toolEvents.length, toolDeltaCount: s.toolDeltas.length };
    }));
  });

  app.get("/api/session-history/:id", function (req, res) {
    const session = getHistoricalSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(session);
  });

  app.get("/api/file", async function (req, res) {
    const reqFilePath = req.query.path as string | undefined;
    if (!reqFilePath) {
      res.status(400).send("Missing path parameter");
      return;
    }

    let resolved: string | null = null;

    for (let pi = 0; pi < config.projects.length; pi++) {
      const projectPath = resolve(config.projects[pi].path);
      const candidate = resolve(projectPath, reqFilePath);
      if (candidate.startsWith(projectPath + "/") && existsSync(candidate)) {
        resolved = candidate;
        break;
      }
    }

    if (!resolved) {
      res.status(404).send("File not found");
      return;
    }

    const fileStat = await fsStat(resolved);
    res.setHeader("Content-Type", getMimeType(resolved));
    res.setHeader("Content-Length", fileStat.size);
    createReadStream(resolved).pipe(res);
  });

  let tlsOptions: { cert: Buffer; key: Buffer } | undefined;
  if (config.tls) {
    const certsDir = join(getLatticeHome(), "certs");
    const certPath = join(certsDir, "cert.pem");
    const keyPath = join(certsDir, "key.pem");

    if (existsSync(certPath) && existsSync(keyPath)) {
      try {
        tlsOptions = {
          cert: readFileSync(certPath),
          key: readFileSync(keyPath),
        };
        log.server("TLS enabled (cert: %s)", certPath);
      } catch (err: any) {
        if (err?.code === "EACCES") {
          console.error("[lattice] Permission denied reading TLS certs. Run 'lattice setup-tls' to fix permissions.");
        } else {
          console.error("[lattice] Failed to load TLS certs, falling back to HTTP:", err);
        }
      }
    } else {
      console.error("[lattice] TLS enabled but no certs found. Run 'lattice setup-tls' to generate them.");
    }
  }

  const protocol = tlsOptions ? "https" : "http";
  const httpServer = tlsOptions
    ? createHttpsServer(tlsOptions, app)
    : createHttpServer(app);

  const isDev = process.env.NODE_ENV === "development";
  const { loadAllThemes } = await import("./handlers/themes");

  async function getThemeInjectionScript(): Promise<string> {
    try {
      const customThemes = await loadAllThemes();
      if (customThemes.length === 0) return "";
      return "<script>window.__LATTICE_CUSTOM_THEMES__=" + JSON.stringify(customThemes) + "</script>";
    } catch {
      return "";
    }
  }

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: "spa",
      plugins: [{
        name: "lattice-inject-themes",
        transformIndexHtml: {
          order: "post",
          handler: async function () {
            const script = await getThemeInjectionScript();
            if (!script) return [];
            return [{ tag: "script", attrs: {}, children: "window.__LATTICE_CUSTOM_THEMES__=" + JSON.stringify(await loadAllThemes()), injectTo: "head" }];
          },
        },
      }],
    });
    app.use(vite.middlewares);
    log.server("Vite dev server attached (middleware mode, HMR on same port)");
  } else if (clientDir && existsSync(clientDir)) {
    app.use(express.static(clientDir, { dotfiles: "allow" }));
    app.get("/{*path}", async function (_req, res) {
      const indexPath = join(clientDir!, "index.html");
      if (existsSync(indexPath)) {
        let html = readFileSync(indexPath, "utf-8");
        const injection = await getThemeInjectionScript();
        if (injection) {
          html = html.replace("</head>", injection + "</head>");
        }
        res.setHeader("Content-Type", "text/html");
        res.send(html);
      } else {
        res.status(404).send("Not found");
      }
    });
  }

  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: {
      zlibDeflateOptions: { level: 1 },
      threshold: 128,
    },
  });

  httpServer.on("upgrade", function (req: IncomingMessage, socket, head) {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/ws") {
      return;
    }
    if (!isAuthenticatedReq(req, config.passphraseHash)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, function (ws) {
      const clientId = crypto.randomUUID();
      handleWsOpen(ws, clientId);
      ws.on("pong", function () { markClientAlive(clientId); });
      ws.on("message", function (data) { handleWsMessage(ws, data as Buffer); });
      ws.on("close", function () { handleWsClose(ws); });
    });
  });

  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await new Promise<void>(function (resolveP, reject) {
        httpServer.once("error", function (err: NodeJS.ErrnoException) {
          if (err.code === "EADDRINUSE" && attempt < maxRetries - 1) {
            log.server("Port %d in use, retrying in 1s (%d/%d)...", effectivePort, attempt + 1, maxRetries);
            setTimeout(function () { resolveP(); }, 1000);
          } else {
            reject(err);
          }
        });
        httpServer.listen(effectivePort, "0.0.0.0", function () {
          resolveP();
        });
      });
      if (httpServer.listening) break;
    } catch (err) {
      throw err;
    }
  }

  log.server("Listening on %s://0.0.0.0:%d", protocol, effectivePort);

  // Write runtime port so hook scripts can find it
  writeFileSync(join(getLatticeHome(), "port"), String(effectivePort));

  startHeartbeat(function (deadClientId) {
    clearActiveSession(deadClientId);
    clearActiveProject(deadClientId);
    clearClientRemoteNode(deadClientId);
    removeClient(deadClientId);
    cleanupClientTerminals(deadClientId);
    cleanupClientAttachments(deadClientId);
    cleanupClientPermissions(deadClientId);
    cleanupClientElicitations(deadClientId);
    clientRateLimits.delete(deadClientId);
    log.ws("Client removed via heartbeat: %s", deadClientId);
  });

  startDiscovery(identity.id, config.name, effectivePort);
  startMeshConnections();
  startScheduler();
  loadNotes();
  loadSessionHistory();
  loadSpecs();
  onSpecsReloaded(function () {
    const allSpecs = listSpecs();
    const slugs = new Set(allSpecs.map(function (s) { return s.projectSlug; }));
    for (const slug of slugs) {
      broadcastToProject(slug, { type: "specs:list_result", specs: listSpecs(slug) });
    }
  });
  loadBookmarks();
  startBrainstormWatchers();
  initSuperpowers();
  startPeriodicUpdateCheck();
  const hookResult = installHooks();
  if (hookResult.success) {
    log.server("Claude Code hooks installed/updated");
  } else {
    log.server("Failed to install hooks: %s", hookResult.message);
  }
  loadInterruptedSessions();
  initPush();

  const firstProject = config.projects[0];
  if (firstProject) {
    void runWarmup(firstProject.path);
  }

  let meshDirty = true;
  let lastNodesJson = "";
  let lastProjectsJson = "";
  let broadcastTick = 0;

  onPeerConnected(function (nodeId: string) {
    meshDirty = true;
    broadcast({ type: "mesh:node_online", nodeId: nodeId });
  });

  onPeerDisconnected(function (nodeId: string) {
    meshDirty = true;
    broadcast({ type: "mesh:node_offline", nodeId: nodeId });
  });

  onPeerMessage(function (nodeId: string, msg: MeshMessage) {
    if (msg.type === "mesh:proxy_request") {
      handleProxyRequest(nodeId, msg);
      return;
    }
    if (msg.type === "mesh:proxy_response") {
      handleProxyResponse(msg);
      return;
    }
  });

  setInterval(function () {
    broadcastTick++;

    if (meshDirty) {
      const nodesPayload = buildNodesMessage();
      const nodesJson = JSON.stringify(nodesPayload);
      if (nodesJson !== lastNodesJson) {
        lastNodesJson = nodesJson;
        broadcast({ type: "mesh:nodes", nodes: nodesPayload });
      }
      meshDirty = false;
    }

    const currentConfig = loadConfig();
    const currentIdentity = loadOrCreateIdentity();
    const localProjects = currentConfig.projects.map(function (p: typeof currentConfig.projects[number]) {
      return { slug: p.slug, path: p.path, title: p.title, nodeId: currentIdentity.id, nodeName: currentConfig.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path), activeSessions: getActiveStreamCountForProject(p.slug) };
    });
    const remoteProjects = getAllRemoteProjects(currentIdentity.id);
    const allProjects = localProjects.concat(remoteProjects as unknown as typeof localProjects);
    const projectsJson = JSON.stringify(allProjects);
    if (projectsJson !== lastProjectsJson) {
      lastProjectsJson = projectsJson;
      broadcast({ type: "projects:list", projects: allProjects });
    }

    if (broadcastTick % 3 === 0) {
      const updateInfo = getCachedUpdateInfo();
      if (updateInfo && updateInfo.updateAvailable) {
        broadcast({
          type: "update:status",
          currentVersion: updateInfo.currentVersion,
          latestVersion: updateInfo.latestVersion,
          updateAvailable: updateInfo.updateAvailable,
          releaseUrl: updateInfo.releaseUrl,
          installMode: updateInfo.installMode,
        });
      }
    }
  }, 10000);
}
