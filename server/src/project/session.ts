import {
  listSessions as sdkListSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession as sdkRenameSession,
} from "@anthropic-ai/claude-agent-sdk";
import type { SDKSessionInfo, SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type { HistoryMessage, SessionSummary } from "@lattice/shared";
import { loadConfig } from "../config";

function getProjectPath(projectSlug: string): string | null {
  var config = loadConfig();
  var project = config.projects.find(function (p) { return p.slug === projectSlug; });
  return project ? project.path : null;
}

function projectPathToHash(projectPath: string): string {
  return projectPath.replace(/\//g, "-");
}

function mapSDKSession(info: SDKSessionInfo, projectSlug: string): SessionSummary {
  return {
    id: info.sessionId,
    projectSlug,
    title: info.customTitle || info.summary || info.firstPrompt || "Untitled",
    createdAt: info.createdAt || info.lastModified,
    updatedAt: info.lastModified,
  };
}

var LITELLM_PRICING_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

var pricingCache: Record<string, { input: number; output: number; cacheRead?: number; cacheCreation?: number }> = {};
var pricingLoaded = false;

var FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.80, output: 4 },
};

function loadPricing(): void {
  if (pricingLoaded) return;
  pricingLoaded = true;
  fetch(LITELLM_PRICING_URL).then(function (res) {
    return res.json();
  }).then(function (data: Record<string, Record<string, unknown>>) {
    for (var key in data) {
      if (!key.includes("claude")) continue;
      var entry = data[key];
      var inputCost = entry.input_cost_per_token as number | undefined;
      var outputCost = entry.output_cost_per_token as number | undefined;
      if (inputCost == null || outputCost == null) continue;
      var modelId = key.replace("anthropic/", "").replace("claude-", "claude-");
      pricingCache[modelId] = {
        input: inputCost * 1000000,
        output: outputCost * 1000000,
        cacheRead: entry.cache_read_input_token_cost != null ? (entry.cache_read_input_token_cost as number) * 1000000 : undefined,
        cacheCreation: entry.cache_creation_input_token_cost != null ? (entry.cache_creation_input_token_cost as number) * 1000000 : undefined,
      };
      pricingCache[key] = pricingCache[modelId];
    }
  }).catch(function () {});
}

loadPricing();

function getPricing(model: string): { input: number; output: number; cacheRead?: number; cacheCreation?: number } {
  if (pricingCache[model]) return pricingCache[model];
  for (var key in pricingCache) {
    if (key.includes(model) || model.includes(key)) return pricingCache[key];
  }
  var shortModel = model.replace("claude-", "").split("-")[0];
  for (var key2 in pricingCache) {
    if (key2.includes(shortModel)) return pricingCache[key2];
  }
  if (FALLBACK_PRICING[model]) {
    return FALLBACK_PRICING[model];
  }
  return FALLBACK_PRICING["claude-sonnet-4-6"];
}

function estimateCost(model: string, inputTokens: number, outputTokens: number, cacheRead: number, cacheCreation: number): number {
  var pricing = getPricing(model);
  var normalInput = inputTokens - cacheRead - cacheCreation;
  var inputCost = (normalInput * pricing.input) / 1000000;
  var cacheCost = pricing.cacheRead != null
    ? (cacheRead * pricing.cacheRead) / 1000000
    : (cacheRead * pricing.input * 0.1) / 1000000;
  var cacheCreateCost = pricing.cacheCreation != null
    ? (cacheCreation * pricing.cacheCreation) / 1000000
    : (cacheCreation * pricing.input * 1.25) / 1000000;
  var outputCost = (outputTokens * pricing.output) / 1000000;
  return Math.max(0, inputCost + cacheCost + cacheCreateCost + outputCost);
}

function parseTimestamp(msg: SessionMessage): number {
  var raw = (msg as unknown as { timestamp?: string }).timestamp;
  if (raw) {
    var parsed = new Date(raw).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

function stripXmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function isSystemContent(text: string): boolean {
  return text.startsWith("<local-command-caveat>")
    || text.startsWith("<system-reminder>")
    || text.startsWith("<local-command-stdout>")
    || text.startsWith("<command-name>")
    || text.startsWith("<command-message>");
}

function extractUserText(content: unknown): string {
  if (typeof content === "string") {
    if (isSystemContent(content)) return "";
    return stripXmlTags(content);
  }
  if (Array.isArray(content)) {
    for (var i = 0; i < content.length; i++) {
      var block = content[i] as { type?: string; text?: string };
      if (block.type === "text" && typeof block.text === "string") {
        if (isSystemContent(block.text)) continue;
        var cleaned = stripXmlTags(block.text);
        if (cleaned) return cleaned;
      }
    }
  }
  return "";
}

function convertSessionMessages(messages: SessionMessage[]): HistoryMessage[] {
  var result: HistoryMessage[] = [];

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var ts = parseTimestamp(msg);
    var apiMsg = msg.message as { role?: string; content?: unknown };

    if (msg.type === "user") {
      if (Array.isArray(apiMsg.content)) {
        var hadToolResult = false;
        for (var j = 0; j < apiMsg.content.length; j++) {
          var block = apiMsg.content[j] as { type?: string; text?: string; tool_use_id?: string; content?: unknown };
          if (block.type === "tool_result" && block.tool_use_id) {
            hadToolResult = true;
            var resultContent = "";
            if (typeof block.content === "string") {
              resultContent = block.content;
            } else if (Array.isArray(block.content)) {
              var texts: string[] = [];
              for (var ri = 0; ri < block.content.length; ri++) {
                var rb = block.content[ri] as { type?: string; text?: string };
                if (rb.type === "text" && rb.text) texts.push(rb.text);
              }
              resultContent = texts.join("\n");
            } else {
              resultContent = JSON.stringify(block.content ?? "");
            }
            result.push({
              type: "tool_result",
              toolId: block.tool_use_id,
              content: resultContent,
              timestamp: ts,
            });
          } else if (block.type === "text" && block.text) {
            if (isSystemContent(block.text)) continue;
            var cleaned = stripXmlTags(block.text);
            if (cleaned) {
              result.push({
                type: "user",
                uuid: msg.uuid,
                text: cleaned,
                timestamp: ts,
              });
            }
          }
        }
      } else {
        var text = extractUserText(apiMsg.content);
        if (text) {
          result.push({
            type: "user",
            uuid: msg.uuid,
            text,
            timestamp: ts,
          });
        }
      }
    } else if (msg.type === "assistant") {
      var msgUsage = (apiMsg as Record<string, unknown>).usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined;
      var msgModel = ((apiMsg as Record<string, unknown>).model as string) || "";
      var lastAssistantIdx = -1;
      if (Array.isArray(apiMsg.content)) {
        for (var k = 0; k < apiMsg.content.length; k++) {
          var aBlock = apiMsg.content[k] as { type?: string; text?: string; id?: string; name?: string; input?: unknown };
          if (aBlock.type === "text" && aBlock.text) {
            lastAssistantIdx = result.length;
            result.push({
              type: "assistant",
              uuid: msg.uuid + "-text-" + k,
              text: aBlock.text,
              timestamp: ts,
            });
          } else if (aBlock.type === "tool_use" && aBlock.id && aBlock.name) {
            result.push({
              type: "tool_start",
              toolId: aBlock.id,
              name: aBlock.name,
              args: JSON.stringify(aBlock.input ?? {}),
              timestamp: ts,
            });
          }
        }
        if (msgUsage && lastAssistantIdx >= 0) {
          var inTok = msgUsage.input_tokens || 0;
          var outTok = msgUsage.output_tokens || 0;
          var cacheRead = msgUsage.cache_read_input_tokens || 0;
          var cacheCreate = msgUsage.cache_creation_input_tokens || 0;
          result[lastAssistantIdx].inputTokens = inTok;
          result[lastAssistantIdx].outputTokens = outTok;
          result[lastAssistantIdx].model = msgModel;
          result[lastAssistantIdx].costEstimate = estimateCost(msgModel, inTok, outTok, cacheRead, cacheCreate);
        }
      } else {
        var aText = typeof apiMsg.content === "string" ? apiMsg.content : "";
        if (aText) {
          lastAssistantIdx = result.length;
          result.push({
            type: "assistant",
            uuid: msg.uuid,
            text: aText,
            timestamp: ts,
          });
          if (msgUsage) {
            var inTok2 = msgUsage.input_tokens || 0;
            var outTok2 = msgUsage.output_tokens || 0;
            var cacheRead2 = msgUsage.cache_read_input_tokens || 0;
            var cacheCreate2 = msgUsage.cache_creation_input_tokens || 0;
            result[lastAssistantIdx].inputTokens = inTok2;
            result[lastAssistantIdx].outputTokens = outTok2;
            result[lastAssistantIdx].model = msgModel;
            result[lastAssistantIdx].costEstimate = estimateCost(msgModel, inTok2, outTok2, cacheRead2, cacheCreate2);
          }
        }
      }
    }
  }

  return result;
}

export interface SessionUsageInfo {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  contextWindow: number;
}

var MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-opus-4-6": 1048576,
  "claude-sonnet-4-6": 1048576,
  "claude-sonnet-4-5-20250514": 1048576,
  "claude-haiku-4-5-20251001": 1048576,
  "claude-sonnet-4-20250514": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-haiku-20241022": 200000,
  "claude-3-opus-20240229": 200000,
};

export function guessContextWindow(model: string): number {
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  if (model.includes("opus-4") || model.includes("sonnet-4")) return 1048576;
  if (model.includes("haiku-4")) return 1048576;
  return 200000;
}

export async function getSessionUsage(projectSlug: string, sessionId: string): Promise<SessionUsageInfo | null> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  var hash = projectPathToHash(projectPath);
  var sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  try {
    var content = readFileSync(sessionFile, "utf-8");
    var lines = content.trim().split("\n");

    for (var i = lines.length - 1; i >= 0; i--) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var parsed = JSON.parse(line);
        if (parsed.type === "assistant" && parsed.message && parsed.message.usage) {
          var usage = parsed.message.usage;
          var model = parsed.message.model || "";
          return {
            inputTokens: usage.input_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
            cacheCreationTokens: usage.cache_creation_input_tokens || 0,
            contextWindow: guessContextWindow(model),
          };
        }
      } catch {}
    }

    return null;
  } catch {
    return null;
  }
}

export async function listSessions(projectSlug: string): Promise<SessionSummary[]> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) {
    return [];
  }

  try {
    var sdkSessions = await sdkListSessions({ dir: projectPath });
    var summaries = sdkSessions.map(function (s) {
      return mapSDKSession(s, projectSlug);
    });
    summaries.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return summaries;
  } catch (err) {
    console.warn("[lattice] Failed to list SDK sessions:", err);
    return [];
  }
}

export async function getSessionTitle(projectSlug: string, sessionId: string): Promise<string> {
  var projectPath = getProjectPath(projectSlug);
  var options = projectPath ? { dir: projectPath } : undefined;
  try {
    var info = await getSessionInfo(sessionId, options);
    if (info) {
      return info.customTitle || info.summary || info.firstPrompt || "Untitled";
    }
  } catch {}
  return "Untitled";
}

export async function loadSessionHistory(projectSlug: string, sessionId: string): Promise<HistoryMessage[]> {
  var projectPath = getProjectPath(projectSlug);
  var options = projectPath ? { dir: projectPath } : undefined;

  try {
    var messages = await getSessionMessages(sessionId, options);
    return convertSessionMessages(messages);
  } catch (err) {
    console.warn("[lattice] Failed to load session history:", err);
    return [];
  }
}

export function createSession(projectSlug: string): SessionSummary {
  var sessionId = randomUUID();
  var now = Date.now();
  return {
    id: sessionId,
    projectSlug,
    title: "Session " + new Date(now).toLocaleString(),
    createdAt: now,
    updatedAt: now,
  };
}

export async function renameSession(projectSlug: string, sessionId: string, title: string): Promise<boolean> {
  var projectPath = getProjectPath(projectSlug);
  var options = projectPath ? { dir: projectPath } : undefined;

  try {
    await sdkRenameSession(sessionId, title, options);
    return true;
  } catch (err) {
    console.warn("[lattice] Failed to rename session:", err);
    return false;
  }
}

export async function deleteSession(projectSlug: string, sessionId: string): Promise<boolean> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) {
    return false;
  }

  var hash = projectPathToHash(projectPath);
  var sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");

  if (!existsSync(sessionFile)) {
    return false;
  }

  try {
    unlinkSync(sessionFile);
    return true;
  } catch (err) {
    console.warn("[lattice] Failed to delete session:", err);
    return false;
  }
}

export async function findProjectSlugForSession(sessionId: string): Promise<string | null> {
  try {
    var info = await getSessionInfo(sessionId);
    if (!info || !info.cwd) {
      return null;
    }

    var config = loadConfig();
    for (var i = 0; i < config.projects.length; i++) {
      if (info.cwd.startsWith(config.projects[i].path)) {
        return config.projects[i].slug;
      }
    }
    return null;
  } catch {
    return null;
  }
}
