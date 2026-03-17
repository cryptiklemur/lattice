import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryMessage } from "@lattice/shared";
import type {
  ChatDeltaMessage,
  ChatToolStartMessage,
  ChatToolResultMessage,
  ChatPermissionRequestMessage,
  ChatUserMessage,
  ChatStatusMessage,
  SessionHistoryMessage,
  ServerMessage,
} from "@lattice/shared";
import { useWebSocket } from "./useWebSocket";

export interface SessionState {
  messages: HistoryMessage[];
  isProcessing: boolean;
  activeProjectSlug: string | null;
  activeSessionId: string | null;
  sendMessage: (text: string) => void;
  activateSession: (projectSlug: string, sessionId: string) => void;
  currentStatus: { phase: string; toolName?: string; elapsed?: number; summary?: string } | null;
}

export function useSession(): SessionState {
  var [messages, setMessages] = useState<HistoryMessage[]>([]);
  var [isProcessing, setIsProcessing] = useState<boolean>(false);
  var [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(null);
  var [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  var [currentStatus, setCurrentStatus] = useState<SessionState["currentStatus"]>(null);
  var { send, subscribe, unsubscribe } = useWebSocket();
  var currentAssistantUuidRef = useRef<string | null>(null);

  function activateSession(projectSlug: string, sessionId: string) {
    setActiveProjectSlug(projectSlug);
    setActiveSessionId(sessionId);
    setMessages([]);
    setIsProcessing(false);
    currentAssistantUuidRef.current = null;
    send({ type: "session:activate", projectSlug, sessionId });
  }

  var sendMessage = useCallback(
    function (text: string) {
      if (!activeSessionId || !text.trim()) {
        return;
      }
      send({ type: "chat:send", text });
      setIsProcessing(true);
    },
    [activeSessionId, send]
  );

  useEffect(
    function () {
      function handleUserMessage(msg: ServerMessage) {
        var m = msg as ChatUserMessage;
        currentAssistantUuidRef.current = null;
        setMessages(function (prev) {
          return [
            ...prev,
            {
              type: "user",
              uuid: m.uuid,
              text: m.text,
              timestamp: Date.now(),
            },
          ];
        });
      }

      function handleDelta(msg: ServerMessage) {
        var m = msg as ChatDeltaMessage;
        var uuid = currentAssistantUuidRef.current;

        if (!uuid) {
          var newUuid = "assistant-" + Date.now();
          currentAssistantUuidRef.current = newUuid;
          setMessages(function (prev) {
            return [
              ...prev,
              {
                type: "assistant",
                uuid: newUuid,
                text: m.text,
                timestamp: Date.now(),
              },
            ];
          });
        } else {
          setMessages(function (prev) {
            var idx = prev.findLastIndex(function (msg) {
              return msg.uuid === uuid;
            });
            if (idx === -1) {
              return prev;
            }
            var updated = prev.slice();
            updated[idx] = {
              ...updated[idx],
              text: (updated[idx].text || "") + m.text,
            };
            return updated;
          });
        }
      }

      function handleToolStart(msg: ServerMessage) {
        var m = msg as ChatToolStartMessage;
        currentAssistantUuidRef.current = null;
        setMessages(function (prev) {
          return [
            ...prev,
            {
              type: "tool_start",
              toolId: m.toolId,
              name: m.name,
              args: m.args,
              timestamp: Date.now(),
            },
          ];
        });
      }

      function handleToolResult(msg: ServerMessage) {
        var m = msg as ChatToolResultMessage;
        setMessages(function (prev) {
          var idx = prev.findLastIndex(function (msg) {
            return msg.toolId === m.toolId && msg.type === "tool_start";
          });
          if (idx === -1) {
            return prev;
          }
          var updated = prev.slice();
          updated[idx] = { ...updated[idx], content: m.content };
          return updated;
        });
      }

      function handleDone() {
        setIsProcessing(false);
        setCurrentStatus(null);
        currentAssistantUuidRef.current = null;
      }

      function handleError() {
        setIsProcessing(false);
        setCurrentStatus(null);
        currentAssistantUuidRef.current = null;
      }

      function handleStatus(msg: ServerMessage) {
        var m = msg as ChatStatusMessage;
        setCurrentStatus({ phase: m.phase, toolName: m.toolName, elapsed: m.elapsed, summary: m.summary });
      }

      function handlePermissionRequest(msg: ServerMessage) {
        var m = msg as ChatPermissionRequestMessage;
        currentAssistantUuidRef.current = null;
        setMessages(function (prev) {
          return [
            ...prev,
            {
              type: "permission_request",
              toolId: m.requestId,
              name: m.tool,
              args: m.args,
              timestamp: Date.now(),
            },
          ];
        });
      }

      function handleHistory(msg: ServerMessage) {
        var m = msg as SessionHistoryMessage;
        setMessages(m.messages);
        setIsProcessing(false);
        currentAssistantUuidRef.current = null;
      }

      subscribe("chat:user_message", handleUserMessage);
      subscribe("chat:delta", handleDelta);
      subscribe("chat:tool_start", handleToolStart);
      subscribe("chat:tool_result", handleToolResult);
      subscribe("chat:done", handleDone);
      subscribe("chat:error", handleError);
      subscribe("chat:permission_request", handlePermissionRequest);
      subscribe("chat:status", handleStatus);
      subscribe("session:history", handleHistory);

      return function () {
        unsubscribe("chat:user_message", handleUserMessage);
        unsubscribe("chat:delta", handleDelta);
        unsubscribe("chat:tool_start", handleToolStart);
        unsubscribe("chat:tool_result", handleToolResult);
        unsubscribe("chat:done", handleDone);
        unsubscribe("chat:error", handleError);
        unsubscribe("chat:permission_request", handlePermissionRequest);
        unsubscribe("chat:status", handleStatus);
        unsubscribe("session:history", handleHistory);
      };
    },
    [subscribe, unsubscribe]
  );

  return {
    messages,
    isProcessing,
    activeProjectSlug,
    activeSessionId,
    sendMessage,
    activateSession,
    currentStatus,
  };
}
