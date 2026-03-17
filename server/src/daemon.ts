import { join } from "node:path";
import type { ServerWebSocket } from "bun";
import { getLatticeHome, loadConfig } from "./config";
import { loadOrCreateIdentity } from "./identity";
import { addClient, removeClient, routeMessage } from "./ws/server";
import { startDiscovery } from "./mesh/discovery";
import type { ClientMessage } from "@lattice/shared";
import "./handlers/session";
import "./handlers/chat";
import "./handlers/fs";
import "./handlers/terminal";
import "./handlers/settings";
import "./handlers/mesh";

interface WsData {
  id: string;
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
        } catch {
          console.error("[lattice] Invalid JSON message");
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
}
