import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, ServerMessage } from "@lattice/shared";
import { WebSocketContext, getWebSocketUrl } from "../hooks/useWebSocket";
import type { WebSocketStatus } from "../hooks/useWebSocket";
import { showToast } from "../components/ui/Toast";

interface WebSocketProviderProps {
  children: ReactNode;
}

var MAX_BACKOFF = 30000;

export function WebSocketProvider(props: WebSocketProviderProps) {
  var [status, setStatus] = useState<WebSocketStatus>("connecting");
  var wsRef = useRef<WebSocket | null>(null);
  var backoffRef = useRef<number>(1000);
  var retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  var unmountedRef = useRef<boolean>(false);
  var listenersRef = useRef<Map<string, Set<(msg: ServerMessage) => void>>>(new Map());
  var hasConnectedRef = useRef<boolean>(false);

  function connect() {
    if (unmountedRef.current) {
      return;
    }

    var url = getWebSocketUrl();
    var ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = function () {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      console.log("[lattice] Connected");
      setStatus("connected");
      backoffRef.current = 1000;
      if (hasConnectedRef.current) {
        showToast("Reconnected to daemon", "info");
        ws.send(JSON.stringify({ type: "settings:get" }));
      }
      hasConnectedRef.current = true;
    };

    ws.onmessage = function (event: MessageEvent) {
      try {
        var msg = JSON.parse(event.data as string) as ServerMessage;
        var listeners = listenersRef.current.get(msg.type);
        if (listeners) {
          listeners.forEach(function (cb) {
            cb(msg);
          });
        }
      } catch {
        console.warn("[lattice] Failed to parse message:", event.data);
      }
    };

    ws.onclose = function () {
      if (unmountedRef.current) {
        return;
      }
      console.log("[lattice] Disconnected");
      setStatus("disconnected");
      wsRef.current = null;
      if (hasConnectedRef.current) {
        showToast("Disconnected from daemon. Reconnecting...", "warning");
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
    var delay = backoffRef.current;
    console.log("[lattice] Reconnecting in " + delay / 1000 + "s...");
    retryTimerRef.current = setTimeout(function () {
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      connect();
    }, delay);
  }

  function send(msg: ClientMessage) {
    var ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function subscribe(type: string, callback: (msg: ServerMessage) => void) {
    var listeners = listenersRef.current.get(type);
    if (!listeners) {
      listeners = new Set();
      listenersRef.current.set(type, listeners);
    }
    listeners.add(callback);
  }

  function unsubscribe(type: string, callback: (msg: ServerMessage) => void) {
    var listeners = listenersRef.current.get(type);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(type);
      }
    }
  }

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
    <WebSocketContext.Provider value={{ status, send, subscribe, unsubscribe }}>
      {props.children}
    </WebSocketContext.Provider>
  );
}
