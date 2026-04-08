import {
  listSessions as sdkListSessions,
  getSessionInfo,
  getSessionMessages,
  renameSession as sdkRenameSession,
} from "@anthropic-ai/claude-agent-sdk";
import type { SDKSessionInfo, SessionMessage } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, unlinkSync, readFileSync, statSync, writeFileSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type { HistoryMessage, SessionPreview, SessionSummary } from "#shared";
import { loadConfig, getLatticeHome } from "../config";
import { log } from "../logger";

function getProjectPath(projectSlug: string): string | null {
  var config = loadConfig();
  var project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
  return project ? project.path : null;
}

export function projectPathToHash(projectPath: string): string {
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

export function loadPricing(): void {
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
  }).catch(function (err) {
    log.session("Failed to load pricing data: %O", err);
  });
}

loadPricing();

export function getPricing(model: string): { input: number; output: number; cacheRead?: number; cacheCreation?: number } {
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

export function estimateCost(model: string, inputTokens: number, outputTokens: number, cacheRead: number, cacheCreation: number): number {
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

var HIDDEN_TOOLS = new Set([
  "TaskUpdate", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop",
  "TodoWrite", "TodoRead",
  "EnterPlanMode", "ExitPlanMode",
  "ToolSearch",
]);

function convertSessionMessages(messages: SessionMessage[]): HistoryMessage[] {
  var result: HistoryMessage[] = [];
  var hiddenToolIds = new Set<string>();

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var ts = parseTimestamp(msg);
    var apiMsg = msg.message as { role?: string; content?: unknown };

    if (msg.type === "user") {
      if ((msg as Record<string, unknown>).isCompactSummary === true) {
        var summaryText = typeof apiMsg.content === "string" ? apiMsg.content : "";
        if (summaryText) {
          result.push({
            type: "compact_summary",
            uuid: msg.uuid,
            text: summaryText,
            timestamp: ts,
          });
        }
        continue;
      }
      if (Array.isArray(apiMsg.content)) {
        var hadToolResult = false;
        for (var j = 0; j < apiMsg.content.length; j++) {
          var block = apiMsg.content[j] as { type?: string; text?: string; tool_use_id?: string; content?: unknown };
          if (block.type === "tool_result" && block.tool_use_id) {
            if (hiddenToolIds.has(block.tool_use_id)) continue;
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
            if (HIDDEN_TOOLS.has(aBlock.name)) {
              hiddenToolIds.add(aBlock.id);
            } else {
              result.push({
                type: "tool_start",
                toolId: aBlock.id,
                name: aBlock.name,
                args: JSON.stringify(aBlock.input ?? {}),
                timestamp: ts,
              });
            }
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
    var fhUsage = await fsPromises.open(sessionFile, "r");
    var statUsage = await fhUsage.stat();
    var tailSize = Math.min(statUsage.size, 512 * 1024);
    var bufUsage = Buffer.alloc(tailSize);
    await fhUsage.read(bufUsage, 0, tailSize, statUsage.size - tailSize);
    await fhUsage.close();

    var text = bufUsage.toString("utf-8");
    var lines = text.split("\n");

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

export async function getSessionPreview(projectSlug: string, sessionId: string): Promise<SessionPreview | null> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  var hash = projectPathToHash(projectPath);
  var sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  try {
    var content = readFileSync(sessionFile, "utf-8");
    var lines = content.trim().split("\n");

    var totalCost = 0;
    var messageCount = 0;
    var model = "";
    var lastMessage = "";
    var firstTimestamp = 0;
    var lastTimestamp = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var parsed = JSON.parse(line);
        var ts = 0;
        var rawTs = parsed.timestamp;
        if (rawTs) {
          var parsedTs = new Date(rawTs).getTime();
          if (!isNaN(parsedTs)) ts = parsedTs;
        }
        if (ts > 0 && firstTimestamp === 0) firstTimestamp = ts;
        if (ts > lastTimestamp) lastTimestamp = ts;

        if (parsed.type === "user") {
          messageCount++;
          var userText = extractUserText(parsed.message?.content);
          if (userText) lastMessage = userText;
        } else if (parsed.type === "assistant" && parsed.message) {
          messageCount++;
          var usage = parsed.message.usage;
          var msgModel = parsed.message.model || "";
          if (msgModel) model = msgModel;
          if (usage) {
            var inTok = usage.input_tokens || 0;
            var outTok = usage.output_tokens || 0;
            var cacheRead = usage.cache_read_input_tokens || 0;
            var cacheCreate = usage.cache_creation_input_tokens || 0;
            totalCost += estimateCost(msgModel || model, inTok, outTok, cacheRead, cacheCreate);
          }
          var aContent = parsed.message.content;
          if (Array.isArray(aContent)) {
            for (var j = aContent.length - 1; j >= 0; j--) {
              if (aContent[j].type === "text" && aContent[j].text) {
                lastMessage = aContent[j].text;
                break;
              }
            }
          } else if (typeof aContent === "string" && aContent) {
            lastMessage = aContent;
          }
        }
      } catch {}
    }

    var maxSnippet = 120;
    if (lastMessage.length > maxSnippet) {
      lastMessage = lastMessage.slice(0, maxSnippet) + "...";
    }

    return {
      sessionId,
      cost: Math.round(totalCost * 100) / 100,
      durationMs: lastTimestamp > firstTimestamp ? lastTimestamp - firstTimestamp : 0,
      messageCount,
      model: model.replace("claude-", "").split("-20")[0],
      lastMessage,
    };
  } catch {
    return null;
  }
}

var sessionListCache = new Map<string, { sessions: SessionSummary[]; time: number }>();
var SESSION_CACHE_TTL = 60000;
var RECONCILE_INTERVAL = 5 * 60 * 1000;
var lastReconcile = new Map<string, number>();

function getIndexPath(): string {
  return join(getLatticeHome(), "session-index.json");
}

function loadSessionIndex(): Record<string, SessionSummary[]> {
  var indexPath = getIndexPath();
  if (!existsSync(indexPath)) return {};
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveSessionIndex(index: Record<string, SessionSummary[]>): void {
  try {
    writeFileSync(getIndexPath(), JSON.stringify(index), "utf-8");
  } catch (err) {
    log.session("Failed to save session index: %O", err);
  }
}

export function updateSessionInIndex(projectSlug: string, session: SessionSummary): void {
  var index = loadSessionIndex();
  var sessions = index[projectSlug] || [];
  var existing = -1;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].id === session.id) { existing = i; break; }
  }
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  sessions.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  index[projectSlug] = sessions;
  saveSessionIndex(index);
  sessionListCache.set(projectSlug, { sessions, time: Date.now() });
}

export function removeSessionFromIndex(projectSlug: string, sessionId: string): void {
  var index = loadSessionIndex();
  var sessions = index[projectSlug] || [];
  index[projectSlug] = sessions.filter(function (s) { return s.id !== sessionId; });
  saveSessionIndex(index);
  sessionListCache.set(projectSlug, { sessions: index[projectSlug], time: Date.now() });
}

async function reconcileWithSDK(projectSlug: string): Promise<SessionSummary[]> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) return [];
  var sdkT0 = Date.now();
  var sdkSessions = await sdkListSessions({ dir: projectPath });
  log.session("sdkListSessions for %s: %dms (%d sessions)", projectSlug, Date.now() - sdkT0, sdkSessions.length);
  var summaries = sdkSessions.map(function (s) { return mapSDKSession(s, projectSlug); });
  summaries.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  var index = loadSessionIndex();
  index[projectSlug] = summaries;
  saveSessionIndex(index);
  sessionListCache.set(projectSlug, { sessions: summaries, time: Date.now() });
  lastReconcile.set(projectSlug, Date.now());
  return summaries;
}

function needsReconcile(projectSlug: string): boolean {
  var last = lastReconcile.get(projectSlug);
  if (!last) return true;
  return Date.now() - last > RECONCILE_INTERVAL;
}

export async function listSessions(projectSlug: string, options?: { offset?: number; limit?: number; noCache?: boolean }): Promise<{ sessions: SessionSummary[]; totalCount: number }> {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) {
    return { sessions: [], totalCount: 0 };
  }

  var cached = sessionListCache.get(projectSlug);
  if (cached && !options?.noCache && Date.now() - cached.time < SESSION_CACHE_TTL) {
    var offset = options?.offset ?? 0;
    var limit = options?.limit ?? 0;
    var sliced = limit > 0 ? cached.sessions.slice(offset, offset + limit) : cached.sessions;
    return { sessions: sliced, totalCount: cached.sessions.length };
  }

  var index = loadSessionIndex();
  var indexed = index[projectSlug];
  if (indexed && indexed.length > 0) {
    sessionListCache.set(projectSlug, { sessions: indexed, time: Date.now() });
    if (needsReconcile(projectSlug)) {
      reconcileWithSDK(projectSlug).catch(function (err) {
        log.session("Background reconcile failed: %O", err);
      });
    }
    var offset3 = options?.offset ?? 0;
    var limit3 = options?.limit ?? 0;
    var sliced3 = limit3 > 0 ? indexed.slice(offset3, offset3 + limit3) : indexed;
    return { sessions: sliced3, totalCount: indexed.length };
  }

  try {
    var summaries = await reconcileWithSDK(projectSlug);
    var offset2 = options?.offset ?? 0;
    var limit2 = options?.limit ?? 0;
    var sliced2 = limit2 > 0 ? summaries.slice(offset2, offset2 + limit2) : summaries;
    return { sessions: sliced2, totalCount: summaries.length };
  } catch (err) {
    log.session("Failed to list SDK sessions: %O", err);
    return { sessions: [], totalCount: 0 };
  }
}

export function invalidateSessionCache(projectSlug: string): void {
  sessionListCache.delete(projectSlug);
}

export function invalidateHistoryCache(sessionId: string): void {
  historyCache.delete(sessionId);
  var idx = historyCacheOrder.indexOf(sessionId);
  if (idx >= 0) historyCacheOrder.splice(idx, 1);
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

var historyCache = new Map<string, { messages: HistoryMessage[]; title: string | null }>();
var historyCacheOrder: string[] = [];
var MAX_HISTORY_CACHE = 50;

function touchCache(sessionId: string): void {
  var idx = historyCacheOrder.indexOf(sessionId);
  if (idx >= 0) historyCacheOrder.splice(idx, 1);
  historyCacheOrder.push(sessionId);
}

function evictOldest(): void {
  while (historyCacheOrder.length > MAX_HISTORY_CACHE) {
    var oldest = historyCacheOrder.shift();
    if (oldest) historyCache.delete(oldest);
  }
}

export function appendToHistoryCache(sessionId: string, message: HistoryMessage): void {
  var cached = historyCache.get(sessionId);
  if (!cached) return;
  cached.messages.push(message);
  touchCache(sessionId);
}

var INITIAL_MESSAGE_COUNT = 300;
var TAIL_READ_BYTES = 512 * 1024;

function getSessionFilePath(projectSlug: string, sessionId: string): string | null {
  var projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;
  var hash = projectPathToHash(projectPath);
  var filePath = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  return existsSync(filePath) ? filePath : null;
}

export async function getSessionFileSizeBytes(projectSlug: string, sessionId: string): Promise<number | null> {
  var filePath = getSessionFilePath(projectSlug, sessionId);
  if (!filePath) return null;
  try {
    var fileStat = await fsPromises.stat(filePath);
    return fileStat.size;
  } catch {
    return null;
  }
}

async function readTailLines(filePath: string, maxBytes: number): Promise<{ lines: string[]; isPartial: boolean; fileSize: number }> {
  var fh = await fsPromises.open(filePath, "r");
  try {
    var stat = await fh.stat();
    var readStart = Math.max(0, stat.size - maxBytes);
    var length = stat.size - readStart;
    var buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, readStart);
    var text = buf.toString("utf-8");
    if (readStart > 0) {
      var firstNewline = text.indexOf("\n");
      if (firstNewline >= 0) text = text.slice(firstNewline + 1);
    }
    var lines = text.split("\n").filter(function (l) { return l.length > 0; });
    return { lines, isPartial: readStart > 0, fileSize: stat.size };
  } finally {
    await fh.close();
  }
}

function parseJsonlLines(lines: string[]): SessionMessage[] {
  var results: SessionMessage[] = [];
  for (var i = 0; i < lines.length; i++) {
    try {
      var parsed = JSON.parse(lines[i]);
      if (parsed.type === "user" || parsed.type === "assistant" || parsed.type === "system") {
        results.push(parsed as SessionMessage);
      }
    } catch {}
  }
  return results;
}

export async function loadSessionHistory(projectSlug: string, sessionId: string): Promise<{ messages: HistoryMessage[]; totalMessages: number; hasMore: boolean }> {
  try {
    var t0 = Date.now();
    var cached = historyCache.get(sessionId);
    if (cached) {
      touchCache(sessionId);
      var tail = cached.messages.length > INITIAL_MESSAGE_COUNT
        ? cached.messages.slice(cached.messages.length - INITIAL_MESSAGE_COUNT)
        : cached.messages;
      log.session("loadSessionHistory %s: %dms (cached, %d total)", sessionId.slice(0, 8), Date.now() - t0, cached.messages.length);
      return { messages: tail, totalMessages: cached.messages.length, hasMore: cached.messages.length > INITIAL_MESSAGE_COUNT };
    }

    var filePath = getSessionFilePath(projectSlug, sessionId);
    if (filePath) {
      var tailData = await readTailLines(filePath, TAIL_READ_BYTES);
      var tailRaw = parseJsonlLines(tailData.lines);
      var tailMessages = convertSessionMessages(tailRaw);
      var hasMore = tailData.isPartial;

      log.session("loadSessionHistory %s: %dms (tail read, %d msgs, partial=%s)", sessionId.slice(0, 8), Date.now() - t0, tailMessages.length, hasMore);

      if (!hasMore && tailMessages.length > 0) {
        historyCache.set(sessionId, { messages: tailMessages, title: null });
        touchCache(sessionId);
        evictOldest();
      }

      var initialSlice = tailMessages.length > INITIAL_MESSAGE_COUNT
        ? tailMessages.slice(tailMessages.length - INITIAL_MESSAGE_COUNT)
        : tailMessages;

      return { messages: initialSlice, totalMessages: tailMessages.length, hasMore: hasMore };
    }

    var projectPath = getProjectPath(projectSlug);
    var options = projectPath ? { dir: projectPath } : undefined;
    var rawMessages = await getSessionMessages(sessionId, options);
    var allMessages = convertSessionMessages(rawMessages);
    if (allMessages.length > 0) {
      historyCache.set(sessionId, { messages: allMessages, title: null });
      touchCache(sessionId);
      evictOldest();
    }
    log.session("loadSessionHistory %s: %dms (full SDK, %d msgs)", sessionId.slice(0, 8), Date.now() - t0, allMessages.length);
    var tailSlice = allMessages.length > INITIAL_MESSAGE_COUNT
      ? allMessages.slice(allMessages.length - INITIAL_MESSAGE_COUNT)
      : allMessages;
    return { messages: tailSlice, totalMessages: allMessages.length, hasMore: allMessages.length > INITIAL_MESSAGE_COUNT };
  } catch (err) {
    log.session("Failed to load session history: %O", err);
    return { messages: [], totalMessages: 0, hasMore: false };
  }
}

export async function getSessionHistoryPage(sessionId: string, beforeIndex: number | undefined, limit: number, projectSlug?: string, loaded?: number): Promise<{ messages: HistoryMessage[]; hasMore: boolean; totalMessages: number }> {
  var cached = historyCache.get(sessionId);
  if (!cached && projectSlug) {
    var projectPath = getProjectPath(projectSlug);
    var options = projectPath ? { dir: projectPath } : undefined;
    try {
      var rawMessages = await getSessionMessages(sessionId, options);
      var allMessages = convertSessionMessages(rawMessages);
      historyCache.set(sessionId, { messages: allMessages, title: null });
      touchCache(sessionId);
      evictOldest();
      cached = historyCache.get(sessionId)!;
      log.session("getSessionHistoryPage: full load for %s, %d messages", sessionId.slice(0, 8), allMessages.length);
    } catch {
      return { messages: [], hasMore: false, totalMessages: 0 };
    }
  }
  if (!cached) return { messages: [], hasMore: false, totalMessages: 0 };

  var total = cached.messages.length;
  var endIdx: number;
  if (loaded !== undefined) {
    endIdx = Math.max(0, total - loaded);
  } else if (beforeIndex !== undefined) {
    endIdx = Math.min(Math.max(0, beforeIndex), total);
  } else {
    endIdx = total;
  }
  var startIdx = Math.max(0, endIdx - limit);
  var page = cached.messages.slice(startIdx, endIdx);

  return { messages: page, hasMore: startIdx > 0, totalMessages: total };
}

export function createSession(projectSlug: string, sessionType?: string): SessionSummary {
  var sessionId = randomUUID();
  var now = Date.now();
  return {
    id: sessionId,
    projectSlug,
    title: "Session " + new Date(now).toLocaleString(),
    createdAt: now,
    updatedAt: now,
    sessionType: (sessionType || "chat") as any,
  };
}

export async function renameSession(projectSlug: string, sessionId: string, title: string): Promise<boolean> {
  var projectPath = getProjectPath(projectSlug);
  var options = projectPath ? { dir: projectPath } : undefined;

  try {
    await sdkRenameSession(sessionId, title, options);
    return true;
  } catch (err) {
    log.session("Failed to rename session: %O", err);
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
    log.session("Failed to delete session: %O", err);
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
