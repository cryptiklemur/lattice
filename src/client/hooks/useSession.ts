import { useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import type { HistoryMessage } from "#shared";
import type {
  ChatDeltaMessage,
  ChatSendMessage,
  ChatToolStartMessage,
  ChatToolResultMessage,
  ChatPermissionRequestMessage,
  ChatPermissionResolvedMessage,
  ChatUserMessage,
  ChatStatusMessage,
  ChatContextUsageMessage,
  ChatContextBreakdownMessage,
  ChatPromptSuggestionMessage,
  ChatElicitationRequestMessage,
  SessionHistoryMessage,
  ServerMessage,
} from "#shared";
import { useWebSocket } from "./useWebSocket";
import { setActiveSessionId as setSidebarSessionId } from "../stores/sidebar";
import { updateSessionTabTitle, pinTab } from "../stores/workspace";
import {
  getSessionStore,
  setSessionMessages,
  addSessionMessage,
  updateLastAssistantMessage,
  updateToolResult,
  setIsProcessing,
  setActiveSession,
  setSessionTitle,
  setCurrentStatus,
  setContextUsage,
  setContextBreakdown,
  getCurrentAssistantUuid,
  setCurrentAssistantUuid,
  incrementPendingPermissions,
  updatePermissionStatus,
  setLastResponseStats,
  getLastReadIndex,
  setLastReadIndex,
  markSessionRead,
  getStreamGeneration,
  mergeToolResults,
  setWasInterrupted,
  setPromptSuggestion,
  setFailedInput,
  enqueueMessage,
  removeQueuedMessage,
  updateQueuedMessage,
  clearMessageQueue,
  addPromptQuestion,
  addTodoUpdate,
  setIsPlanMode,
  setBudgetStatus,
  setBudgetExceeded,
  updateRateLimit,
} from "../stores/session";
import type { SessionState, BudgetStatus } from "../stores/session";

export type { SessionState };

export interface UseSessionReturn extends SessionState {
  sendMessage: (text: string, attachmentIds?: string[], model?: string, effort?: string) => void;
  activateSession: (projectSlug: string, sessionId: string) => void;
  clearFailedInput: () => void;
  lastReadIndex: number | null;
  enqueueMessage: (text: string) => void;
  removeQueuedMessage: (index: number) => void;
  updateQueuedMessage: (index: number, text: string) => void;
  clearMessageQueue: () => void;
  sendBudgetOverride: () => void;
  dismissBudgetExceeded: () => void;
  loadMoreHistory: () => void;
  historyHasMore: boolean;
  historyLoadingFileSize: number | null;
}

export function useSession(): UseSessionReturn {
  var store = getSessionStore();
  var state = useStore(store, function (s) { return s; });
  var { send, subscribe, unsubscribe } = useWebSocket();
  var sendRef = useRef(send);
  sendRef.current = send;
  var sendMessageRef = useRef(function (_text: string, _attachmentIds?: string[], _model?: string, _effort?: string) {});
  var subscriptionsActiveRef = useRef(0);
  var activeStreamGenerationRef = useRef(0);
  var streamSessionIdRef = useRef<string | null>(null);
  var lastSentTextRef = useRef<string | null>(null);
  var lastUsedModelRef = useRef<string | undefined>(undefined);
  var lastUsedEffortRef = useRef<string | undefined>(undefined);

  function activateSession(projectSlug: string, sessionId: string) {
    setActiveSession(projectSlug, sessionId);
    setSidebarSessionId(sessionId);
    sendRef.current({ type: "session:activate", projectSlug, sessionId });
  }

  function sendMessage(text: string, attachmentIds?: string[], model?: string, effort?: string) {
    var currentSessionId = getSessionStore().state.activeSessionId;
    if (!currentSessionId || (!text.trim() && (!attachmentIds || attachmentIds.length === 0))) {
      return;
    }
    var msg = { type: "chat:send" as const, text: text } as ChatSendMessage & { model?: string; effort?: string };
    if (attachmentIds && attachmentIds.length > 0) {
      msg.attachmentIds = attachmentIds;
    }
    if (model && model !== "default") {
      msg.model = model;
    }
    if (effort) {
      msg.effort = effort;
    }
    activeStreamGenerationRef.current = getStreamGeneration();
    streamSessionIdRef.current = currentSessionId;
    lastSentTextRef.current = text;
    lastUsedModelRef.current = model;
    lastUsedEffortRef.current = effort;
    setFailedInput(null);
    setPromptSuggestion(null);
    setWasInterrupted(false);
    setIsProcessing(true);
    addSessionMessage({
      type: "user",
      uuid: "optimistic-" + Date.now(),
      text: text,
      timestamp: Date.now(),
    } as HistoryMessage);
    pinTab("chat-" + currentSessionId);
    sendRef.current(msg as ChatSendMessage);
  }

  sendMessageRef.current = sendMessage;

  useEffect(function () {
    subscriptionsActiveRef.current++;
    if (subscriptionsActiveRef.current > 1) {
      return function () { subscriptionsActiveRef.current--; };
    }

    function isStaleStream(): boolean {
      if (activeStreamGenerationRef.current !== getStreamGeneration()) return true;
      var currentActiveId = getSessionStore().state.activeSessionId;
      if (streamSessionIdRef.current && currentActiveId && streamSessionIdRef.current !== currentActiveId) return true;
      return false;
    }

    function handleUserMessage(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatUserMessage;
      setCurrentAssistantUuid(null);
      var messages = getSessionStore().state.messages;
      var last = messages.length > 0 ? messages[messages.length - 1] : null;
      if (last && last.type === "user" && last.uuid && last.uuid.startsWith("optimistic-") && last.text === m.text) {
        getSessionStore().setState(function (s) {
          var updated = s.messages.slice();
          updated[updated.length - 1] = { ...updated[updated.length - 1], uuid: m.uuid };
          return { ...s, messages: updated };
        });
        return;
      }
      addSessionMessage({
        type: "user",
        uuid: m.uuid,
        text: m.text,
        timestamp: Date.now(),
      } as HistoryMessage);
    }

    function handleDelta(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatDeltaMessage;
      var uuid = getCurrentAssistantUuid();

      if (!uuid) {
        var newUuid = "assistant-" + Date.now();
        setCurrentAssistantUuid(newUuid);
        addSessionMessage({
          type: "assistant",
          uuid: newUuid,
          text: m.text,
          timestamp: Date.now(),
        } as HistoryMessage);
      } else {
        updateLastAssistantMessage(uuid, m.text);
      }
    }

    function handleToolStart(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatToolStartMessage;
      setCurrentAssistantUuid(null);
      var existing = getSessionStore().state.messages.findLastIndex(function (msg) {
        return msg.toolId === m.toolId && msg.type === "tool_start";
      });
      if (existing >= 0) {
        getSessionStore().setState(function (s) {
          var updated = s.messages.slice();
          updated[existing] = { ...updated[existing], args: m.args };
          return { ...s, messages: updated };
        });
      } else {
        addSessionMessage({
          type: "tool_start",
          toolId: m.toolId,
          name: m.name,
          args: m.args,
          timestamp: Date.now(),
        } as HistoryMessage);
      }
    }

    function handleToolResult(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatToolResultMessage;
      updateToolResult(m.toolId, m.content);
    }

    function handleDone(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; cost: number; duration: number; sessionId?: string };
      lastSentTextRef.current = null;
      setIsProcessing(false);
      setCurrentStatus(null);
      setCurrentAssistantUuid(null);
      setLastResponseStats(m.cost || 0, m.duration || 0);
      var activeId = getSessionStore().state.activeSessionId;
      if (activeId) {
        markSessionRead(activeId, getSessionStore().state.messages.length);
      }
      var queue = getSessionStore().state.messageQueue;
      if (queue.length > 0) {
        var combined = queue.join("\n\n");
        clearMessageQueue();
        setTimeout(function () {
          sendMessageRef.current(combined, [], lastUsedModelRef.current, lastUsedEffortRef.current);
        }, 100);
      }
    }

    function handleError(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; message?: string };
      if (m.message && m.message.includes("Sent before connected")) return;
      setIsProcessing(false);
      setCurrentStatus(null);
      setCurrentAssistantUuid(null);
      if (lastSentTextRef.current) {
        setFailedInput(lastSentTextRef.current);
        lastSentTextRef.current = null;
      }
      if (m.message) {
        addSessionMessage({
          type: "assistant",
          uuid: "error-" + Date.now(),
          text: "Error: " + m.message,
          timestamp: Date.now(),
        } as HistoryMessage);
      }
    }

    function handleStatus(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatStatusMessage;
      setCurrentStatus({ phase: m.phase, toolName: m.toolName, elapsed: m.elapsed, summary: m.summary });
    }

    function handleContextUsage(msg: ServerMessage) {
      var m = msg as ChatContextUsageMessage;
      setContextUsage({
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cacheReadTokens: m.cacheReadTokens,
        cacheCreationTokens: m.cacheCreationTokens,
        contextWindow: m.contextWindow,
      });
    }

    function handleContextBreakdown(msg: ServerMessage) {
      var m = msg as ChatContextBreakdownMessage;
      setContextBreakdown({
        segments: m.segments,
        contextWindow: m.contextWindow,
        autocompactAt: m.autocompactAt,
      });
    }

    function handlePermissionRequest(msg: ServerMessage) {
      var m = msg as ChatPermissionRequestMessage;
      setCurrentAssistantUuid(null);
      addSessionMessage({
        type: "permission_request",
        toolId: m.requestId,
        name: m.tool,
        args: m.args,
        title: m.title,
        decisionReason: m.decisionReason,
        permissionRule: m.permissionRule,
        permissionStatus: "pending",
        timestamp: Date.now(),
      } as HistoryMessage);
      incrementPendingPermissions();
    }

    function handlePermissionResolved(msg: ServerMessage) {
      var m = msg as ChatPermissionResolvedMessage;
      updatePermissionStatus(m.requestId, m.status);
    }

    function handleElicitationRequest(msg: ServerMessage) {
      var m = msg as ChatElicitationRequestMessage;
      setCurrentAssistantUuid(null);
      addSessionMessage({
        type: "elicitation",
        toolId: m.requestId,
        elicitationMode: m.mode,
        elicitationServerName: m.serverName,
        elicitationMessage: m.message,
        elicitationUrl: m.url,
        elicitationSchema: m.requestedSchema,
        elicitationStatus: "pending",
        timestamp: Date.now(),
      } as HistoryMessage);
    }

    function handleHistoryPage(msg: ServerMessage) {
      var m = msg as { type: string; sessionId: string; messages: HistoryMessage[]; hasMore: boolean; totalMessages?: number };
      var state = getSessionStore().state;
      if (m.sessionId !== state.activeSessionId) return;
      getSessionStore().setState(function (s) {
        return {
          ...s,
          messages: mergeToolResults(m.messages).concat(s.messages),
          historyHasMore: m.hasMore,
          historyTotalMessages: m.totalMessages ?? s.historyTotalMessages,
        };
      });
    }

    function handleLoadingProgress(msg: ServerMessage) {
      var m = msg as { type: string; sessionId: string; fileSize: number | null };
      if (m.sessionId !== getSessionStore().state.activeSessionId) return;
      getSessionStore().setState(function (s) { return { ...s, historyLoadingFileSize: m.fileSize }; });
    }

    function handleHistory(msg: ServerMessage) {
      var m = msg as SessionHistoryMessage;
      if (m.sessionId && m.messages && m.messages.length === 0 && m.title) {
        updateSessionTabTitle(m.sessionId, m.title);
        if (m.sessionId === getSessionStore().state.activeSessionId) {
          getSessionStore().setState(function (s) { return { ...s, activeSessionTitle: m.title ?? s.activeSessionTitle }; });
        }
        return;
      }
      setCurrentAssistantUuid(null);
      if (m.sessionId) {
        if (m.sessionId !== getSessionStore().state.activeSessionId) {
          if (m.title) updateSessionTabTitle(m.sessionId, m.title);
          return;
        }
        var projectSlug = m.projectSlug || getSessionStore().state.activeProjectSlug;
        setSidebarSessionId(m.sessionId);
        streamSessionIdRef.current = m.sessionId;
        if (m.title) {
          updateSessionTabTitle(m.sessionId, m.title);
        }
        var currentState = getSessionStore().state;
        var alreadyCached = currentState.activeSessionId === m.sessionId
          && !currentState.historyLoading
          && currentState.messages.length > 0;

        if (alreadyCached) {
          getSessionStore().setState(function (state) {
            return {
              ...state,
              activeSessionTitle: m.title ?? state.activeSessionTitle,
              historyHasMore: m.hasMore || state.historyHasMore,
              historyTotalMessages: m.totalMessages || state.historyTotalMessages,
              wasInterrupted: m.interrupted || false,
            };
          });
        } else {
          getSessionStore().setState(function (state) {
            return {
              ...state,
              activeProjectSlug: projectSlug,
              activeSessionId: m.sessionId,
              activeSessionTitle: m.title ?? null,
              messages: mergeToolResults(m.messages),
              isProcessing: false,
              currentStatus: null,
              pendingPermissionCount: 0,
              lastResponseCost: null,
              lastResponseDuration: null,
              lastReadIndex: null,
              historyLoading: false,
              historyHasMore: m.hasMore || false,
              historyTotalMessages: m.totalMessages || m.messages.length,
              wasInterrupted: m.interrupted || false,
              isPlanMode: false,
            };
          });
        }
        var storedIndex = getLastReadIndex(m.sessionId);
        if (storedIndex >= 0 && storedIndex < m.messages.length) {
          setLastReadIndex(storedIndex);
        }
        markSessionRead(m.sessionId, m.messages.length);
      } else {
        setSessionMessages(m.messages);
        setIsProcessing(false);
        setCurrentStatus(null);
        if (m.projectSlug) {
          getSessionStore().setState(function (state) {
            return { ...state, activeProjectSlug: m.projectSlug };
          });
        }
        if (m.title) {
          setSessionTitle(m.title);
        }
      }
    }

    function handlePromptSuggestion(msg: ServerMessage) {
      var m = msg as ChatPromptSuggestionMessage;
      setPromptSuggestion(m.suggestion);
    }

    function handlePromptRequest(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; requestId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string; preview?: string }>; multiSelect: boolean }> };
      addPromptQuestion(m.requestId, m.questions);
    }

    function handlePromptResolved(_msg: ServerMessage) {
      // No-op — client already updated state when it sent the response
    }

    function handleTodoUpdate(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; todos: Array<{ id: string; content: string; status: string; priority: string }> };
      addTodoUpdate(m.todos);
    }

    function handlePlanMode(msg: ServerMessage) {
      var m = msg as { type: string; active: boolean };
      setIsPlanMode(m.active);
    }

    function handleBudgetStatus(msg: ServerMessage) {
      var m = msg as { type: string; dailySpend: number; dailyLimit: number; enforcement: "warning" | "soft-block" | "hard-block" };
      setBudgetStatus({ dailySpend: m.dailySpend, dailyLimit: m.dailyLimit, enforcement: m.enforcement });
    }

    function handleRateLimit(msg: ServerMessage) {
      var m = msg as { type: string; status: "allowed" | "allowed_warning" | "rejected"; utilization?: number; resetsAt?: number; rateLimitType?: string; overageStatus?: string; overageResetsAt?: number; isUsingOverage?: boolean };
      if (!m.rateLimitType) return;
      updateRateLimit({
        status: m.status,
        utilization: m.utilization,
        resetsAt: m.resetsAt,
        rateLimitType: m.rateLimitType,
        overageStatus: m.overageStatus,
        overageResetsAt: m.overageResetsAt,
        isUsingOverage: m.isUsingOverage,
        updatedAt: Date.now(),
      });
    }

    function handleBudgetExceeded(msg: ServerMessage) {
      setBudgetExceeded(true);
      setIsProcessing(false);
      setCurrentStatus(null);
    }

    subscribe("session:loading_progress", handleLoadingProgress);
    subscribe("chat:user_message", handleUserMessage);
    subscribe("chat:delta", handleDelta);
    subscribe("chat:tool_start", handleToolStart);
    subscribe("chat:tool_result", handleToolResult);
    subscribe("chat:done", handleDone);
    subscribe("chat:error", handleError);
    subscribe("chat:permission_request", handlePermissionRequest);
    subscribe("chat:permission_resolved", handlePermissionResolved);
    subscribe("chat:status", handleStatus);
    subscribe("chat:context_usage", handleContextUsage);
    subscribe("chat:context_breakdown", handleContextBreakdown);
    subscribe("session:history", handleHistory);
    subscribe("session:history_page_result", handleHistoryPage);
    subscribe("chat:prompt_suggestion", handlePromptSuggestion);
    subscribe("chat:prompt_request", handlePromptRequest);
    subscribe("chat:prompt_resolved", handlePromptResolved);
    subscribe("chat:todo_update", handleTodoUpdate);
    subscribe("chat:plan_mode", handlePlanMode);
    subscribe("budget:status", handleBudgetStatus);
    subscribe("budget:exceeded", handleBudgetExceeded);
    subscribe("chat:elicitation_request", handleElicitationRequest);
    subscribe("chat:rate_limit", handleRateLimit);

    return function () {
      subscriptionsActiveRef.current--;
      unsubscribe("session:loading_progress", handleLoadingProgress);
      unsubscribe("chat:user_message", handleUserMessage);
      unsubscribe("chat:delta", handleDelta);
      unsubscribe("chat:tool_start", handleToolStart);
      unsubscribe("chat:tool_result", handleToolResult);
      unsubscribe("chat:done", handleDone);
      unsubscribe("chat:error", handleError);
      unsubscribe("chat:permission_request", handlePermissionRequest);
      unsubscribe("chat:permission_resolved", handlePermissionResolved);
      unsubscribe("chat:status", handleStatus);
      unsubscribe("chat:context_usage", handleContextUsage);
      unsubscribe("chat:context_breakdown", handleContextBreakdown);
      unsubscribe("session:history", handleHistory);
      unsubscribe("session:history_page_result", handleHistoryPage);
      unsubscribe("chat:prompt_suggestion", handlePromptSuggestion);
      unsubscribe("chat:prompt_request", handlePromptRequest);
      unsubscribe("chat:prompt_resolved", handlePromptResolved);
      unsubscribe("chat:todo_update", handleTodoUpdate);
      unsubscribe("chat:plan_mode", handlePlanMode);
      unsubscribe("budget:status", handleBudgetStatus);
      unsubscribe("budget:exceeded", handleBudgetExceeded);
      unsubscribe("chat:elicitation_request", handleElicitationRequest);
      unsubscribe("chat:rate_limit", handleRateLimit);
    };
  }, [subscribe, unsubscribe]);

  return {
    messages: state.messages,
    isProcessing: state.isProcessing,
    activeProjectSlug: state.activeProjectSlug,
    activeSessionId: state.activeSessionId,
    activeSessionTitle: state.activeSessionTitle,
    sendMessage,
    activateSession,
    clearFailedInput: function () { setFailedInput(null); },
    currentStatus: state.currentStatus,
    contextUsage: state.contextUsage,
    contextBreakdown: state.contextBreakdown,
    pendingPermissionCount: state.pendingPermissionCount,
    lastResponseCost: state.lastResponseCost,
    lastResponseDuration: state.lastResponseDuration,
    lastReadIndex: state.lastReadIndex,
    historyLoading: state.historyLoading,
    historyLoadingFileSize: state.historyLoadingFileSize,
    historyHasMore: state.historyHasMore,
    historyTotalMessages: state.historyTotalMessages,
    loadMoreHistory: function () {
      if (!state.historyHasMore || !state.activeSessionId) return;
      sendRef.current({ type: "session:history_page", sessionId: state.activeSessionId, loaded: state.messages.length, limit: 100 } as any);
    },
    wasInterrupted: state.wasInterrupted,
    promptSuggestion: state.promptSuggestion,
    failedInput: state.failedInput,
    messageQueue: state.messageQueue,
    isPlanMode: state.isPlanMode,
    pendingPrefill: state.pendingPrefill,
    budgetStatus: state.budgetStatus,
    budgetExceeded: state.budgetExceeded,
    enqueueMessage,
    removeQueuedMessage,
    updateQueuedMessage,
    clearMessageQueue,
    sendBudgetOverride: function () {
      setBudgetExceeded(false);
      setIsProcessing(true);
      sendRef.current({ type: "budget:override" } as never);
    },
    dismissBudgetExceeded: function () {
      setBudgetExceeded(false);
      if (lastSentTextRef.current) {
        setFailedInput(lastSentTextRef.current);
        lastSentTextRef.current = null;
      }
    },
    rateLimits: state.rateLimits,
  };
}
