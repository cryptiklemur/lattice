import { Store } from "@tanstack/react-store";
import type { TokenDelta, ToolBaseline } from "#shared";

export interface ToolDeltaEntry {
  toolId: string;
  toolName: string;
  delta: TokenDelta;
  timestamp: number;
}

export interface AnomalyEntry {
  toolId: string;
  toolName: string;
  observed: number;
  expected: number;
  stddev: number;
  zScore: number;
  timestamp: number;
  dismissed: boolean;
}

export interface BurnRate {
  tokensPerMinute: number;
  estimatedSecondsToCompact: number | null;
  currentUsage: number;
  compactThreshold: number;
}

export interface ToolEventEntry {
  hookSessionId: string;
  toolName: string;
  inputSummary: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  timestamp: number;
}

export interface SessionAnalysis {
  deltas: ToolDeltaEntry[];
  anomalies: AnomalyEntry[];
  baselines: Record<string, ToolBaseline>;
  burnRate: BurnRate | null;
  toolEvents: ToolEventEntry[];
}

export interface ExternalSessionSnapshot {
  hookSessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  contextWindow: number;
  usedPercent: number;
  costUsd: number;
  durationMs: number;
  modelId: string;
  modelName: string;
  timestamp: number;
  active: boolean;
  projectName: string | null;
  projectSlug: string | null;
}

export interface ContextAnalyzerState {
  /** Analysis data for the active Lattice-managed session */
  activeSession: SessionAnalysis;
  /** Per-session analysis data from external CLI sessions */
  sessionAnalysis: Record<string, SessionAnalysis>;
  hooksInstalled: boolean | null;
  hooksMessage: string | null;
  externalSessions: Record<string, ExternalSessionSnapshot>;
  /** Which session is selected for viewing (null = active Lattice session) */
  selectedSessionId: string | null;
}

var MAX_DELTAS = 500;
var MAX_TOOL_EVENTS = 500;
var MAX_ANOMALIES = 200;

function emptyAnalysis(): SessionAnalysis {
  return { deltas: [], anomalies: [], baselines: {}, burnRate: null, toolEvents: [] };
}

function cappedAppend<T>(arr: T[], item: T, max: number): T[] {
  var next = [...arr, item];
  return next.length > max ? next.slice(next.length - max) : next;
}

const contextAnalyzerStore = new Store<ContextAnalyzerState>({
  activeSession: emptyAnalysis(),
  sessionAnalysis: {},
  hooksInstalled: null,
  hooksMessage: null,
  externalSessions: {},
  selectedSessionId: null,
});

export function getContextAnalyzerStore(): Store<ContextAnalyzerState> {
  return contextAnalyzerStore;
}

function getSessionAnalysis(state: ContextAnalyzerState, sessionId: string | null): SessionAnalysis {
  if (!sessionId) return state.activeSession;
  return state.sessionAnalysis[sessionId] || emptyAnalysis();
}

function updateSessionAnalysis(state: ContextAnalyzerState, sessionId: string | null, updater: (a: SessionAnalysis) => SessionAnalysis): ContextAnalyzerState {
  if (!sessionId) {
    return { ...state, activeSession: updater(state.activeSession) };
  }
  var existing = state.sessionAnalysis[sessionId] || emptyAnalysis();
  return {
    ...state,
    sessionAnalysis: { ...state.sessionAnalysis, [sessionId]: updater(existing) },
  };
}

export function addToolDelta(delta: ToolDeltaEntry, hookSessionId?: string): void {
  contextAnalyzerStore.setState(function (s) {
    return updateSessionAnalysis(s, hookSessionId || null, function (a) {
      return { ...a, deltas: cappedAppend(a.deltas, delta, MAX_DELTAS) };
    });
  });
}

export function addAnomaly(anomaly: Omit<AnomalyEntry, "dismissed">, hookSessionId?: string): void {
  contextAnalyzerStore.setState(function (s) {
    return updateSessionAnalysis(s, hookSessionId || null, function (a) {
      return { ...a, anomalies: cappedAppend(a.anomalies, { ...anomaly, dismissed: false }, MAX_ANOMALIES) };
    });
  });
}

export function dismissAnomaly(toolId: string, timestamp: number): void {
  contextAnalyzerStore.setState(function (s) {
    var sid = s.selectedSessionId;
    return updateSessionAnalysis(s, sid, function (a) {
      return {
        ...a,
        anomalies: a.anomalies.map(function (an) {
          if (an.toolId === toolId && an.timestamp === timestamp) {
            return { ...an, dismissed: true };
          }
          return an;
        }),
      };
    });
  });
}

export function updateBaselines(tools: Record<string, ToolBaseline>, hookSessionId?: string): void {
  contextAnalyzerStore.setState(function (s) {
    return updateSessionAnalysis(s, hookSessionId || null, function (a) {
      return { ...a, baselines: tools };
    });
  });
}

export function updateBurnRate(burnRate: BurnRate, hookSessionId?: string): void {
  contextAnalyzerStore.setState(function (s) {
    return updateSessionAnalysis(s, hookSessionId || null, function (a) {
      return { ...a, burnRate };
    });
  });
}

export function addToolEvent(event: ToolEventEntry, hookSessionId?: string, projectName?: string | null, projectSlug?: string | null): void {
  contextAnalyzerStore.setState(function (s) {
    var updated = updateSessionAnalysis(s, hookSessionId || null, function (a) {
      return { ...a, toolEvents: cappedAppend(a.toolEvents, event, MAX_TOOL_EVENTS) };
    });
    if (hookSessionId && (projectName || projectSlug)) {
      var existing = updated.externalSessions[hookSessionId];
      if (existing && !existing.projectName) {
        updated = {
          ...updated,
          externalSessions: { ...updated.externalSessions, [hookSessionId]: { ...existing, projectName: projectName || null, projectSlug: projectSlug || null } },
        };
      }
    }
    return updated;
  });
}

export function setHooksStatus(installed: boolean, message?: string): void {
  contextAnalyzerStore.setState(function (s) {
    return { ...s, hooksInstalled: installed, hooksMessage: message || null };
  });
}

export function updateExternalSession(snapshot: ExternalSessionSnapshot): void {
  contextAnalyzerStore.setState(function (s) {
    var existing = s.externalSessions[snapshot.hookSessionId];
    var merged = existing
      ? { ...snapshot, projectName: snapshot.projectName || existing.projectName, projectSlug: snapshot.projectSlug || existing.projectSlug }
      : snapshot;
    return {
      ...s,
      externalSessions: { ...s.externalSessions, [snapshot.hookSessionId]: merged },
    };
  });
}

export function markExternalSessionEnded(hookSessionId: string): void {
  contextAnalyzerStore.setState(function (s) {
    var session = s.externalSessions[hookSessionId];
    if (!session) return s;
    return {
      ...s,
      externalSessions: { ...s.externalSessions, [hookSessionId]: { ...session, active: false } },
    };
  });
}

export function selectSession(sessionId: string | null): void {
  contextAnalyzerStore.setState(function (s) {
    return { ...s, selectedSessionId: sessionId };
  });
}

export function getSelectedAnalysis(state: ContextAnalyzerState): SessionAnalysis {
  return getSessionAnalysis(state, state.selectedSessionId);
}

export function resetContextAnalyzer(): void {
  contextAnalyzerStore.setState(function (s) {
    return {
      ...s,
      activeSession: emptyAnalysis(),
      selectedSessionId: null,
    };
  });
}
