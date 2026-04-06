import { join, resolve } from "node:path";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync, existsSync, createReadStream, statSync } from "node:fs";
import { lookup } from "node:dns";
import express from "express";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { getClientDir } from "./assets";
import { getLatticeHome, loadConfig } from "./config";
import { loadOrCreateIdentity } from "./identity";
import { addClient, removeClient, routeMessage } from "./ws/server";
import { broadcast, sendTo } from "./ws/broadcast";
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
import "./handlers/plugins";
import "./handlers/update";
import "./handlers/themes";
import { startScheduler } from "./features/scheduler";
import { loadNotes } from "./features/sticky-notes";
import { startPeriodicUpdateCheck, getCachedUpdateInfo } from "./update-checker";
import { loadBookmarks } from "./project/bookmarks";
import { cleanupClientTerminals } from "./handlers/terminal";
import { cleanupClient as cleanupClientAttachments } from "./handlers/attachment";
import { initPush, getVapidPublicKey, addPushSubscription } from "./push";

var RATE_LIMIT_WINDOW = 10000;
var RATE_LIMIT_MAX = 100;
var clientRateLimits = new Map<string, { count: number; windowStart: number }>();
var wsClientIds = new WeakMap<WebSocket, string>();

function parseCookies(cookieHeader: string): Map<string, string> {
  var map = new Map<string, string>();
  var parts = cookieHeader.split(";");
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    var eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    var key = part.slice(0, eqIdx).trim();
    var value = part.slice(eqIdx + 1).trim();
    map.set(key, value);
  }
  return map;
}

function isAuthenticatedReq(req: IncomingMessage, passphraseHash: string | undefined): boolean {
  if (!passphraseHash) {
    return true;
  }
  var cookieHeader = req.headers.cookie || "";
  var cookies = parseCookies(cookieHeader);
  var token = cookies.get("lattice_auth");
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
      var passphrase = document.getElementById('passphrase').value;
      try {
        var res = await fetch('/auth', {
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
  var ext = filePath.split(".").pop() || "";
  var mimeTypes: Record<string, string> = {
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
  var connectConfig = loadConfig();
  var connectIdentity = loadOrCreateIdentity();
  var localProjects = connectConfig.projects.map(function (p: typeof connectConfig.projects[number]) {
    return { slug: p.slug, path: p.path, title: p.title, nodeId: connectIdentity.id, nodeName: connectConfig.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path), activeSessions: getActiveStreamCountForProject(p.slug) };
  });
  var connectRemoteProjects = getAllRemoteProjects(connectIdentity.id);
  sendTo(clientId, {
    type: "projects:list",
    projects: localProjects.concat(connectRemoteProjects as unknown as typeof localProjects),
  });
  if (isWarmupComplete()) {
    sendTo(clientId, { type: "warmup:models", models: getWarmupModels() } as any);
    var accountInfo = getWarmupAccountInfo();
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
    var cachedRateLimits = getWarmupRateLimits();
    for (var rli = 0; rli < cachedRateLimits.length; rli++) {
      var rl = cachedRateLimits[rli];
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
}

function handleWsMessage(ws: WebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
  var clientId = wsClientIds.get(ws);
  if (!clientId) return;

  var now = Date.now();
  var limit = clientRateLimits.get(clientId);
  if (!limit || now - limit.windowStart > RATE_LIMIT_WINDOW) {
    limit = { count: 0, windowStart: now };
    clientRateLimits.set(clientId, limit);
  }
  limit.count++;
  if (limit.count > RATE_LIMIT_MAX) {
    sendTo(clientId, { type: "chat:error", message: "Rate limit exceeded, please slow down" });
    return;
  }

  var text = typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString() : Buffer.from(data as ArrayBuffer).toString();
  try {
    var msg = JSON.parse(text) as ClientMessage;
    routeMessage(clientId, msg);
  } catch (err) {
    log.ws("Invalid JSON message: %O", err);
  }
}

function handleWsClose(ws: WebSocket): void {
  var clientId = wsClientIds.get(ws);
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
  var config = loadConfig();
  var effectivePort = (portOverride && !isNaN(portOverride)) ? portOverride : config.port;
  if (tlsOverride !== null && tlsOverride !== undefined) {
    config.tls = tlsOverride;
  }
  var identity = loadOrCreateIdentity();

  log.server("Node: %s (%s)", config.name, identity.id);
  log.server("Home: %s", getLatticeHome());

  var clientDir = getClientDir();

  var app = express();
  app.use(express.json());

  var authAttempts = new Map<string, number[]>();
  var AUTH_RATE_LIMIT = 5;
  var AUTH_RATE_WINDOW = 60000;

  app.post("/auth", async function (req, res) {
    var ip = req.ip || req.socket.remoteAddress || "unknown";
    var now = Date.now();
    var attempts = authAttempts.get(ip) || [];
    attempts = attempts.filter(function (t) { return now - t < AUTH_RATE_WINDOW; });

    if (attempts.length >= AUTH_RATE_LIMIT) {
      res.status(429).json({ ok: false, error: "Too many attempts. Try again later." });
      return;
    }

    attempts.push(now);
    authAttempts.set(ip, attempts);

    var passphrase = (req.body as { passphrase?: string }).passphrase || "";
    if (!config.passphraseHash || await verifyPassphrase(passphrase, config.passphraseHash)) {
      var token = generateSessionToken();
      addSession(token);
      res.setHeader("Set-Cookie", "lattice_auth=" + token + "; HttpOnly; Path=/; SameSite=Strict");
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false });
    }
  });

  app.use(function (req, res, next) {
    if (req.path === "/ws" || req.path === "/auth") {
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
      var pushBody = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
      addPushSubscription(pushBody);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.get("/api/file", function (req, res) {
    var reqFilePath = req.query.path as string | undefined;
    if (!reqFilePath) {
      res.status(400).send("Missing path parameter");
      return;
    }

    var resolved: string | null = null;

    for (var pi = 0; pi < config.projects.length; pi++) {
      var projectPath = resolve(config.projects[pi].path);
      var candidate = resolve(projectPath, reqFilePath);
      if (candidate.startsWith(projectPath + "/") && existsSync(candidate)) {
        resolved = candidate;
        break;
      }
    }

    if (!resolved) {
      res.status(404).send("File not found");
      return;
    }

    var stat = statSync(resolved);
    res.setHeader("Content-Type", getMimeType(resolved));
    res.setHeader("Content-Length", stat.size);
    createReadStream(resolved).pipe(res);
  });

  var tlsOptions: { cert: Buffer; key: Buffer } | undefined;
  if (config.tls) {
    var certsDir = join(getLatticeHome(), "certs");
    var certPath = join(certsDir, "cert.pem");
    var keyPath = join(certsDir, "key.pem");

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

  var protocol = tlsOptions ? "https" : "http";
  var httpServer = tlsOptions
    ? createHttpsServer(tlsOptions, app)
    : createHttpServer(app);

  var isDev = process.env.NODE_ENV === "development";
  var { loadAllThemes } = await import("./handlers/themes");

  async function getThemeInjectionScript(): Promise<string> {
    try {
      var customThemes = await loadAllThemes();
      if (customThemes.length === 0) return "";
      return "<script>window.__LATTICE_CUSTOM_THEMES__=" + JSON.stringify(customThemes) + "</script>";
    } catch {
      return "";
    }
  }

  if (isDev) {
    var { createServer: createViteServer } = await import("vite");
    var vite = await createViteServer({
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
            var script = await getThemeInjectionScript();
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
      var indexPath = join(clientDir!, "index.html");
      if (existsSync(indexPath)) {
        var html = readFileSync(indexPath, "utf-8");
        var injection = await getThemeInjectionScript();
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

  var wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", function (req: IncomingMessage, socket, head) {
    var url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/ws") {
      return;
    }
    if (!isAuthenticatedReq(req, config.passphraseHash)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, function (ws) {
      var clientId = crypto.randomUUID();
      handleWsOpen(ws, clientId);
      ws.on("message", function (data) { handleWsMessage(ws, data as Buffer); });
      ws.on("close", function () { handleWsClose(ws); });
    });
  });

  var maxRetries = 10;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
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

  startDiscovery(identity.id, config.name, effectivePort);
  startMeshConnections();
  startScheduler();
  loadNotes();
  loadBookmarks();
  startPeriodicUpdateCheck();
  loadInterruptedSessions();
  initPush();

  var firstProject = config.projects[0];
  if (firstProject) {
    void runWarmup(firstProject.path);
  }

  onPeerConnected(function (nodeId: string) {
    broadcast({ type: "mesh:node_online", nodeId: nodeId });
  });

  onPeerDisconnected(function (nodeId: string) {
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

  var lastNodesHash = "";
  var lastProjectsHash = "";
  setInterval(function () {
    var nodesPayload = buildNodesMessage();
    var nodesHash = JSON.stringify(nodesPayload);
    if (nodesHash !== lastNodesHash) {
      lastNodesHash = nodesHash;
      broadcast({ type: "mesh:nodes", nodes: nodesPayload });
    }

    var currentConfig = loadConfig();
    var currentIdentity = loadOrCreateIdentity();
    var localProjects = currentConfig.projects.map(function (p: typeof currentConfig.projects[number]) {
      return { slug: p.slug, path: p.path, title: p.title, nodeId: currentIdentity.id, nodeName: currentConfig.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path), activeSessions: getActiveStreamCountForProject(p.slug) };
    });
    var remoteProjects = getAllRemoteProjects(currentIdentity.id);
    var allProjects = localProjects.concat(remoteProjects as unknown as typeof localProjects);
    var projectsHash = JSON.stringify(allProjects);
    if (projectsHash !== lastProjectsHash) {
      lastProjectsHash = projectsHash;
      broadcast({ type: "projects:list", projects: allProjects });
    }

    var updateInfo = getCachedUpdateInfo();
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
  }, 10000);
}
