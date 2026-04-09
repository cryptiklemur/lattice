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
  setPendingSystemPrompt,
} from "../stores/session";
import type { SessionState, BudgetStatus } from "../stores/session";
import {
  addToolDelta,
  addToolEvent,
  addAnomaly,
  updateBaselines,
  updateBurnRate,
  resetContextAnalyzer,
  setHooksStatus,
  updateExternalSession,
  markExternalSessionEnded,
} from "../stores/context-analyzer";
import type {
  ContextToolDeltaMessage,
  ContextAnomalyMessage,
  ContextBaselineStatsMessage,
  ContextBurnRateMessage,
  ContextHooksStatusMessage,
  ContextStatuslineMessage,
  ContextSessionEventMessage,
  ContextToolEventMessage,
} from "#shared";

export type { SessionState };

let globalSubscriptionCount = 0;
const globalHandlersRef: { current: Record<string, (msg: ServerMessage) => void> | null } = { current: null };
const globalDispatchFns: Map<string, (msg: ServerMessage) => void> = new Map();

let globalActiveStreamGeneration = 0;
let globalStreamSessionId: string | null = null;
let globalLastSentText: string | null = null;
let globalLastUsedModel: string | undefined = undefined;
let globalLastUsedEffort: string | undefined = undefined;

function getDispatch(type: string): (msg: ServerMessage) => void {
  const existing = globalDispatchFns.get(type);
  if (existing) return existing;
  const fn = function (msg: ServerMessage) {
    const handlers = globalHandlersRef.current;
    if (handlers && handlers[type]) handlers[type](msg);
  };
  globalDispatchFns.set(type, fn);
  return fn;
}

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
  const store = getSessionStore();
  const state = useStore(store, function (s) { return s; });
  const { send, subscribe, unsubscribe } = useWebSocket();
  const sendRef = useRef(send);
  sendRef.current = send;
  const sendMessageRef = useRef(function (_text: string, _attachmentIds?: string[], _model?: string, _effort?: string) {});

  function activateSession(projectSlug: string, sessionId: string) {
    const isReactivation = getSessionStore().state.activeSessionId === sessionId;
    resetContextAnalyzer();
    if (!isReactivation) {
      setActiveSession(projectSlug, sessionId);
    }
    setSidebarSessionId(sessionId);
    sendRef.current({ type: "session:activate", projectSlug, sessionId });
  }

  function sendMessage(text: string, attachmentIds?: string[], model?: string, effort?: string) {
    const currentSessionId = getSessionStore().state.activeSessionId;
    if (!currentSessionId || (!text.trim() && (!attachmentIds || attachmentIds.length === 0))) {
      return;
    }
    const msg = { type: "chat:send" as const, text: text } as ChatSendMessage & { model?: string; effort?: string };
    if (attachmentIds && attachmentIds.length > 0) {
      msg.attachmentIds = attachmentIds;
    }
    if (model && model !== "default") {
      msg.model = model;
    }
    if (effort) {
      msg.effort = effort;
    }
    const pendingPrompt = getSessionStore().state.pendingSystemPrompt;
    if (pendingPrompt) {
      (msg as any).systemPrompt = pendingPrompt;
      setPendingSystemPrompt(null);
    }
    globalActiveStreamGeneration = getStreamGeneration();
    globalStreamSessionId = currentSessionId;
    globalLastSentText = text;
    globalLastUsedModel = model;
    globalLastUsedEffort = effort;
    setFailedInput(null);
    setPromptSuggestion(null);
    setWasInterrupted(false);
    setIsProcessing(true);
    const isAutoSend = getSessionStore().state.pendingAutoSend === text;
    addSessionMessage({
      type: "user",
      uuid: (isAutoSend ? "spec-auto-" : "optimistic-") + Date.now(),
      text: text,
      timestamp: Date.now(),
    } as HistoryMessage);
    pinTab("chat-" + currentSessionId);
    sendRef.current(msg as ChatSendMessage);
  }

  sendMessageRef.current = sendMessage;

  function isStaleStream(): boolean {
    if (globalActiveStreamGeneration !== getStreamGeneration()) return true;
    const currentActiveId = getSessionStore().state.activeSessionId;
    if (globalStreamSessionId && currentActiveId && globalStreamSessionId !== currentActiveId) return true;
    return false;
  }

  globalHandlersRef.current = {
    "chat:user_message": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as ChatUserMessage;
      setCurrentAssistantUuid(null);
      const messages = getSessionStore().state.messages;
      const last = messages.length > 0 ? messages[messages.length - 1] : null;
      const isOptimistic = last && last.type === "user" && last.uuid && (last.uuid.startsWith("optimistic-") || last.uuid.startsWith("spec-auto-")) && last.text === m.text;
      if (isOptimistic) {
        const wasSpecAuto = last!.uuid!.startsWith("spec-auto-");
        getSessionStore().setState(function (s) {
          const updated = s.messages.slice();
          updated[updated.length - 1] = { ...updated[updated.length - 1], uuid: wasSpecAuto ? "spec-auto-" + m.uuid : m.uuid };
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
    },
    "chat:delta": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as ChatDeltaMessage;
      const uuid = getCurrentAssistantUuid();

      if (!uuid) {
        const newUuid = "assistant-" + Date.now();
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
    },
    "chat:tool_start": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as ChatToolStartMessage;
      setCurrentAssistantUuid(null);
      const existing = getSessionStore().state.messages.findLastIndex(function (msg) {
        return msg.toolId === m.toolId && msg.type === "tool_start";
      });
      if (existing >= 0) {
        getSessionStore().setState(function (s) {
          const updated = s.messages.slice();
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
    },
    "chat:tool_result": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as ChatToolResultMessage;
      updateToolResult(m.toolId, m.content);
    },
    "chat:done": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as { type: string; cost: number; duration: number; sessionId?: string };
      globalLastSentText = null;
      setIsProcessing(false);
      setCurrentStatus(null);
      setCurrentAssistantUuid(null);
      setLastResponseStats(m.cost || 0, m.duration || 0);
      const activeId = getSessionStore().state.activeSessionId;
      if (activeId) {
        markSessionRead(activeId, getSessionStore().state.messages.length);
      }
      const queue = getSessionStore().state.messageQueue;
      if (queue.length > 0) {
        const combined = queue.join("\n\n");
        clearMessageQueue();
        setTimeout(function () {
          sendMessageRef.current(combined, [], globalLastUsedModel, globalLastUsedEffort);
        }, 100);
      }
    },
    "chat:error": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as { type: string; message?: string };
      if (m.message && m.message.includes("Sent before connected")) return;
      setIsProcessing(false);
      setCurrentStatus(null);
      setCurrentAssistantUuid(null);
      if (globalLastSentText) {
        setFailedInput(globalLastSentText);
        globalLastSentText = null;
      }
      if (m.message) {
        addSessionMessage({
          type: "assistant",
          uuid: "error-" + Date.now(),
          text: "Error: " + m.message,
          timestamp: Date.now(),
        } as HistoryMessage);
      }
    },
    "chat:status": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as ChatStatusMessage;
      setCurrentStatus({ phase: m.phase, toolName: m.toolName, elapsed: m.elapsed, summary: m.summary });
    },
    "chat:context_usage": function (msg: ServerMessage) {
      const m = msg as ChatContextUsageMessage;
      setContextUsage({
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cacheReadTokens: m.cacheReadTokens,
        cacheCreationTokens: m.cacheCreationTokens,
        contextWindow: m.contextWindow,
      });
    },
    "chat:context_breakdown": function (msg: ServerMessage) {
      const m = msg as ChatContextBreakdownMessage;
      setContextBreakdown({
        segments: m.segments,
        contextWindow: m.contextWindow,
        autocompactAt: m.autocompactAt,
      });
    },
    "chat:permission_request": function (msg: ServerMessage) {
      const m = msg as ChatPermissionRequestMessage;
      const existing = getSessionStore().state.messages.findLastIndex(function (msg) {
        return msg.toolId === m.requestId && msg.type === "permission_request";
      });
      if (existing >= 0) return;
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
    },
    "chat:permission_resolved": function (msg: ServerMessage) {
      const m = msg as ChatPermissionResolvedMessage;
      updatePermissionStatus(m.requestId, m.status);
    },
    "chat:elicitation_request": function (msg: ServerMessage) {
      const m = msg as ChatElicitationRequestMessage;
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
    },
    "session:history_page_result": function (msg: ServerMessage) {
      const m = msg as { type: string; sessionId: string; messages: HistoryMessage[]; hasMore: boolean; totalMessages?: number };
      const state = getSessionStore().state;
      if (m.sessionId !== state.activeSessionId) return;
      getSessionStore().setState(function (s) {
        return {
          ...s,
          messages: mergeToolResults(m.messages).concat(s.messages),
          historyHasMore: m.hasMore,
          historyTotalMessages: m.totalMessages ?? s.historyTotalMessages,
        };
      });
    },
    "session:loading_progress": function (msg: ServerMessage) {
      const m = msg as { type: string; sessionId: string; fileSize: number | null };
      if (m.sessionId !== getSessionStore().state.activeSessionId) return;
      getSessionStore().setState(function (s) { return { ...s, historyLoadingFileSize: m.fileSize }; });
    },
    "session:history": function (msg: ServerMessage) {
      const m = msg as SessionHistoryMessage;
      const currentState = getSessionStore().state;
      const isStillLoading = currentState.activeSessionId === m.sessionId && currentState.historyLoading;
      if (m.sessionId && m.messages && m.messages.length === 0 && m.title && !isStillLoading) {
        updateSessionTabTitle(m.sessionId, m.title);
        if (m.sessionId === currentState.activeSessionId) {
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
        const projectSlug = m.projectSlug || getSessionStore().state.activeProjectSlug;
        setSidebarSessionId(m.sessionId);
        globalStreamSessionId = m.sessionId;
        if (m.title) {
          updateSessionTabTitle(m.sessionId, m.title);
        }
        const currentState = getSessionStore().state;
        const alreadyCached = currentState.activeSessionId === m.sessionId
          && !currentState.historyLoading
          && currentState.messages.length > 0;

        if (alreadyCached) {
          getSessionStore().setState(function (state) {
            const refreshed = m.messages && m.messages.length > 0 ? mergeToolResults(m.messages) : state.messages;
            return {
              ...state,
              activeSessionTitle: m.title ?? state.activeSessionTitle,
              messages: refreshed,
              historyHasMore: m.hasMore || state.historyHasMore,
              historyTotalMessages: m.totalMessages || state.historyTotalMessages,
              wasInterrupted: m.interrupted || false,
            };
          });
        } else {
          getSessionStore().setState(function (state) {
            const isActivelyStreaming = state.isProcessing && state.activeSessionId === m.sessionId;
            const historyMessages = mergeToolResults(m.messages);
            const finalMessages = isActivelyStreaming
              ? state.messages
              : historyMessages;
            return {
              ...state,
              activeProjectSlug: projectSlug,
              activeSessionId: m.sessionId,
              activeSessionTitle: m.title ?? state.activeSessionTitle,
              messages: finalMessages,
              isProcessing: isActivelyStreaming ? state.isProcessing : false,
              currentStatus: isActivelyStreaming ? state.currentStatus : null,
              pendingPermissionCount: isActivelyStreaming ? state.pendingPermissionCount : 0,
              lastResponseCost: isActivelyStreaming ? state.lastResponseCost : null,
              lastResponseDuration: isActivelyStreaming ? state.lastResponseDuration : null,
              lastReadIndex: null,
              historyLoading: false,
              historyHasMore: m.hasMore || false,
              historyTotalMessages: m.totalMessages || m.messages.length,
              wasInterrupted: isActivelyStreaming ? state.wasInterrupted : (m.interrupted || false),
              isPlanMode: isActivelyStreaming ? state.isPlanMode : false,
            };
          });
        }
        const storedIndex = getLastReadIndex(m.sessionId);
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
    },
    "chat:prompt_suggestion": function (msg: ServerMessage) {
      const m = msg as ChatPromptSuggestionMessage;
      setPromptSuggestion(m.suggestion);
    },
    "chat:prompt_request": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as { type: string; requestId: string; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string; preview?: string }>; multiSelect: boolean }> };
      addPromptQuestion(m.requestId, m.questions);
    },
    "chat:prompt_resolved": function () {},
    "chat:todo_update": function (msg: ServerMessage) {
      if (isStaleStream()) return;
      const m = msg as { type: string; todos: Array<{ id: string; content: string; status: string; priority: string }> };
      addTodoUpdate(m.todos);
    },
    "chat:plan_mode": function (msg: ServerMessage) {
      const m = msg as { type: string; active: boolean };
      setIsPlanMode(m.active);
    },
    "budget:status": function (msg: ServerMessage) {
      const m = msg as { type: string; dailySpend: number; dailyLimit: number; enforcement: "warning" | "soft-block" | "hard-block" };
      setBudgetStatus({ dailySpend: m.dailySpend, dailyLimit: m.dailyLimit, enforcement: m.enforcement });
    },
    "chat:rate_limit": function (msg: ServerMessage) {
      const m = msg as { type: string; status: "allowed" | "allowed_warning" | "rejected"; utilization?: number; resetsAt?: number; rateLimitType?: string; overageStatus?: string; overageResetsAt?: number; isUsingOverage?: boolean };
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
    },
    "budget:exceeded": function () {
      setBudgetExceeded(true);
      setIsProcessing(false);
      setCurrentStatus(null);
    },
    "context:tool_delta": function (msg: ServerMessage) {
      const m = msg as ContextToolDeltaMessage & { hookSessionId?: string };
      addToolDelta({ toolId: m.toolId, toolName: m.toolName, delta: m.delta, timestamp: m.timestamp }, m.hookSessionId);
    },
    "context:anomaly": function (msg: ServerMessage) {
      const m = msg as ContextAnomalyMessage & { hookSessionId?: string };
      addAnomaly({ toolId: m.toolId, toolName: m.toolName, observed: m.observed, expected: m.expected, stddev: m.stddev, zScore: m.zScore, timestamp: m.timestamp }, m.hookSessionId);
    },
    "context:baseline_stats": function (msg: ServerMessage) {
      const m = msg as ContextBaselineStatsMessage & { hookSessionId?: string };
      updateBaselines(m.tools, m.hookSessionId);
    },
    "context:burn_rate": function (msg: ServerMessage) {
      const m = msg as ContextBurnRateMessage & { hookSessionId?: string };
      updateBurnRate({ tokensPerMinute: m.tokensPerMinute, estimatedSecondsToCompact: m.estimatedSecondsToCompact, currentUsage: m.currentUsage, compactThreshold: m.compactThreshold }, m.hookSessionId);
    },
    "context:hooks_status": function (msg: ServerMessage) {
      const m = msg as ContextHooksStatusMessage;
      setHooksStatus(m.installed, m.message);
    },
    "context:statusline": function (msg: ServerMessage) {
      const m = msg as ContextStatuslineMessage;
      updateExternalSession({
        hookSessionId: m.hookSessionId,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        cacheReadTokens: m.cacheReadTokens,
        cacheCreationTokens: m.cacheCreationTokens,
        contextWindow: m.contextWindow,
        usedPercent: m.usedPercent,
        costUsd: m.costUsd,
        durationMs: m.durationMs,
        modelId: m.modelId,
        modelName: m.modelName,
        timestamp: m.timestamp,
        active: true,
        projectName: m.projectName || null,
        projectSlug: m.projectSlug || null,
      });
    },
    "context:tool_event": function (msg: ServerMessage) {
      const m = msg as ContextToolEventMessage;
      addToolEvent({
        hookSessionId: m.hookSessionId,
        toolName: m.toolName,
        inputSummary: m.inputSummary,
        estimatedInputTokens: m.estimatedInputTokens,
        estimatedOutputTokens: m.estimatedOutputTokens,
        estimatedTotalTokens: m.estimatedTotalTokens,
        timestamp: m.timestamp,
      }, m.hookSessionId, m.projectName, m.projectSlug);
    },
    "context:session_started": function (msg: ServerMessage) {
      const m = msg as ContextSessionEventMessage;
      if (m.type === "context:session_ended") {
        markExternalSessionEnded(m.hookSessionId);
      }
    },
    "context:session_ended": function (msg: ServerMessage) {
      const m = msg as ContextSessionEventMessage;
      if (m.type === "context:session_ended") {
        markExternalSessionEnded(m.hookSessionId);
      }
    },
    "context:compact": function () {},
  };

  const MESSAGE_TYPES = [
    "session:loading_progress", "chat:user_message", "chat:delta", "chat:tool_start",
    "chat:tool_result", "chat:done", "chat:error", "chat:permission_request",
    "chat:permission_resolved", "chat:status", "chat:context_usage", "chat:context_breakdown",
    "session:history", "session:history_page_result", "chat:prompt_suggestion",
    "chat:prompt_request", "chat:prompt_resolved", "chat:todo_update", "chat:plan_mode",
    "budget:status", "budget:exceeded", "chat:elicitation_request", "chat:rate_limit",
    "context:tool_delta", "context:anomaly", "context:baseline_stats", "context:burn_rate",
    "context:hooks_status", "context:statusline", "context:tool_event",
    "context:session_started", "context:session_ended", "context:compact",
  ];

  useEffect(function () {
    globalSubscriptionCount++;
    if (globalSubscriptionCount > 1) {
      return function () { globalSubscriptionCount--; };
    }

    for (let i = 0; i < MESSAGE_TYPES.length; i++) {
      subscribe(MESSAGE_TYPES[i], getDispatch(MESSAGE_TYPES[i]));
    }

    return function () {
      globalSubscriptionCount--;
      if (globalSubscriptionCount === 0) {
        for (let i = 0; i < MESSAGE_TYPES.length; i++) {
          unsubscribe(MESSAGE_TYPES[i], getDispatch(MESSAGE_TYPES[i]));
        }
        globalHandlersRef.current = null;
      }
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
      if (globalLastSentText) {
        setFailedInput(globalLastSentText);
        globalLastSentText = null;
      }
    },
    rateLimits: state.rateLimits,
    pendingSystemPrompt: state.pendingSystemPrompt,
    pendingAutoSend: state.pendingAutoSend,
    specContext: state.specContext,
  };
}
