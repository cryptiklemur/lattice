import type { Request, Response } from "express";
import { resolve } from "node:path";
import { ContextAnalyzer } from "../features/context-analyzer";
import { broadcast } from "../ws/broadcast";
import { loadConfig } from "../config";
import { log } from "../logger";
import { upsertFromSnapshot, addToolEventToHistory, markSessionEnded } from "../features/session-history";

var sessionProjectMap = new Map<string, { projectName: string; projectSlug: string }>();

function matchCwdToProject(cwd: string): { projectName: string; projectSlug: string } | null {
  var config = loadConfig();
  var resolved = resolve(cwd);
  for (var i = 0; i < config.projects.length; i++) {
    var p = config.projects[i];
    var projectPath = resolve(p.path);
    if (resolved === projectPath || resolved.startsWith(projectPath + "/")) {
      return { projectName: p.title, projectSlug: p.slug };
    }
  }
  return null;
}

/** Raw statusline JSON from Claude Code (nested structure) */
interface RawStatuslinePayload {
  session_id: string;
  context_window?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    context_window_size?: number;
    used_percentage?: number;
    remaining_percentage?: number;
  };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  model?: {
    id?: string;
    display_name?: string;
  };
  rate_limits?: {
    five_hour?: { used_percentage?: number };
    seven_day?: { used_percentage?: number };
  };
}

interface HookEventPayload {
  event_type: string;
  session_id: string;
  timestamp_ms: number;
  tool_name?: string;
  tool_input_summary?: string;
  estimated_tokens?: number;
  estimated_input_tokens?: number;
  estimated_response_tokens?: number;
  payload?: Record<string, unknown>;
}

const sessionAnalyzers = new Map<string, ContextAnalyzer>();

function getOrCreateAnalyzer(sessionId: string): ContextAnalyzer {
  let analyzer = sessionAnalyzers.get(sessionId);
  if (!analyzer) {
    analyzer = new ContextAnalyzer(function (msg) {
      broadcast({ ...msg, hookSessionId: sessionId });
    });
    sessionAnalyzers.set(sessionId, analyzer);
  }
  return analyzer;
}

function cleanupSession(sessionId: string): void {
  sessionAnalyzers.delete(sessionId);
}

export function handleHookStatusline(req: Request, res: Response): void {
  const body = req.body as RawStatuslinePayload;
  if (!body.session_id) {
    res.status(400).json({ status: "error", message: "missing session_id" });
    return;
  }

  const cw = body.context_window || {};
  const cost = body.cost || {};
  const model = body.model || {};

  const inputTokens = cw.total_input_tokens || 0;
  const outputTokens = cw.total_output_tokens || 0;
  const cacheReadTokens = cw.cache_read_input_tokens || 0;
  const cacheCreationTokens = cw.cache_creation_input_tokens || 0;
  const contextWindow = cw.context_window_size || 0;
  const usedPercent = cw.used_percentage || 0;
  const costUsd = cost.total_cost_usd || 0;
  const durationMs = cost.total_duration_ms || 0;
  const modelId = model.id || "";
  const modelName = model.display_name || "";

  const analyzer = getOrCreateAnalyzer(body.session_id);
  analyzer.updateUsage({
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  }, contextWindow);

  var statusProject = sessionProjectMap.get(body.session_id) || null;

  broadcast({
    type: "context:statusline",
    hookSessionId: body.session_id,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    contextWindow,
    usedPercent,
    costUsd,
    durationMs,
    modelId,
    modelName,
    timestamp: Date.now(),
    projectName: statusProject?.projectName || null,
    projectSlug: statusProject?.projectSlug || null,
  });

  upsertFromSnapshot(body.session_id, {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    contextWindow,
    usedPercent,
    costUsd,
    durationMs,
    modelId,
    modelName,
    projectName: statusProject?.projectName || null,
    projectSlug: statusProject?.projectSlug || null,
  });

  res.status(202).json({ status: "accepted" });
}

export function handleHookEvent(req: Request, res: Response): void {
  const body = req.body as HookEventPayload;
  if (!body.session_id || !body.event_type) {
    res.status(400).json({ status: "error", message: "missing session_id or event_type" });
    return;
  }

  const analyzer = getOrCreateAnalyzer(body.session_id);

  switch (body.event_type) {
    case "PostToolUse": {
      if (body.tool_name) {
        const toolId = body.session_id + "-" + body.timestamp_ms;
        analyzer.onToolStart(toolId, body.tool_name);
        // For hook-based flow, the tool already ran. Mark result immediately.
        // The next statusline snapshot will trigger the delta computation.
        analyzer.onToolResult(toolId);
      }
      break;
    }
    case "Stop": {
      cleanupSession(body.session_id);
      markSessionEnded(body.session_id);
      broadcast({
        type: "context:session_ended",
        hookSessionId: body.session_id,
        timestamp: body.timestamp_ms || Date.now(),
      });
      break;
    }
    case "SessionStart": {
      // Reset analyzer for fresh session
      cleanupSession(body.session_id);
      getOrCreateAnalyzer(body.session_id);
      broadcast({
        type: "context:session_started",
        hookSessionId: body.session_id,
        timestamp: body.timestamp_ms || Date.now(),
      });
      break;
    }
    case "PreCompact": {
      broadcast({
        type: "context:compact",
        hookSessionId: body.session_id,
        phase: "pre",
        timestamp: body.timestamp_ms || Date.now(),
      });
      break;
    }
    case "PostCompact": {
      broadcast({
        type: "context:compact",
        hookSessionId: body.session_id,
        phase: "post",
        timestamp: body.timestamp_ms || Date.now(),
      });
      break;
    }
    default:
      break;
  }

  log.server("Hook event: %s for session %s", body.event_type, body.session_id.slice(0, 8));
  res.status(202).json({ status: "accepted" });
}

/** Raw PostToolUse JSON from Claude Code hook */
interface RawToolUsePayload {
  session_id: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  cwd?: string;
}

function estimateTokens(value: unknown): number {
  if (value == null) return 0;
  var text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(text.length / 4);
}

function summarizeInput(toolName: string, input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input.slice(0, 120);
  if (typeof input === "object") {
    var obj = input as Record<string, unknown>;
    if (obj.command) return String(obj.command).slice(0, 120);
    if (obj.file_path) return String(obj.file_path);
    if (obj.pattern) return String(obj.pattern).slice(0, 120);
    if (obj.query) return String(obj.query).slice(0, 120);
    if (obj.prompt) return String(obj.prompt).slice(0, 120);
    var keys = Object.keys(obj);
    if (keys.length > 0) return keys.slice(0, 3).join(", ");
  }
  return "";
}

export function handleHookToolUse(req: Request, res: Response): void {
  var body = req.body as RawToolUsePayload;
  if (!body.session_id) {
    res.status(400).json({ status: "error", message: "missing session_id" });
    return;
  }

  var toolName = body.tool_name || "unknown";
  var inputSummary = summarizeInput(toolName, body.tool_input);
  var estInput = estimateTokens(body.tool_input);
  var estOutput = estimateTokens(body.tool_response);
  var now = Date.now();

  if (body.cwd && !sessionProjectMap.has(body.session_id)) {
    var match = matchCwdToProject(body.cwd);
    if (match) {
      sessionProjectMap.set(body.session_id, match);
    }
  }
  var sessionProject = sessionProjectMap.get(body.session_id) || null;

  var analyzer = getOrCreateAnalyzer(body.session_id);
  var toolId = body.session_id + "-" + now;
  analyzer.onToolStart(toolId, toolName);
  analyzer.onToolResult(toolId);

  broadcast({
    type: "context:tool_event",
    hookSessionId: body.session_id,
    toolName,
    inputSummary,
    estimatedInputTokens: estInput,
    estimatedOutputTokens: estOutput,
    estimatedTotalTokens: estInput + estOutput,
    timestamp: now,
    projectName: sessionProject?.projectName || null,
    projectSlug: sessionProject?.projectSlug || null,
  });

  addToolEventToHistory(body.session_id, {
    toolName,
    inputSummary,
    estimatedInputTokens: estInput,
    estimatedOutputTokens: estOutput,
    estimatedTotalTokens: estInput + estOutput,
    timestamp: now,
  });

  log.server("Hook tool_use: %s %s for session %s", toolName, inputSummary.slice(0, 40), body.session_id.slice(0, 8));
  res.status(202).json({ status: "accepted" });
}

export function getHookSessionAnalyzers(): Map<string, ContextAnalyzer> {
  return sessionAnalyzers;
}
