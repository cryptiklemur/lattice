import { useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import type { HistoryMessage } from "@lattice/shared";
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
  SessionHistoryMessage,
  ServerMessage,
} from "@lattice/shared";
import { useWebSocket } from "./useWebSocket";
import { setActiveSessionId as setSidebarSessionId } from "../stores/sidebar";
import { updateSessionTabTitle } from "../stores/workspace";
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
  dequeueMessage,
  removeQueuedMessage,
  updateQueuedMessage,
  clearMessageQueue,
  setSessionBusy,
  addPromptQuestion,
  addTodoUpdate,
  setIsPlanMode,
  setBudgetStatus,
  setBudgetExceeded,
} from "../stores/session";
import type { SessionState, BudgetStatus } from "../stores/session";

var subscriptionsActive = 0;
var activeStreamGeneration = 0;
var streamSessionId: string | null = null;
var lastSentText: string | null = null;
var lastUsedModel: string | undefined = undefined;
var lastUsedEffort: string | undefined = undefined;

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
}

export function useSession(): UseSessionReturn {
  var store = getSessionStore();
  var state = useStore(store, function (s) { return s; });
  var { send, subscribe, unsubscribe } = useWebSocket();
  var sendRef = useRef(send);
  sendRef.current = send;
  var sendMessageRef = useRef(function (_text: string, _attachmentIds?: string[], _model?: string, _effort?: string) {});

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
    activeStreamGeneration = getStreamGeneration();
    streamSessionId = currentSessionId;
    lastSentText = text;
    lastUsedModel = model;
    lastUsedEffort = effort;
    setFailedInput(null);
    setPromptSuggestion(null);
    setIsProcessing(true);
    setSessionBusy(false);
    sendRef.current(msg as ChatSendMessage);
  }

  sendMessageRef.current = sendMessage;

  useEffect(function () {
    subscriptionsActive++;
    if (subscriptionsActive > 1) {
      return function () { subscriptionsActive--; };
    }

    function isStaleStream(): boolean {
      if (activeStreamGeneration !== getStreamGeneration()) return true;
      var currentActiveId = getSessionStore().state.activeSessionId;
      if (streamSessionId && currentActiveId && streamSessionId !== currentActiveId) return true;
      return false;
    }

    function handleUserMessage(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatUserMessage;
      setCurrentAssistantUuid(null);
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
      addSessionMessage({
        type: "tool_start",
        toolId: m.toolId,
        name: m.name,
        args: m.args,
        timestamp: Date.now(),
      } as HistoryMessage);
    }

    function handleToolResult(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as ChatToolResultMessage;
      updateToolResult(m.toolId, m.content);
    }

    function handleDone(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; cost: number; duration: number; sessionId?: string };
      lastSentText = null;
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
          sendMessageRef.current(combined, [], lastUsedModel, lastUsedEffort);
        }, 100);
      }
    }

    function handleError(msg: ServerMessage) {
      if (isStaleStream()) return;
      var m = msg as { type: string; message?: string };
      setIsProcessing(false);
      setCurrentStatus(null);
      setCurrentAssistantUuid(null);
      if (lastSentText) {
        setFailedInput(lastSentText);
        lastSentText = null;
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

    function handleHistory(msg: ServerMessage) {
      var m = msg as SessionHistoryMessage;
      setCurrentAssistantUuid(null);
      if (m.sessionId) {
        var projectSlug = m.projectSlug || getSessionStore().state.activeProjectSlug;
        setSidebarSessionId(m.sessionId);
        streamSessionId = m.sessionId;
        if (m.busy) {
          activeStreamGeneration = getStreamGeneration();
        }
        if (m.title) {
          updateSessionTabTitle(m.sessionId, m.title);
        }
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
            wasInterrupted: m.interrupted || false,
            isBusy: m.busy || false,
            busyOwner: m.busyOwner ?? null,
            isPlanMode: false,
          };
        });
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
      setSessionMessages(m.messages);
    }

    function handlePromptSuggestion(msg: ServerMessage) {
      var m = msg as ChatPromptSuggestionMessage;
      setPromptSuggestion(m.suggestion);
    }

    function handleSessionBusy(msg: ServerMessage) {
      var m = msg as { type: string; sessionId: string; busy: boolean; busyOwner?: "cli" | "lattice" };
      var sessionState = getSessionStore().state;
      if (m.sessionId === sessionState.activeSessionId) {
        if (m.busy && sessionState.isProcessing) {
          return;
        }
        setSessionBusy(m.busy, m.busyOwner);
      }
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

    function handleBudgetExceeded(msg: ServerMessage) {
      setBudgetExceeded(true);
      setIsProcessing(false);
      setCurrentStatus(null);
    }

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
    subscribe("chat:prompt_suggestion", handlePromptSuggestion);
    subscribe("session:busy", handleSessionBusy);
    subscribe("chat:prompt_request", handlePromptRequest);
    subscribe("chat:prompt_resolved", handlePromptResolved);
    subscribe("chat:todo_update", handleTodoUpdate);
    subscribe("chat:plan_mode", handlePlanMode);
    subscribe("budget:status", handleBudgetStatus);
    subscribe("budget:exceeded", handleBudgetExceeded);

    return function () {
      subscriptionsActive--;
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
      unsubscribe("chat:prompt_suggestion", handlePromptSuggestion);
      unsubscribe("session:busy", handleSessionBusy);
      unsubscribe("chat:prompt_request", handlePromptRequest);
      unsubscribe("chat:prompt_resolved", handlePromptResolved);
      unsubscribe("chat:todo_update", handleTodoUpdate);
      unsubscribe("chat:plan_mode", handlePlanMode);
      unsubscribe("budget:status", handleBudgetStatus);
      unsubscribe("budget:exceeded", handleBudgetExceeded);
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
    wasInterrupted: state.wasInterrupted,
    promptSuggestion: state.promptSuggestion,
    failedInput: state.failedInput,
    messageQueue: state.messageQueue,
    isBusy: state.isBusy,
    busyOwner: state.busyOwner,
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
      if (lastSentText) {
        setFailedInput(lastSentText);
        lastSentText = null;
      }
    },
  };
}
