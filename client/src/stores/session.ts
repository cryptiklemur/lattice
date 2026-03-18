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
});

var currentAssistantUuid: string | null = null;

export function getSessionStore(): Store<SessionState> {
  return sessionStore;
}

export function setSessionMessages(messages: HistoryMessage[]): void {
  sessionStore.setState(function (state) {
    return { ...state, messages: messages };
  });
}

export function addSessionMessage(message: HistoryMessage): void {
  sessionStore.setState(function (state) {
    return { ...state, messages: [...state.messages, message] };
  });
}

export function updateLastAssistantMessage(uuid: string, deltaText: string): void {
  sessionStore.setState(function (state) {
    var idx = state.messages.findLastIndex(function (msg) {
      return msg.uuid === uuid;
    });
    if (idx === -1) {
      return state;
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
  currentAssistantUuid = null;
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
  currentAssistantUuid = null;
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
    };
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
    updated[idx] = { ...updated[idx], permissionStatus: status as any };
    return {
      ...state,
      messages: updated,
      pendingPermissionCount: Math.max(0, state.pendingPermissionCount - 1),
    };
  });
}
