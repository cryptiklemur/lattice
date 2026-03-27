import type { ServerWebSocket } from "bun";

var clients = new Map<string, ServerWebSocket<{ id: string }>>();
var virtualSendHandlers = new Map<string, (message: object) => void>();

export function registerVirtualClient(id: string, handler: (message: object) => void): void {
  virtualSendHandlers.set(id, handler);
}

export function removeVirtualClient(id: string): void {
  virtualSendHandlers.delete(id);
}

export function addClient(ws: ServerWebSocket<{ id: string }>): void {
  clients.set(ws.data.id, ws);
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function broadcast(message: object, excludeId?: string): void {
  var text = JSON.stringify(message);
  for (var [id, ws] of clients) {
    if (id !== excludeId) {
      ws.send(text);
    }
  }
}

export function sendTo(id: string, message: object): void {
  var ws = clients.get(id);
  if (ws) {
    ws.send(JSON.stringify(message));
    return;
  }
  var virtualHandler = virtualSendHandlers.get(id);
  if (virtualHandler) {
    virtualHandler(message);
    return;
  }
  if (id.startsWith("mesh-proxy:")) {
    var { log } = require("../logger");
    log.broadcast("  ✗ sendTo %s but no virtual handler registered (msg=%s)", id.slice(0, 30), (message as any).type);
  }
}

export function getClientWebSocket(id: string): ServerWebSocket<{ id: string }> | undefined {
  return clients.get(id);
}

export function getClientCount(): number {
  return clients.size;
}

export function closeAllClients(): void {
  for (var [, ws] of clients) {
    ws.close();
  }
  clients.clear();
}
