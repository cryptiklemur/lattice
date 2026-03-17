import { join } from "node:path";
import type { ServerWebSocket } from "bun";
import { getLatticeHome, loadConfig } from "./config";
import { loadOrCreateIdentity } from "./identity";
import { addClient, removeClient, routeMessage } from "./ws/server";
import { broadcast } from "./ws/broadcast";
import { startDiscovery } from "./mesh/discovery";
import { startMeshConnections, onPeerConnected, onPeerDisconnected, onPeerMessage } from "./mesh/connector";
import { handleProxyRequest, handleProxyResponse } from "./mesh/proxy";
import { verifyPassphrase, generateSessionToken, addSession, isValidSession } from "./auth/passphrase";
import type { ClientMessage, MeshMessage } from "@lattice/shared";
import "./handlers/session";
import "./handlers/chat";
import "./handlers/fs";
import "./handlers/terminal";
import "./handlers/settings";
import "./handlers/mesh";
import "./handlers/loop";

interface WsData {
  id: string;
}

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

function isAuthenticated(req: Request, passphraseHash: string | undefined): boolean {
  if (!passphraseHash) {
    return true;
  }
  var cookieHeader = req.headers.get("cookie") || "";
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

export async function startDaemon(): Promise<void> {
  var config = loadConfig();
  var identity = loadOrCreateIdentity();

  console.log(`[lattice] Node: ${config.name} (${identity.id})`);
  console.log(`[lattice] Home: ${getLatticeHome()}`);

  var clientDir = join(import.meta.dir, "../../client/dist");

  Bun.serve<WsData>({
    port: config.port,
    hostname: "0.0.0.0",

    async fetch(req: Request, server: ReturnType<typeof Bun.serve>) {
      var url = new URL(req.url);

      if (url.pathname === "/auth" && req.method === "POST") {
        try {
          var body = await req.json() as { passphrase?: string };
          var passphrase = body.passphrase || "";
          if (!config.passphraseHash || verifyPassphrase(passphrase, config.passphraseHash)) {
            var token = generateSessionToken();
            addSession(token);
            var headers = new Headers();
            headers.set("Content-Type", "application/json");
            headers.set("Set-Cookie", "lattice_auth=" + token + "; HttpOnly; Path=/; SameSite=Strict");
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
          }
          return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });
        } catch {
          return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
      }

      if (!isAuthenticated(req, config.passphraseHash)) {
        return new Response(buildLoginPage(), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (url.pathname === "/ws") {
        var upgraded = server.upgrade(req, {
          data: { id: crypto.randomUUID() },
        });
        if (upgraded) {
          return undefined;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      var filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      var file = Bun.file(join(clientDir, filePath));
      if (await file.exists()) {
        return new Response(file);
      }

      var index = Bun.file(join(clientDir, "index.html"));
      if (await index.exists()) {
        return new Response(index);
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        addClient(ws);
        console.log(`[lattice] Client connected: ${ws.data.id}`);
      },
      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        var text = typeof message === "string" ? message : message.toString();
        try {
          var msg = JSON.parse(text) as ClientMessage;
          routeMessage(ws.data.id, msg);
        } catch (err) {
          console.error("[lattice] Invalid JSON message:", err);
        }
      },
      close(ws: ServerWebSocket<WsData>) {
        removeClient(ws.data.id);
        console.log(`[lattice] Client disconnected: ${ws.data.id}`);
      },
    },
  });

  console.log(`[lattice] Listening on http://0.0.0.0:${config.port}`);

  startDiscovery(identity.id, config.name, config.port);

  startMeshConnections();

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
}
