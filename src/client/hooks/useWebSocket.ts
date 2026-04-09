import { createContext, useContext } from "react";
import type { ClientMessage, ServerMessage } from "#shared";

export type WebSocketStatus = "connecting" | "connected" | "disconnected";

export interface WebSocketContextValue {
  status: WebSocketStatus;
  send: (msg: ClientMessage) => void;
  subscribe: (type: string, callback: (msg: ServerMessage) => void) => void;
  unsubscribe: (type: string, callback: (msg: ServerMessage) => void) => void;
  reconnectNow: () => void;
}

export const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return ctx;
}

export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return protocol + "//" + window.location.host + "/ws";
}
