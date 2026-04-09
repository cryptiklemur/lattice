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
  const config = loadConfig();
  const project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
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

const LITELLM_PRICING_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const pricingCache: Record<string, { input: number; output: number; cacheRead?: number; cacheCreation?: number }> = {};
let pricingLoaded = false;

const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
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
    for (const key in data) {
      if (!key.includes("claude")) continue;
      const entry = data[key];
      const inputCost = entry.input_cost_per_token as number | undefined;
      const outputCost = entry.output_cost_per_token as number | undefined;
      if (inputCost == null || outputCost == null) continue;
      const modelId = key.replace("anthropic/", "").replace("claude-", "claude-");
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
  for (const key in pricingCache) {
    if (key.includes(model) || model.includes(key)) return pricingCache[key];
  }
  const shortModel = model.replace("claude-", "").split("-")[0];
  for (const key2 in pricingCache) {
    if (key2.includes(shortModel)) return pricingCache[key2];
  }
  if (FALLBACK_PRICING[model]) {
    return FALLBACK_PRICING[model];
  }
  return FALLBACK_PRICING["claude-sonnet-4-6"];
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number, cacheRead: number, cacheCreation: number): number {
  const pricing = getPricing(model);
  const normalInput = inputTokens - cacheRead - cacheCreation;
  const inputCost = (normalInput * pricing.input) / 1000000;
  const cacheCost = pricing.cacheRead != null
    ? (cacheRead * pricing.cacheRead) / 1000000
    : (cacheRead * pricing.input * 0.1) / 1000000;
  const cacheCreateCost = pricing.cacheCreation != null
    ? (cacheCreation * pricing.cacheCreation) / 1000000
    : (cacheCreation * pricing.input * 1.25) / 1000000;
  const outputCost = (outputTokens * pricing.output) / 1000000;
  return Math.max(0, inputCost + cacheCost + cacheCreateCost + outputCost);
}

function parseTimestamp(msg: SessionMessage): number {
  const raw = (msg as unknown as { timestamp?: string }).timestamp;
  if (raw) {
    const parsed = new Date(raw).getTime();
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
    for (let i = 0; i < content.length; i++) {
      const block = content[i] as { type?: string; text?: string };
      if (block.type === "text" && typeof block.text === "string") {
        if (isSystemContent(block.text)) continue;
        const cleaned = stripXmlTags(block.text);
        if (cleaned) return cleaned;
      }
    }
  }
  return "";
}

const HIDDEN_TOOLS = new Set([
  "TaskUpdate", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop",
  "TodoWrite", "TodoRead",
  "EnterPlanMode", "ExitPlanMode",
  "ToolSearch",
]);

function convertSessionMessages(messages: SessionMessage[]): HistoryMessage[] {
  const result: HistoryMessage[] = [];
  const hiddenToolIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const ts = parseTimestamp(msg);
    const apiMsg = msg.message as { role?: string; content?: unknown };

    if (msg.type === "user") {
      if ((msg as Record<string, unknown>).isCompactSummary === true) {
        const summaryText = typeof apiMsg.content === "string" ? apiMsg.content : "";
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
        let hadToolResult = false;
        for (let j = 0; j < apiMsg.content.length; j++) {
          const block = apiMsg.content[j] as { type?: string; text?: string; tool_use_id?: string; content?: unknown };
          if (block.type === "tool_result" && block.tool_use_id) {
            if (hiddenToolIds.has(block.tool_use_id)) continue;
            hadToolResult = true;
            let resultContent = "";
            if (typeof block.content === "string") {
              resultContent = block.content;
            } else if (Array.isArray(block.content)) {
              const texts: string[] = [];
              for (let ri = 0; ri < block.content.length; ri++) {
                const rb = block.content[ri] as { type?: string; text?: string };
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
            const cleaned = stripXmlTags(block.text);
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
        const text = extractUserText(apiMsg.content);
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
      const msgUsage = (apiMsg as Record<string, unknown>).usage as { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } | undefined;
      const msgModel = ((apiMsg as Record<string, unknown>).model as string) || "";
      let lastAssistantIdx = -1;
      if (Array.isArray(apiMsg.content)) {
        for (let k = 0; k < apiMsg.content.length; k++) {
          const aBlock = apiMsg.content[k] as { type?: string; text?: string; id?: string; name?: string; input?: unknown };
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
          const inTok = msgUsage.input_tokens || 0;
          const outTok = msgUsage.output_tokens || 0;
          const cacheRead = msgUsage.cache_read_input_tokens || 0;
          const cacheCreate = msgUsage.cache_creation_input_tokens || 0;
          result[lastAssistantIdx].inputTokens = inTok;
          result[lastAssistantIdx].outputTokens = outTok;
          result[lastAssistantIdx].model = msgModel;
          result[lastAssistantIdx].costEstimate = estimateCost(msgModel, inTok, outTok, cacheRead, cacheCreate);
        }
      } else {
        const aText = typeof apiMsg.content === "string" ? apiMsg.content : "";
        if (aText) {
          lastAssistantIdx = result.length;
          result.push({
            type: "assistant",
            uuid: msg.uuid,
            text: aText,
            timestamp: ts,
          });
          if (msgUsage) {
            const inTok2 = msgUsage.input_tokens || 0;
            const outTok2 = msgUsage.output_tokens || 0;
            const cacheRead2 = msgUsage.cache_read_input_tokens || 0;
            const cacheCreate2 = msgUsage.cache_creation_input_tokens || 0;
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

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
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
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  const hash = projectPathToHash(projectPath);
  const sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  try {
    const fhUsage = await fsPromises.open(sessionFile, "r");
    const statUsage = await fhUsage.stat();
    const tailSize = Math.min(statUsage.size, 512 * 1024);
    const bufUsage = Buffer.alloc(tailSize);
    await fhUsage.read(bufUsage, 0, tailSize, statUsage.size - tailSize);
    await fhUsage.close();

    const text = bufUsage.toString("utf-8");
    const lines = text.split("\n");

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "assistant" && parsed.message && parsed.message.usage) {
          const usage = parsed.message.usage;
          const model = parsed.message.model || "";
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
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;

  const hash = projectPathToHash(projectPath);
  const sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  if (!existsSync(sessionFile)) return null;

  try {
    const content = readFileSync(sessionFile, "utf-8");
    const lines = content.trim().split("\n");

    let totalCost = 0;
    let messageCount = 0;
    let model = "";
    let lastMessage = "";
    let firstTimestamp = 0;
    let lastTimestamp = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const parsed = JSON.parse(line);
        let ts = 0;
        const rawTs = parsed.timestamp;
        if (rawTs) {
          const parsedTs = new Date(rawTs).getTime();
          if (!isNaN(parsedTs)) ts = parsedTs;
        }
        if (ts > 0 && firstTimestamp === 0) firstTimestamp = ts;
        if (ts > lastTimestamp) lastTimestamp = ts;

        if (parsed.type === "user") {
          messageCount++;
          const userText = extractUserText(parsed.message?.content);
          if (userText) lastMessage = userText;
        } else if (parsed.type === "assistant" && parsed.message) {
          messageCount++;
          const usage = parsed.message.usage;
          const msgModel = parsed.message.model || "";
          if (msgModel) model = msgModel;
          if (usage) {
            const inTok = usage.input_tokens || 0;
            const outTok = usage.output_tokens || 0;
            const cacheRead = usage.cache_read_input_tokens || 0;
            const cacheCreate = usage.cache_creation_input_tokens || 0;
            totalCost += estimateCost(msgModel || model, inTok, outTok, cacheRead, cacheCreate);
          }
          const aContent = parsed.message.content;
          if (Array.isArray(aContent)) {
            for (let j = aContent.length - 1; j >= 0; j--) {
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

    const maxSnippet = 120;
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

const sessionListCache = new Map<string, { sessions: SessionSummary[]; time: number }>();
const SESSION_CACHE_TTL = 60000;
const RECONCILE_INTERVAL = 5 * 60 * 1000;
const lastReconcile = new Map<string, number>();

function getIndexPath(): string {
  return join(getLatticeHome(), "session-index.json");
}

function loadSessionIndex(): Record<string, SessionSummary[]> {
  const indexPath = getIndexPath();
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
  const index = loadSessionIndex();
  const sessions = index[projectSlug] || [];
  let existing = -1;
  for (let i = 0; i < sessions.length; i++) {
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
  const index = loadSessionIndex();
  const sessions = index[projectSlug] || [];
  index[projectSlug] = sessions.filter(function (s) { return s.id !== sessionId; });
  saveSessionIndex(index);
  sessionListCache.set(projectSlug, { sessions: index[projectSlug], time: Date.now() });
}

async function reconcileWithSDK(projectSlug: string): Promise<SessionSummary[]> {
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) return [];
  const sdkT0 = Date.now();
  const sdkSessions = await sdkListSessions({ dir: projectPath });
  log.session("sdkListSessions for %s: %dms (%d sessions)", projectSlug, Date.now() - sdkT0, sdkSessions.length);
  const summaries = sdkSessions.map(function (s) { return mapSDKSession(s, projectSlug); });
  summaries.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  const index = loadSessionIndex();
  index[projectSlug] = summaries;
  saveSessionIndex(index);
  sessionListCache.set(projectSlug, { sessions: summaries, time: Date.now() });
  lastReconcile.set(projectSlug, Date.now());
  return summaries;
}

function needsReconcile(projectSlug: string): boolean {
  const last = lastReconcile.get(projectSlug);
  if (!last) return true;
  return Date.now() - last > RECONCILE_INTERVAL;
}

export async function listSessions(projectSlug: string, options?: { offset?: number; limit?: number; noCache?: boolean }): Promise<{ sessions: SessionSummary[]; totalCount: number }> {
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) {
    return { sessions: [], totalCount: 0 };
  }

  const cached = sessionListCache.get(projectSlug);
  if (cached && !options?.noCache && Date.now() - cached.time < SESSION_CACHE_TTL) {
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 0;
    const sliced = limit > 0 ? cached.sessions.slice(offset, offset + limit) : cached.sessions;
    return { sessions: sliced, totalCount: cached.sessions.length };
  }

  const index = loadSessionIndex();
  const indexed = index[projectSlug];
  if (indexed && indexed.length > 0) {
    sessionListCache.set(projectSlug, { sessions: indexed, time: Date.now() });
    if (needsReconcile(projectSlug)) {
      reconcileWithSDK(projectSlug).catch(function (err) {
        log.session("Background reconcile failed: %O", err);
      });
    }
    const offset3 = options?.offset ?? 0;
    const limit3 = options?.limit ?? 0;
    const sliced3 = limit3 > 0 ? indexed.slice(offset3, offset3 + limit3) : indexed;
    return { sessions: sliced3, totalCount: indexed.length };
  }

  try {
    const summaries = await reconcileWithSDK(projectSlug);
    const offset2 = options?.offset ?? 0;
    const limit2 = options?.limit ?? 0;
    const sliced2 = limit2 > 0 ? summaries.slice(offset2, offset2 + limit2) : summaries;
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
  const idx = historyCacheOrder.indexOf(sessionId);
  if (idx >= 0) historyCacheOrder.splice(idx, 1);
}

export async function getSessionTitle(projectSlug: string, sessionId: string): Promise<string> {
  const filePath = getSessionFilePath(projectSlug, sessionId);
  if (!filePath) {
    const index = loadSessionIndex();
    const sessions = index[projectSlug] || [];
    const entry = sessions.find(function (s) { return s.id === sessionId; });
    if (entry && entry.title && entry.title !== "Untitled") return entry.title;
    return "Untitled";
  }
  const projectPath = getProjectPath(projectSlug);
  const options = projectPath ? { dir: projectPath } : undefined;
  try {
    const info = await getSessionInfo(sessionId, options);
    if (info) {
      return info.customTitle || info.summary || info.firstPrompt || "Untitled";
    }
  } catch {}
  const index = loadSessionIndex();
  const sessions = index[projectSlug] || [];
  const entry = sessions.find(function (s) { return s.id === sessionId; });
  if (entry && entry.title && entry.title !== "Untitled") return entry.title;
  return "Untitled";
}

const historyCache = new Map<string, { messages: HistoryMessage[]; title: string | null }>();
const historyCacheOrder: string[] = [];
const MAX_HISTORY_CACHE = 50;

function touchCache(sessionId: string): void {
  const idx = historyCacheOrder.indexOf(sessionId);
  if (idx >= 0) historyCacheOrder.splice(idx, 1);
  historyCacheOrder.push(sessionId);
}

function evictOldest(): void {
  while (historyCacheOrder.length > MAX_HISTORY_CACHE) {
    const oldest = historyCacheOrder.shift();
    if (oldest) historyCache.delete(oldest);
  }
}

export function appendToHistoryCache(sessionId: string, message: HistoryMessage): void {
  const cached = historyCache.get(sessionId);
  if (!cached) return;
  cached.messages.push(message);
  touchCache(sessionId);
}

const INITIAL_MESSAGE_COUNT = 300;
const TAIL_READ_BYTES = 512 * 1024;

function getSessionFilePath(projectSlug: string, sessionId: string): string | null {
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) return null;
  const hash = projectPathToHash(projectPath);
  const filePath = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
  return existsSync(filePath) ? filePath : null;
}

export async function getSessionFileSizeBytes(projectSlug: string, sessionId: string): Promise<number | null> {
  const filePath = getSessionFilePath(projectSlug, sessionId);
  if (!filePath) return null;
  try {
    const fileStat = await fsPromises.stat(filePath);
    return fileStat.size;
  } catch {
    return null;
  }
}

async function readTailLines(filePath: string, maxBytes: number): Promise<{ lines: string[]; isPartial: boolean; fileSize: number }> {
  const fh = await fsPromises.open(filePath, "r");
  try {
    const stat = await fh.stat();
    const readStart = Math.max(0, stat.size - maxBytes);
    const length = stat.size - readStart;
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, readStart);
    let text = buf.toString("utf-8");
    if (readStart > 0) {
      const firstNewline = text.indexOf("\n");
      if (firstNewline >= 0) text = text.slice(firstNewline + 1);
    }
    const lines = text.split("\n").filter(function (l) { return l.length > 0; });
    return { lines, isPartial: readStart > 0, fileSize: stat.size };
  } finally {
    await fh.close();
  }
}

function parseJsonlLines(lines: string[]): SessionMessage[] {
  const results: SessionMessage[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed.type === "user" || parsed.type === "assistant" || parsed.type === "system") {
        results.push(parsed as SessionMessage);
      }
    } catch {}
  }
  return results;
}

export async function loadSessionHistory(projectSlug: string, sessionId: string): Promise<{ messages: HistoryMessage[]; totalMessages: number; hasMore: boolean }> {
  try {
    const t0 = Date.now();
    const cached = historyCache.get(sessionId);
    if (cached) {
      touchCache(sessionId);
      const tail = cached.messages.length > INITIAL_MESSAGE_COUNT
        ? cached.messages.slice(cached.messages.length - INITIAL_MESSAGE_COUNT)
        : cached.messages;
      log.session("loadSessionHistory %s: %dms (cached, %d total)", sessionId.slice(0, 8), Date.now() - t0, cached.messages.length);
      return { messages: tail, totalMessages: cached.messages.length, hasMore: cached.messages.length > INITIAL_MESSAGE_COUNT };
    }

    const filePath = getSessionFilePath(projectSlug, sessionId);
    if (filePath) {
      const tailData = await readTailLines(filePath, TAIL_READ_BYTES);
      const tailRaw = parseJsonlLines(tailData.lines);
      const tailMessages = convertSessionMessages(tailRaw);
      const hasMore = tailData.isPartial;

      log.session("loadSessionHistory %s: %dms (tail read, %d msgs, partial=%s)", sessionId.slice(0, 8), Date.now() - t0, tailMessages.length, hasMore);

      if (!hasMore && tailMessages.length > 0) {
        historyCache.set(sessionId, { messages: tailMessages, title: null });
        touchCache(sessionId);
        evictOldest();
      }

      const initialSlice = tailMessages.length > INITIAL_MESSAGE_COUNT
        ? tailMessages.slice(tailMessages.length - INITIAL_MESSAGE_COUNT)
        : tailMessages;

      return { messages: initialSlice, totalMessages: tailMessages.length, hasMore: hasMore };
    }

    log.session("loadSessionHistory %s: %dms (no session file found)", sessionId.slice(0, 8), Date.now() - t0);
    return { messages: [], totalMessages: 0, hasMore: false };
  } catch (err) {
    log.session("Failed to load session history: %O", err);
    return { messages: [], totalMessages: 0, hasMore: false };
  }
}

export async function getSessionHistoryPage(sessionId: string, beforeIndex: number | undefined, limit: number, projectSlug?: string, loaded?: number): Promise<{ messages: HistoryMessage[]; hasMore: boolean; totalMessages: number }> {
  let cached = historyCache.get(sessionId);
  if (!cached && projectSlug) {
    const projectPath = getProjectPath(projectSlug);
    const options = projectPath ? { dir: projectPath } : undefined;
    try {
      const rawMessages = await getSessionMessages(sessionId, options);
      const allMessages = convertSessionMessages(rawMessages);
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

  const total = cached.messages.length;
  let endIdx: number;
  if (loaded !== undefined) {
    endIdx = Math.max(0, total - loaded);
  } else if (beforeIndex !== undefined) {
    endIdx = Math.min(Math.max(0, beforeIndex), total);
  } else {
    endIdx = total;
  }
  const startIdx = Math.max(0, endIdx - limit);
  const page = cached.messages.slice(startIdx, endIdx);

  return { messages: page, hasMore: startIdx > 0, totalMessages: total };
}

export function createSession(projectSlug: string, sessionType?: string): SessionSummary {
  const sessionId = randomUUID();
  const now = Date.now();
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
  const projectPath = getProjectPath(projectSlug);
  const options = projectPath ? { dir: projectPath } : undefined;

  try {
    await sdkRenameSession(sessionId, title, options);
    return true;
  } catch (err) {
    log.session("Failed to rename session: %O", err);
    return false;
  }
}

export async function deleteSession(projectSlug: string, sessionId: string): Promise<boolean> {
  const projectPath = getProjectPath(projectSlug);
  if (!projectPath) {
    return false;
  }

  const hash = projectPathToHash(projectPath);
  const sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");

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
    const info = await getSessionInfo(sessionId);
    if (!info || !info.cwd) {
      return null;
    }

    const config = loadConfig();
    for (let i = 0; i < config.projects.length; i++) {
      if (info.cwd.startsWith(config.projects[i].path)) {
        return config.projects[i].slug;
      }
    }
    return null;
  } catch {
    return null;
  }
}
