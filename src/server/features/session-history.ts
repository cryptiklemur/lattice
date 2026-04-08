import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getLatticeHome } from "../config";
import { log } from "../logger";

export interface HistoricalSession {
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
  endedAt: number | null;
  active: boolean;
  projectName: string | null;
  projectSlug: string | null;
  toolEvents: HistoricalToolEvent[];
  toolDeltas: HistoricalToolDelta[];
  anomalyCount: number;
}

export interface HistoricalToolEvent {
  toolName: string;
  inputSummary: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  timestamp: number;
}

export interface HistoricalToolDelta {
  toolName: string;
  total: number;
  timestamp: number;
}

function getSessionDir(): string {
  const dir = join(getLatticeHome(), "session-history");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function sessionPath(hookSessionId: string): string {
  const safe = hookSessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(getSessionDir(), safe + ".json");
}

const sessionCache = new Map<string, HistoricalSession>();
let indexLoaded = false;

export function loadSessionHistory(): HistoricalSession[] {
  if (indexLoaded) return Array.from(sessionCache.values());

  const dir = getSessionDir();
  try {
    const files = readdirSync(dir).filter(function (f) { return f.endsWith(".json"); });
    for (const file of files) {
      try {
        const raw = readFileSync(join(dir, file), "utf-8");
        const session = JSON.parse(raw) as HistoricalSession;
        if (session.hookSessionId) {
          sessionCache.set(session.hookSessionId, session);
        }
      } catch {
        log.server("Failed to read session history file: %s", file);
      }
    }
    indexLoaded = true;
    log.server("Loaded %d historical sessions", sessionCache.size);
  } catch {
    indexLoaded = true;
  }
  return Array.from(sessionCache.values());
}

export function saveSession(session: HistoricalSession): void {
  sessionCache.set(session.hookSessionId, session);
  try {
    const path = sessionPath(session.hookSessionId);
    writeFileSync(path, JSON.stringify(session), "utf-8");
  } catch (err) {
    log.server("Failed to save session history: %s", String(err));
  }
}

export function getSession(hookSessionId: string): HistoricalSession | null {
  return sessionCache.get(hookSessionId) || null;
}

export function upsertFromSnapshot(
  hookSessionId: string,
  snapshot: {
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
    projectName: string | null;
    projectSlug: string | null;
  }
): void {
  let existing = sessionCache.get(hookSessionId);
  if (!existing) {
    existing = {
      hookSessionId,
      ...snapshot,
      timestamp: Date.now(),
      endedAt: null,
      active: true,
      toolEvents: [],
      toolDeltas: [],
      anomalyCount: 0,
    };
  } else {
    existing.inputTokens = snapshot.inputTokens;
    existing.outputTokens = snapshot.outputTokens;
    existing.cacheReadTokens = snapshot.cacheReadTokens;
    existing.cacheCreationTokens = snapshot.cacheCreationTokens;
    existing.contextWindow = snapshot.contextWindow;
    existing.usedPercent = snapshot.usedPercent;
    existing.costUsd = snapshot.costUsd;
    existing.durationMs = snapshot.durationMs;
    existing.modelId = snapshot.modelId || existing.modelId;
    existing.modelName = snapshot.modelName || existing.modelName;
    existing.projectName = snapshot.projectName || existing.projectName;
    existing.projectSlug = snapshot.projectSlug || existing.projectSlug;
    existing.timestamp = Date.now();
  }
  saveSession(existing);
}

export function addToolEventToHistory(
  hookSessionId: string,
  event: HistoricalToolEvent
): void {
  const existing = sessionCache.get(hookSessionId);
  if (!existing) return;
  if (existing.toolEvents.length >= 500) {
    existing.toolEvents = existing.toolEvents.slice(-499);
  }
  existing.toolEvents.push(event);
}

export function addToolDeltaToHistory(
  hookSessionId: string,
  delta: HistoricalToolDelta
): void {
  const existing = sessionCache.get(hookSessionId);
  if (!existing) return;
  if (existing.toolDeltas.length >= 500) {
    existing.toolDeltas = existing.toolDeltas.slice(-499);
  }
  existing.toolDeltas.push(delta);
}

export function markSessionEnded(hookSessionId: string): void {
  const existing = sessionCache.get(hookSessionId);
  if (!existing) return;
  existing.active = false;
  existing.endedAt = Date.now();
  saveSession(existing);
}

export function listSessions(options?: {
  projectSlug?: string;
  active?: boolean;
  limit?: number;
}): HistoricalSession[] {
  let sessions = Array.from(sessionCache.values());

  if (options?.projectSlug) {
    sessions = sessions.filter(function (s) { return s.projectSlug === options.projectSlug; });
  }
  if (options?.active !== undefined) {
    sessions = sessions.filter(function (s) { return s.active === options.active; });
  }

  sessions.sort(function (a, b) { return b.timestamp - a.timestamp; });

  if (options?.limit) {
    sessions = sessions.slice(0, options.limit);
  }

  return sessions;
}
