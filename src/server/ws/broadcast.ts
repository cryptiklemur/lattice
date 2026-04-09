import type { WebSocket } from "ws";
import { log } from "../logger";

const clients = new Map<string, WebSocket>();
const clientAlive = new Map<string, boolean>();
const clientProjects = new Map<string, Set<string>>();
const virtualSendHandlers = new Map<string, (message: object) => void>();

export function registerVirtualClient(id: string, handler: (message: object) => void): void {
  virtualSendHandlers.set(id, handler);
}

export function removeVirtualClient(id: string): void {
  virtualSendHandlers.delete(id);
}

export function addClient(id: string, ws: WebSocket): void {
  clients.set(id, ws);
  clientAlive.set(id, true);
}

export function removeClient(id: string): void {
  clients.delete(id);
  clientAlive.delete(id);
  clientProjects.delete(id);
}

export function markClientAlive(id: string): void {
  clientAlive.set(id, true);
}

export function subscribeClientToProject(clientId: string, projectSlug: string): void {
  let projects = clientProjects.get(clientId);
  if (!projects) {
    projects = new Set();
    clientProjects.set(clientId, projects);
  }
  projects.add(projectSlug);
}

export function broadcastToProject(projectSlug: string, message: object, excludeId?: string): void {
  const text = JSON.stringify(message);
  for (const [id, ws] of clients) {
    if (id !== excludeId && ws.readyState === ws.OPEN) {
      const projects = clientProjects.get(id);
      if (projects && projects.has(projectSlug)) {
        ws.send(text);
      }
    }
  }
}

export function broadcast(message: object, excludeId?: string): void {
  const text = JSON.stringify(message);
  for (const [id, ws] of clients) {
    if (id !== excludeId && ws.readyState === ws.OPEN) {
      ws.send(text);
    }
  }
}

export function sendTo(id: string, message: object): void {
  const ws = clients.get(id);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
    return;
  }
  const virtualHandler = virtualSendHandlers.get(id);
  if (virtualHandler) {
    virtualHandler(message);
    return;
  }
  if (id.startsWith("mesh-proxy:")) {
    log.broadcast("  ✗ sendTo %s but no virtual handler registered (msg=%s)", id.slice(0, 30), (message as any).type);
  }
}

export function getClientWebSocket(id: string): WebSocket | undefined {
  return clients.get(id);
}

export function getClientCount(): number {
  return clients.size;
}

export function closeAllClients(): void {
  for (const [, ws] of clients) {
    ws.close();
  }
  clients.clear();
  clientAlive.clear();
  clientProjects.clear();
}

const HEARTBEAT_INTERVAL_MS = 30000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(onDead: (clientId: string, ws: WebSocket) => void): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(function () {
    const dead: Array<[string, WebSocket]> = [];
    for (const [id, ws] of clients) {
      if (!clientAlive.get(id)) {
        dead.push([id, ws]);
        continue;
      }
      clientAlive.set(id, false);
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      }
    }
    for (let i = 0; i < dead.length; i++) {
      log.ws("Heartbeat: client %s unresponsive, terminating", dead[i][0].slice(0, 8));
      onDead(dead[i][0], dead[i][1]);
      dead[i][1].terminate();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
