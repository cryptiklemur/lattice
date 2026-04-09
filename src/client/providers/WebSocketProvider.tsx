import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, ServerMessage } from "#shared";
import { WebSocketContext, getWebSocketUrl } from "../hooks/useWebSocket";
import type { WebSocketStatus } from "../hooks/useWebSocket";
import { showToast } from "../components/ui/Toast";
import { getSessionStore } from "../stores/session";
import { sendNotification } from "../hooks/useNotifications";
import { openTab, onTabClose } from "../stores/workspace";

interface WebSocketProviderProps {
  children: ReactNode;
}

const MAX_BACKOFF = 30000;
const MAX_QUEUE_SIZE = 100;

export function WebSocketProvider(props: WebSocketProviderProps) {
  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef<number>(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef<boolean>(false);
  const listenersRef = useRef<Map<string, Set<(msg: ServerMessage) => void>>>(new Map());
  const hasConnectedRef = useRef<boolean>(false);
  const outgoingQueueRef = useRef<ClientMessage[]>([]);

  function connect() {
    if (unmountedRef.current) {
      return;
    }

    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = function () {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      setStatus("connected");
      backoffRef.current = 1000;
      if (hasConnectedRef.current) {
        showToast("Reconnected to daemon", "info");
        sendNotification("Lattice", "Reconnected to daemon", "connection");
        ws.send(JSON.stringify({ type: "settings:get" }));

        const sessionState = getSessionStore().state;
        if (sessionState.activeProjectSlug && sessionState.activeSessionId) {
          ws.send(JSON.stringify({
            type: "session:activate",
            projectSlug: sessionState.activeProjectSlug,
            sessionId: sessionState.activeSessionId,
          }));
        }
      }
      hasConnectedRef.current = true;
      ws.send(JSON.stringify({ type: "brainstorm:status_request" }));
      const queued = outgoingQueueRef.current;
      outgoingQueueRef.current = [];
      queued.forEach(function (msg) {
        ws.send(JSON.stringify(msg));
      });
    };

    ws.onmessage = function (event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;

        if (msg.type === "chat:done" && document.hidden) {
          const sessionState = getSessionStore().state;
          const sessionTitle = sessionState.activeSessionTitle || "Session";
          sendNotification("Claude responded", sessionTitle, "chat-done");
        }

        if (msg.type === "mesh:node_online") {
          sendNotification("Lattice", (msg as any).nodeId + " came online", "mesh");
        }

        if (msg.type === "mesh:node_offline") {
          sendNotification("Lattice", (msg as any).nodeId + " went offline", "mesh");
        }

        const listeners = listenersRef.current.get(msg.type);
        if (listeners) {
          listeners.forEach(function (cb) {
            cb(msg);
          });
        }
      } catch (err) {
        console.warn("[lattice] Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = function () {
      if (unmountedRef.current) {
        return;
      }
      setStatus("disconnected");
      wsRef.current = null;
      if (hasConnectedRef.current) {
        showToast("Disconnected from daemon. Reconnecting automatically...", "warning");
        sendNotification("Lattice", "Lost connection to daemon", "connection");
      }
      scheduleReconnect();
    };

    ws.onerror = function () {
      ws.close();
    };
  }

  function scheduleReconnect() {
    if (unmountedRef.current) {
      return;
    }
    const delay = backoffRef.current;
    retryTimerRef.current = setTimeout(function () {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      connect();
    }, delay);
  }

  function reconnectNow() {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    backoffRef.current = 1000;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    connect();
  }

  function send(msg: ClientMessage) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      if (outgoingQueueRef.current.length >= MAX_QUEUE_SIZE) {
        outgoingQueueRef.current.shift();
      }
      outgoingQueueRef.current.push(msg);
    }
  }

  const subscribe = useRef(function (type: string, callback: (msg: ServerMessage) => void) {
    let listeners = listenersRef.current.get(type);
    if (!listeners) {
      listeners = new Set();
      listenersRef.current.set(type, listeners);
    }
    listeners.add(callback);
  }).current;

  const unsubscribe = useRef(function (type: string, callback: (msg: ServerMessage) => void) {
    const listeners = listenersRef.current.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(type);
      }
    }
  }).current;

  useEffect(function () {
    function handleBrainstormContent() {
      openTab("brainstorm");
    }
    function handleBrainstormStatus(msg: ServerMessage) {
      if (msg.type === "brainstorm:status" && msg.active) {
        openTab("brainstorm");
      }
    }
    subscribe("brainstorm:content", handleBrainstormContent);
    subscribe("brainstorm:status", handleBrainstormStatus);
    const unregisterTabClose = onTabClose(function (tab) {
      if (tab.type === "brainstorm") {
        send({ type: "brainstorm:stop" } as ClientMessage);
      }
    });
    return function () {
      unsubscribe("brainstorm:content", handleBrainstormContent);
      unsubscribe("brainstorm:status", handleBrainstormStatus);
      unregisterTabClose();
    };
  }, []);

  useEffect(function () {
    unmountedRef.current = false;
    connect();

    return function () {
      unmountedRef.current = true;
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ status, send, subscribe, unsubscribe, reconnectNow }}>
      {props.children}
    </WebSocketContext.Provider>
  );
}
