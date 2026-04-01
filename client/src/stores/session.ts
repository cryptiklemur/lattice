import { Store } from "@tanstack/react-store";
import type { HistoryMessage } from "@lattice/shared";

export interface ContextUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  contextWindow: number;
}

export interface ContextBreakdownSegment {
  label: string;
  tokens: number;
  id: string;
  estimated: boolean;
}

export interface ContextBreakdown {
  segments: ContextBreakdownSegment[];
  contextWindow: number;
  autocompactAt: number;
}

export interface BudgetStatus {
  dailySpend: number;
  dailyLimit: number;
  enforcement: "warning" | "soft-block" | "hard-block";
}

export interface SessionState {
  messages: HistoryMessage[];
  isProcessing: boolean;
  activeProjectSlug: string | null;
  activeSessionId: string | null;
  activeSessionTitle: string | null;
  currentStatus: { phase: string; toolName?: string; elapsed?: number; summary?: string } | null;
  contextUsage: ContextUsage | null;
  contextBreakdown: ContextBreakdown | null;
  pendingPermissionCount: number;
  lastResponseCost: number | null;
  lastResponseDuration: number | null;
  lastReadIndex: number | null;
  historyLoading: boolean;
  historyHasMore: boolean;
  historyTotalMessages: number;
  wasInterrupted: boolean;
  promptSuggestion: string | null;
  failedInput: string | null;
  messageQueue: string[];
  isBusy: boolean;
  busyOwner: "cli" | "lattice" | null;
  isPlanMode: boolean;
  pendingPrefill: string | null;
  budgetStatus: BudgetStatus | null;
  budgetExceeded: boolean;
}

var sessionStore = new Store<SessionState>({
  messages: [],
  isProcessing: false,
  activeProjectSlug: null,
  activeSessionId: null,
  activeSessionTitle: null,
  currentStatus: null,
  contextUsage: null,
  contextBreakdown: null,
  pendingPermissionCount: 0,
  lastResponseCost: null,
  lastResponseDuration: null,
  lastReadIndex: null,
  historyLoading: false,
  historyHasMore: false,
  historyTotalMessages: 0,
  wasInterrupted: false,
  promptSuggestion: null,
  failedInput: null,
  messageQueue: [],
  isBusy: false,
  busyOwner: null,
  isPlanMode: false,
  pendingPrefill: null,
  budgetStatus: null,
  budgetExceeded: false,
});

var streamGeneration = 0;

export function getStreamGeneration(): number {
  return streamGeneration;
}

export function incrementStreamGeneration(): number {
  streamGeneration++;
  return streamGeneration;
}

var lastReadIndices = new Map<string, number>();
var sessionsWithUpdates = new Set<string>();

export function markSessionRead(sessionId: string, messageCount: number): void {
  lastReadIndices.set(sessionId, messageCount);
  sessionsWithUpdates.delete(sessionId);
}

export function getLastReadIndex(sessionId: string): number {
  return lastReadIndices.get(sessionId) ?? -1;
}

export function markSessionHasUpdates(sessionId: string): void {
  sessionsWithUpdates.add(sessionId);
}

export function sessionHasUpdates(sessionId: string): boolean {
  return sessionsWithUpdates.has(sessionId);
}

export function setLastReadIndex(index: number): void {
  sessionStore.setState(function (state) {
    return { ...state, lastReadIndex: index };
  });
}

var currentAssistantUuid: string | null = null;
var currentAssistantIndex: number = -1;

export function getSessionStore(): Store<SessionState> {
  return sessionStore;
}

export function mergeToolResults(messages: HistoryMessage[]): HistoryMessage[] {
  var result: HistoryMessage[] = [];
  var toolStartMap = new Map<string, number>();
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.type === "tool_start" && msg.toolId) {
      toolStartMap.set(msg.toolId, result.length);
      result.push({ ...msg });
    } else if (msg.type === "tool_result" && msg.toolId) {
      var startIdx = toolStartMap.get(msg.toolId);
      if (startIdx !== undefined) {
        result[startIdx] = { ...result[startIdx], content: msg.content };
      }
    } else {
      result.push(msg);
    }
  }
  for (var j = 0; j < result.length; j++) {
    if (result[j].type === "tool_start" && !result[j].content) {
      result[j] = { ...result[j], content: "(no output)" };
    }
  }
  return result;
}

export function setSessionMessages(messages: HistoryMessage[]): void {
  currentAssistantIndex = -1;
  var merged = mergeToolResults(messages);
  sessionStore.setState(function (state) {
    return { ...state, messages: merged };
  });
}

export function addSessionMessage(message: HistoryMessage): void {
  sessionStore.setState(function (state) {
    var newMessages = [...state.messages, message];
    if (message.type === "assistant" && message.uuid) {
      currentAssistantIndex = newMessages.length - 1;
    }
    return { ...state, messages: newMessages };
  });
}

export function updateLastAssistantMessage(uuid: string, deltaText: string): void {
  sessionStore.setState(function (state) {
    var idx = currentAssistantIndex;
    if (idx === -1 || idx >= state.messages.length || state.messages[idx].uuid !== uuid) {
      idx = state.messages.findLastIndex(function (msg) {
        return msg.uuid === uuid;
      });
      if (idx === -1) {
        return state;
      }
      currentAssistantIndex = idx;
    }
    var updated = state.messages.slice();
    updated[idx] = {
      ...updated[idx],
      text: (updated[idx].text || "") + deltaText,
    };
    return { ...state, messages: updated };
  });
}

export function updateToolResult(toolId: string, content: string): void {
  sessionStore.setState(function (state) {
    var idx = state.messages.findLastIndex(function (msg) {
      return msg.toolId === toolId && msg.type === "tool_start";
    });
    if (idx === -1) {
      return state;
    }
    var updated = state.messages.slice();
    updated[idx] = { ...updated[idx], content: content };
    return { ...state, messages: updated };
  });
}

export function setIsProcessing(processing: boolean): void {
  sessionStore.setState(function (state) {
    return { ...state, isProcessing: processing };
  });
}

export function setActiveSession(projectSlug: string | null, sessionId: string | null, title?: string | null): void {
  var prevSessionId = sessionStore.state.activeSessionId;
  if (prevSessionId) {
    markSessionRead(prevSessionId, sessionStore.state.messages.length);
  }
  currentAssistantUuid = null;
  incrementStreamGeneration();
  sessionStore.setState(function (state) {
    return {
      ...state,
      activeProjectSlug: projectSlug,
      activeSessionId: sessionId,
      activeSessionTitle: title ?? null,
      messages: [],
      isProcessing: false,
      currentStatus: null,
      contextUsage: null,
      contextBreakdown: null,
      pendingPermissionCount: 0,
      lastResponseCost: null,
      lastResponseDuration: null,
      lastReadIndex: null,
      historyLoading: true,
      wasInterrupted: false,
      promptSuggestion: null,
      failedInput: null,
      messageQueue: [],
      isBusy: false,
      isPlanMode: false,
      pendingPrefill: state.pendingPrefill,
    };
  });
}

export function setSessionTitle(title: string | null): void {
  sessionStore.setState(function (state) {
    return { ...state, activeSessionTitle: title };
  });
}

export function setCurrentStatus(status: SessionState["currentStatus"]): void {
  sessionStore.setState(function (state) {
    return { ...state, currentStatus: status };
  });
}

export function setContextUsage(usage: ContextUsage): void {
  sessionStore.setState(function (state) {
    var prev = state.contextUsage;
    var contextWindow = usage.contextWindow > 0 ? usage.contextWindow : (prev ? prev.contextWindow : 0);
    return {
      ...state,
      contextUsage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        contextWindow: contextWindow,
      },
    };
  });
}

export function clearSession(): void {
  var prevSessionId = sessionStore.state.activeSessionId;
  if (prevSessionId) {
    markSessionRead(prevSessionId, sessionStore.state.messages.length);
  }
  currentAssistantUuid = null;
  currentAssistantIndex = -1;
  sessionStore.setState(function () {
    return {
      messages: [],
      isProcessing: false,
      activeProjectSlug: null,
      activeSessionId: null,
      activeSessionTitle: null,
      currentStatus: null,
      contextUsage: null,
      contextBreakdown: null,
      pendingPermissionCount: 0,
      lastResponseCost: null,
      lastResponseDuration: null,
      lastReadIndex: null,
      historyLoading: false,
      historyHasMore: false,
      historyTotalMessages: 0,
      wasInterrupted: false,
      promptSuggestion: null,
      failedInput: null,
      messageQueue: [],
      isBusy: false,
      busyOwner: null,
      isPlanMode: false,
      pendingPrefill: null,
      budgetStatus: null,
      budgetExceeded: false,
    };
  });
}

export function setLastResponseStats(cost: number, duration: number): void {
  sessionStore.setState(function (state) {
    return { ...state, lastResponseCost: cost, lastResponseDuration: duration };
  });
}

export function setWasInterrupted(interrupted: boolean): void {
  sessionStore.setState(function (state) {
    return { ...state, wasInterrupted: interrupted };
  });
}

export function setPromptSuggestion(suggestion: string | null): void {
  sessionStore.setState(function (state) {
    return { ...state, promptSuggestion: suggestion };
  });
}

export function setFailedInput(text: string | null): void {
  sessionStore.setState(function (state) {
    return { ...state, failedInput: text };
  });
}

export function setSessionBusy(busy: boolean, owner?: "cli" | "lattice" | null): void {
  sessionStore.setState(function (state) {
    return { ...state, isBusy: busy, busyOwner: busy ? (owner ?? null) : null };
  });
}

export function setIsPlanMode(active: boolean): void {
  sessionStore.setState(function (state) {
    return { ...state, isPlanMode: active };
  });
}

export function setBudgetStatus(status: BudgetStatus | null): void {
  sessionStore.setState(function (state) {
    return { ...state, budgetStatus: status };
  });
}

export function setBudgetExceeded(exceeded: boolean): void {
  sessionStore.setState(function (state) {
    return { ...state, budgetExceeded: exceeded };
  });
}

export function setPendingPrefill(text: string | null): void {
  sessionStore.setState(function (state) {
    return { ...state, pendingPrefill: text };
  });
}

export function addPromptQuestion(requestId: string, questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string; preview?: string }>; multiSelect: boolean }>): void {
  sessionStore.setState(function (state) {
    return {
      ...state,
      messages: [...state.messages, {
        type: "prompt_question",
        toolId: requestId,
        promptQuestions: questions,
        promptStatus: "pending",
        timestamp: Date.now(),
      } as HistoryMessage],
    };
  });
}

export function resolvePromptQuestion(requestId: string, answers: Record<string, string>): void {
  sessionStore.setState(function (state) {
    return {
      ...state,
      messages: state.messages.map(function (msg) {
        if (msg.type === "prompt_question" && msg.toolId === requestId) {
          return { ...msg, promptAnswers: answers, promptStatus: "answered" };
        }
        return msg;
      }),
    };
  });
}

export function addTodoUpdate(todos: Array<{ id: string; content: string; status: string; priority: string }>): void {
  sessionStore.setState(function (state) {
    var existingIndex = -1;
    for (var i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].type === "todo_update") {
        existingIndex = i;
        break;
      }
    }
    if (existingIndex >= 0) {
      var updated = state.messages.slice();
      updated[existingIndex] = { ...updated[existingIndex], todos: todos, timestamp: Date.now() } as HistoryMessage;
      return { ...state, messages: updated };
    }
    return {
      ...state,
      messages: [...state.messages, {
        type: "todo_update",
        todos: todos,
        timestamp: Date.now(),
      } as HistoryMessage],
    };
  });
}

export function enqueueMessage(text: string): void {
  sessionStore.setState(function (state) {
    return { ...state, messageQueue: [...state.messageQueue, text] };
  });
}

export function dequeueMessage(): string | null {
  var queue = sessionStore.state.messageQueue;
  if (queue.length === 0) return null;
  var first = queue[0];
  sessionStore.setState(function (state) {
    return { ...state, messageQueue: state.messageQueue.slice(1) };
  });
  return first;
}

export function removeQueuedMessage(index: number): void {
  sessionStore.setState(function (state) {
    var updated = state.messageQueue.slice();
    updated.splice(index, 1);
    return { ...state, messageQueue: updated };
  });
}

export function updateQueuedMessage(index: number, text: string): void {
  sessionStore.setState(function (state) {
    var updated = state.messageQueue.slice();
    updated[index] = text;
    return { ...state, messageQueue: updated };
  });
}

export function clearMessageQueue(): void {
  sessionStore.setState(function (state) {
    return { ...state, messageQueue: [] };
  });
}

export function setContextBreakdown(breakdown: ContextBreakdown): void {
  sessionStore.setState(function (state) {
    return { ...state, contextBreakdown: breakdown };
  });
}

export function getCurrentAssistantUuid(): string | null {
  return currentAssistantUuid;
}

export function setCurrentAssistantUuid(uuid: string | null): void {
  currentAssistantUuid = uuid;
  if (uuid === null) {
    currentAssistantIndex = -1;
  }
}

export function incrementPendingPermissions(): void {
  sessionStore.setState(function (state) {
    return { ...state, pendingPermissionCount: state.pendingPermissionCount + 1 };
  });
}

export function updatePermissionStatus(requestId: string, status: string): void {
  sessionStore.setState(function (state) {
    var idx = state.messages.findLastIndex(function (msg) {
      return msg.toolId === requestId && msg.type === "permission_request";
    });
    if (idx === -1) {
      return { ...state, pendingPermissionCount: Math.max(0, state.pendingPermissionCount - 1) };
    }
    var updated = state.messages.slice();
    updated[idx] = { ...updated[idx], permissionStatus: status as HistoryMessage["permissionStatus"] };
    return {
      ...state,
      messages: updated,
      pendingPermissionCount: Math.max(0, state.pendingPermissionCount - 1),
    };
  });
}
