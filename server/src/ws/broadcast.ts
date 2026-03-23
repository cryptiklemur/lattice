import type { ServerWebSocket } from "bun";

var clients = new Map<string, ServerWebSocket<{ id: string }>>();

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
  }
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
