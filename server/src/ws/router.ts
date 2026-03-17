import type { ClientMessage } from "@lattice/shared";
import { sendTo } from "./broadcast";

type Handler = (clientId: string, message: ClientMessage) => void | Promise<void>;

var handlers = new Map<string, Handler>();

export function registerHandler(prefix: string, handler: Handler): void {
  handlers.set(prefix, handler);
}

export function routeMessage(clientId: string, message: ClientMessage): void {
  var prefix = message.type.split(":")[0];
  var handler = handlers.get(prefix);
  if (handler) {
    handler(clientId, message);
    return;
  }
  console.warn(`[lattice] No handler for message type: ${message.type}`);
  sendTo(clientId, { type: "error", message: `Unknown message type: ${message.type}` });
}
