import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKPartialAssistantMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionMode, PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
type MessageParam = SDKUserMessage["message"];
import type { Attachment } from "#shared";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { sendTo, broadcast, broadcastToProject } from "../ws/broadcast";
import { syncSessionToPeers } from "../mesh/session-sync";
import { resolveSkillContent } from "../handlers/skills";
import { getPluginMcpServers } from "../handlers/plugins";
import { guessContextWindow, getSessionTitle, renameSession, listSessions, invalidateSessionCache } from "./session";
import { getLatticeHome, loadConfig } from "../config";
import { log } from "../logger";
import { getDailySpend, invalidateDailySpendCache } from "../analytics/engine";
import { getWarmupModels, cacheRateLimitEntry } from "./warmup";
import { execSync } from "node:child_process";
import { sendPush } from "../push";
import { parseSpecPopulate, parsePlanContent, parseSpecActivity, populateSpec, updateSpec as updateSpecData, getSpec, addActivity } from "../features/specs";
import { ContextAnalyzer } from "../features/context-analyzer";

const HIDDEN_TOOLS = new Set([
  "TaskUpdate", "TaskCreate", "TaskGet", "TaskList", "TaskOutput", "TaskStop",
  "TodoWrite", "TodoRead",
  "EnterPlanMode", "ExitPlanMode",
  "ToolSearch",
]);

let claudeExePath: string | null = null;

function getClaudeExecutablePath(): string {
  if (claudeExePath) return claudeExePath;
  try {
    claudeExePath = execSync("which claude", { encoding: "utf-8" }).trim();
    log.chat("Using system claude: %s", claudeExePath);
  } catch {
    claudeExePath = "claude";
  }
  return claudeExePath;
}

interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  toolName: string;
  toolUseID: string;
  input: Record<string, unknown>;
  suggestions: PermissionUpdate[] | undefined;
  clientId: string;
  sessionId: string;
  promptType?: string;
}

const pendingPermissions = new Map<string, PendingPermission>();

interface PendingElicitation {
  resolve: (result: { action: "accept" | "decline"; content?: Record<string, unknown> }) => void;
  clientId: string;
  sessionId: string;
}

const pendingElicitations = new Map<string, PendingElicitation>();

const autoApprovedTools = new Map<string, Set<string>>();
const sessionPermissionOverrides = new Map<string, PermissionMode>();

export interface ChatStreamOptions {
  projectSlug: string;
  sessionId: string;
  text: string;
  attachments?: Attachment[];
  clientId: string;
  cwd: string;
  env?: Record<string, string>;
  model?: string;
  effort?: "low" | "medium" | "high" | "max";
  isNewSession?: boolean;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  specId?: string;
}

export interface ModelEntry {
  value: string;
  displayName: string;
}

export function getAvailableModels(): ModelEntry[] {
  return getWarmupModels();
}

interface MessageQueue {
  push(msg: SDKUserMessage): void;
  end(): void;
  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage>;
}

function createMessageQueue(): MessageQueue {
  const queue: SDKUserMessage[] = [];
  let waiting: ((result: IteratorResult<SDKUserMessage>) => void) | null = null;
  let ended = false;

  return {
    push: function (msg: SDKUserMessage) {
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: msg, done: false });
      } else {
        queue.push(msg);
      }
    },
    end: function () {
      ended = true;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ value: undefined as any, done: true });
      }
    },
    [Symbol.asyncIterator]: function () {
      return {
        next: function (): Promise<IteratorResult<SDKUserMessage>> {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false });
          }
          if (ended) {
            return Promise.resolve({ value: undefined as any, done: true });
          }
          return new Promise(function (resolve) {
            waiting = resolve;
          });
        },
      };
    },
  };
}

interface SessionStream {
  sessionId: string;
  messageQueue: MessageQueue;
  queryInstance: Query;
  abortController: AbortController;
  projectSlug: string;
  clientId: string;
  cwd: string;
  turnStartTime: number;
  firstUserMessage: string;
  currentModel: string | undefined;
  activeToolBlocks: Record<number, { id: string; name: string; inputJson: string }>;
  hiddenToolIds: Set<string>;
  turnDoneSent: boolean;
  messageUUIDs: Array<{ uuid: string; type: string }>;
  ended: boolean;
  accumulatedText: string;
  specId?: string;
  analyzer: ContextAnalyzer;
  sawNewTurnContent: boolean;
}

const sessionStreams = new Map<string, SessionStream>();
const pendingStreams = new Set<string>();
const interruptedSessions = new Set<string>();


function getStreamStatePath(): string {
  return join(getLatticeHome(), "active-streams.json");
}

function persistStreamState(): void {
  const entries: Record<string, { projectSlug: string; clientId: string; startedAt: number }> = {};
  sessionStreams.forEach(function (session, sessionId) {
    if (!session.ended) {
      entries[sessionId] = { projectSlug: session.projectSlug, clientId: session.clientId, startedAt: session.turnStartTime };
    }
  });
  const dir = getLatticeHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getStreamStatePath(), JSON.stringify(entries), "utf-8");
}

export function loadInterruptedSessions(): void {
  const path = getStreamStatePath();
  if (!existsSync(path)) return;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    for (const sessionId of Object.keys(data)) {
      interruptedSessions.add(sessionId);
    }
  } catch {}
  writeFileSync(path, "{}", "utf-8");
}

export function wasSessionInterrupted(sessionId: string): boolean {
  return interruptedSessions.has(sessionId);
}

export function clearInterruptedFlag(sessionId: string): void {
  interruptedSessions.delete(sessionId);
}

export function getPendingPermission(requestId: string): PendingPermission | undefined {
  return pendingPermissions.get(requestId);
}

export function deletePendingPermission(requestId: string): void {
  pendingPermissions.delete(requestId);
}

export function cleanupClientPermissions(clientId: string): void {
  const toRemove: string[] = [];
  pendingPermissions.forEach(function (entry, requestId) {
    if (entry.clientId === clientId) {
      toRemove.push(requestId);
      entry.resolve({ behavior: "deny", message: "Client disconnected.", toolUseID: entry.toolUseID });
    }
  });
  for (let i = 0; i < toRemove.length; i++) {
    pendingPermissions.delete(toRemove[i]);
  }
  if (toRemove.length > 0) {
    log.chat("Cleaned up %d pending permission(s) for disconnected client %s", toRemove.length, clientId);
  }
}

export function getPendingElicitation(requestId: string): PendingElicitation | undefined {
  return pendingElicitations.get(requestId);
}

export function resolveElicitation(requestId: string, result: { action: "accept" | "decline"; content?: Record<string, unknown> }): void {
  const pending = pendingElicitations.get(requestId);
  if (!pending) return;
  pendingElicitations.delete(requestId);
  pending.resolve(result);
}

export function cleanupClientElicitations(clientId: string): void {
  const toRemove: string[] = [];
  pendingElicitations.forEach(function (entry, requestId) {
    if (entry.clientId === clientId) {
      toRemove.push(requestId);
      entry.resolve({ action: "decline" });
    }
  });
  for (let i = 0; i < toRemove.length; i++) {
    pendingElicitations.delete(toRemove[i]);
  }
}

export function addAutoApprovedTool(sessionId: string, toolName: string): void {
  let tools = autoApprovedTools.get(sessionId);
  if (!tools) {
    tools = new Set<string>();
    autoApprovedTools.set(sessionId, tools);
  }
  tools.add(toolName);
}

export function setSessionPermissionOverride(sessionId: string, mode: PermissionMode): void {
  sessionPermissionOverrides.set(sessionId, mode);
}

export function getActiveStream(sessionId: string): Query | undefined {
  const session = sessionStreams.get(sessionId);
  return session && !session.ended ? session.queryInstance : undefined;
}

export function getSessionStream(sessionId: string): SessionStream | undefined {
  const session = sessionStreams.get(sessionId);
  return session && !session.ended ? session : undefined;
}

export function getActiveStreamCount(): number {
  let count = 0;
  sessionStreams.forEach(function (session) {
    if (!session.ended) count++;
  });
  return count;
}

export function getActiveStreamCountForProject(projectSlug: string): number {
  let count = 0;
  sessionStreams.forEach(function (session) {
    if (!session.ended && session.projectSlug === projectSlug) count++;
  });
  return count;
}

export function getSessionStreamClientId(sessionId: string): string | undefined {
  const session = sessionStreams.get(sessionId);
  return session && !session.ended ? session.clientId : undefined;
}

export function endSessionStream(sessionId: string): void {
  const session = sessionStreams.get(sessionId);
  if (session && !session.ended) {
    session.ended = true;
    session.messageQueue.end();
    session.abortController.abort();
  }
}

export function matchesAllowRules(rules: string[], toolName: string, currentRule: string): boolean {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule === toolName || rule === currentRule) return true;
    const ruleMatch = rule.match(/^(\w+)\((.+)\)$/);
    if (!ruleMatch) continue;
    const ruleToolName = ruleMatch[1];
    const rulePattern = ruleMatch[2];
    if (ruleToolName !== toolName) continue;
    const currentMatch = currentRule.match(/^\w+\((.+)\)$/);
    if (!currentMatch) continue;
    const currentContent = currentMatch[1];
    if (rulePattern === "*") return true;
    if (rulePattern.endsWith(":*")) {
      const rulePrefix = rulePattern.slice(0, -1);
      if (currentContent.startsWith(rulePrefix) || currentContent === rulePattern.slice(0, -2)) return true;
    }
    if (rulePattern.endsWith("**")) {
      const dirPrefix = rulePattern.slice(0, -2);
      if (currentContent.startsWith(dirPrefix)) return true;
    }
  }
  return false;
}

export function buildPermissionRule(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash") {
    const command = input.command || input.cmd || "";
    if (typeof command === "string" && command) {
      const firstWord = command.split(/\s+/)[0];
      if (firstWord === "curl" || firstWord === "wget") {
        const urlMatch = command.match(/https?:\/\/[^\s"']+/);
        if (urlMatch) {
          try {
            const parsed = new URL(urlMatch[0]);
            return toolName + "(" + firstWord + ":" + parsed.hostname + ")";
          } catch {}
        }
      }
      return toolName + "(" + firstWord + ":*)";
    }
  }

  if (toolName === "Read" || toolName === "Edit" || toolName === "Write") {
    const filePath = input.file_path || input.path || "";
    if (typeof filePath === "string" && filePath) {
      const dirParts = filePath.split("/");
      dirParts.pop();
      const dir = dirParts.join("/");
      if (dir) {
        const prefix = dir.startsWith("/") ? "" : "/";
        return toolName + "(" + prefix + dir + "/**)";
      }
    }
  }

  if (toolName === "WebFetch") {
    const url = input.url || "";
    if (typeof url === "string" && url) {
      try {
        const parsed = new URL(url);
        return toolName + "(domain:" + parsed.hostname + ")";
      } catch {}
    }
  }

  return toolName;
}

const STRIP_PREFIXES = [
  /^please\s+/i,
  /^can\s+you\s+/i,
  /^could\s+you\s+/i,
  /^help\s+me\s+/i,
  /^i\s+need\s+you\s+to\s+/i,
  /^i\s+want\s+you\s+to\s+/i,
  /^i'd\s+like\s+you\s+to\s+/i,
];

function generateSessionTitle(userMessage: string): string {
  let title = userMessage
    .replace(/[#*_`~>\[\]()!]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  for (let i = 0; i < STRIP_PREFIXES.length; i++) {
    title = title.replace(STRIP_PREFIXES[i], "");
  }

  title = title.trim();

  if (title.length > 50) {
    title = title.slice(0, 50);
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > 30) {
      title = title.slice(0, lastSpace);
    }
  }

  if (!title) {
    return "";
  }

  return title.charAt(0).toUpperCase() + title.slice(1);
}

function isDefaultTitle(title: string): boolean {
  if (title === "Untitled") return true;
  if (/^Session\s+\d/.test(title)) return true;
  return false;
}

function resolvePromptText(text: string): string {
  if (text.startsWith("/")) {
    const parts = text.split(/\s+/);
    const skillName = parts[0].slice(1);
    const skillArgs = parts.slice(1).join(" ");
    const skillContent = resolveSkillContent(skillName);
    if (skillContent) {
      return "<skill-name>" + skillName + "</skill-name>\n" +
        "<skill-content>\n" + skillContent + "\n</skill-content>\n" +
        (skillArgs ? "<skill-args>" + skillArgs + "</skill-args>\n" : "") +
        "Execute this skill. Follow its instructions exactly.";
    }
  }
  return text;
}

function buildSDKUserMessage(prompt: string, attachments: Attachment[] | undefined, sessionId: string): SDKUserMessage {
  if (attachments && attachments.length > 0) {
    const contentBlocks: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];
    if (prompt) {
      contentBlocks.push({ type: "text", text: prompt });
    }

    for (let ai = 0; ai < attachments.length; ai++) {
      const att = attachments[ai];
      if (att.type === "image" && att.mimeType && !att.mimeType.includes("svg")) {
        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mimeType,
            data: att.content,
          },
        });
      } else {
        const prefix = att.name ? "[Attached: " + att.name + "]\n" : "";
        contentBlocks.push({
          type: "text",
          text: prefix + att.content,
        });
      }
    }

    return {
      type: "user",
      message: { role: "user", content: contentBlocks } as MessageParam,
      parent_tool_use_id: null,
      session_id: sessionId,
    };
  }

  return {
    type: "user",
    message: { role: "user", content: [{ type: "text", text: prompt }] } as MessageParam,
    parent_tool_use_id: null,
    session_id: sessionId,
  };
}

function pushToExistingStream(session: SessionStream, options: ChatStreamOptions): void {
  const { text, attachments, clientId, sessionId, model } = options;
  log.chat("Session %s pushing to existing stream (ended=%s)", sessionId, String(session.ended));

  session.clientId = clientId;
  session.turnStartTime = Date.now();
  session.turnDoneSent = false;
  session.sawNewTurnContent = false;
  session.activeToolBlocks = {};

  const prompt = resolvePromptText(text);
  const userMsg = buildSDKUserMessage(prompt, attachments, sessionId);

  sendTo(clientId, {
    type: "chat:user_message",
    text,
    uuid: crypto.randomUUID(),
  });

  if (model && model !== "default" && model !== session.currentModel) {
    void session.queryInstance.setModel(model).catch(function (err) {
      log.chat("Failed to switch model: %O", err);
    });
    session.currentModel = model;
  }

  broadcast({ type: "session:busy", sessionId, busy: true }, clientId);
  session.messageQueue.push(userMsg);
}

export function startChatStream(options: ChatStreamOptions): void {
  const { projectSlug, sessionId, text, attachments, clientId, cwd, env, model, effort, isNewSession } = options;
  log.chat("startChatStream called: session=%s project=%s client=%s", sessionId, projectSlug, clientId);

  const existing = sessionStreams.get(sessionId);
  if (existing && !existing.ended) {
    pushToExistingStream(existing, options);
    return;
  }

  const startTime = Date.now();
  const firstUserMessage = text;

  if (pendingStreams.has(sessionId)) {
    sendTo(clientId, { type: "chat:error", message: "Session already has an active stream." });
    return;
  }

  pendingStreams.add(sessionId);

  const projectSettingsPath = join(cwd, ".claude", "settings.json");
  let savedAdditionalDirs: string[] = [];
  let latticeDefaults: Record<string, unknown> = {};
  if (existsSync(projectSettingsPath)) {
    try {
      const projSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
      if (projSettings.permissions && Array.isArray(projSettings.permissions.additionalDirectories)) {
        savedAdditionalDirs = projSettings.permissions.additionalDirectories;
      }
      if (projSettings.lattice && typeof projSettings.lattice === "object") {
        latticeDefaults = projSettings.lattice as Record<string, unknown>;
      }
    } catch {}
  }

  const effectiveMode: PermissionMode = sessionPermissionOverrides.get(sessionId)
    || (latticeDefaults.defaultPermissionMode as PermissionMode | undefined)
    || "acceptEdits";
  sessionPermissionOverrides.delete(sessionId);

  let mcpServers: Record<string, unknown> = {};
  const claudeJsonPath = join(homedir(), ".claude.json");
  if (existsSync(claudeJsonPath)) {
    try {
      const claudeJson = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
      if (claudeJson.mcpServers && typeof claudeJson.mcpServers === "object") {
        mcpServers = claudeJson.mcpServers;
      }
    } catch {}
  }

  const pluginMcpServers = getPluginMcpServers();
  if (Object.keys(pluginMcpServers).length > 0) {
    mcpServers = { ...mcpServers, ...pluginMcpServers };
  }

  const projectMcpPath = join(cwd, ".mcp.json");
  if (existsSync(projectMcpPath)) {
    try {
      const projectMcpJson = JSON.parse(readFileSync(projectMcpPath, "utf-8"));
      if (projectMcpJson.mcpServers && typeof projectMcpJson.mcpServers === "object") {
        mcpServers = { ...mcpServers, ...projectMcpJson.mcpServers };
      }
    } catch {}
  }

  const abortController = new AbortController();
  const currentClientId = clientId;

  const queryOptions: Parameters<typeof query>[0]["options"] = {
    cwd,
    permissionMode: effectiveMode,
    promptSuggestions: true,
    settingSources: ["user", "project", "local"],
    includePartialMessages: true,
    enableFileCheckpointing: true,
    agentProgressSummaries: true,
    extraArgs: { "replay-user-messages": null },
    abortController,
    pathToClaudeCodeExecutable: getClaudeExecutablePath(),
    additionalDirectories: savedAdditionalDirs.length > 0 ? savedAdditionalDirs : undefined,
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers as Record<string, any> : undefined,
    stderr: function (data: string) {
      log.chat("Session %s SDK stderr: %s", sessionId, data.trim());
    },
  };

  (queryOptions as any).toolConfig = {
    askUserQuestion: { previewFormat: "html" },
  };

  queryOptions.onElicitation = function (request: any, opts: any) {
    return new Promise(function (resolve) {
      const requestId = crypto.randomUUID();
      const activeClientId = (sessionStreams.get(sessionId) || { clientId: currentClientId }).clientId;
      pendingElicitations.set(requestId, { resolve, clientId: activeClientId, sessionId });
      sendTo(activeClientId, {
        type: "chat:elicitation_request",
        requestId,
        serverName: request.serverName || "MCP Server",
        message: request.message || "",
        mode: request.mode || "form",
        url: request.url || null,
        requestedSchema: request.requestedSchema || null,
      });
      sendPush({ type: "elicitation", title: "Input Required", body: (request.serverName || "MCP Server") + " needs your input", sessionId });
      if (opts && opts.signal) {
        opts.signal.addEventListener("abort", function () {
          if (pendingElicitations.has(requestId)) {
            pendingElicitations.delete(requestId);
            resolve({ action: "decline" });
          }
        }, { once: true });
      }
    });
  } as any;

  queryOptions.canUseTool = function (toolName, input, options) {
    const ss = sessionStreams.get(sessionId);
    const activeClientId = ss ? ss.clientId : currentClientId;

    const approved = autoApprovedTools.get(sessionId);
    if (approved && approved.has(toolName)) {
      return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
    }

    if (toolName === "AskUserQuestion") {
      const promptRequestId = options.toolUseID;
      const questions = (input as { questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string; preview?: string }>; multiSelect: boolean }> }).questions;
      sendTo(activeClientId, {
        type: "chat:prompt_request",
        requestId: promptRequestId,
        questions: questions,
      });
      return new Promise<PermissionResult>(function (resolve) {
        pendingPermissions.set(promptRequestId, {
          resolve: resolve,
          toolName: toolName,
          toolUseID: options.toolUseID,
          input: input,
          suggestions: undefined,
          clientId: activeClientId,
          sessionId: sessionId,
          promptType: "question",
        });
      });
    }

    if (toolName === "ExitPlanMode") {
      sendTo(activeClientId, {
        type: "chat:plan_mode",
        active: false,
      });
    }

    if (toolName === "Read") {
      const readPath = (input.file_path || input.path || "") as string;
      if (readPath.startsWith("/tmp/") || readPath === "/tmp") {
        return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
      }
    }

    if (toolName === "Bash") {
      const cmd = ((input.command || "") as string).trim();
      if (cmd.startsWith("cd ")) {
        let cdTarget = cmd.slice(3).trim().replace(/^["']|["']$/g, "");
        if (cdTarget.startsWith("~")) {
          cdTarget = join(homedir(), cdTarget.slice(1));
        }
        const cdResolved = resolve(cwd, cdTarget);
        const home = homedir();
        if (cdResolved.startsWith(cwd) || cdResolved === cwd || cdResolved.startsWith(home) || cdResolved === home) {
          return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
        }
      }
    }

    let allowRules: string[] = [];
    if (existsSync(projectSettingsPath)) {
      try {
        const projSettingsForRules = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
        if (projSettingsForRules.permissions && Array.isArray(projSettingsForRules.permissions.allow)) {
          allowRules = projSettingsForRules.permissions.allow;
        }
      } catch {}
    }

    if (allowRules.length > 0) {
      const currentRule = buildPermissionRule(toolName, input);
      if (matchesAllowRules(allowRules, toolName, currentRule)) {
        return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
      }
    }

    const requestId = options.toolUseID;
    const rule = buildPermissionRule(toolName, input);
    const title = options.title || rule;

    sendTo(activeClientId, {
      type: "chat:permission_request",
      requestId: requestId,
      tool: toolName,
      args: JSON.stringify(input),
      title: title,
      decisionReason: options.decisionReason,
      permissionRule: rule,
    });
    sendPush({ type: "permission_request", title: "Permission Required", body: toolName + ": " + title, sessionId });

    return new Promise<PermissionResult>(function (resolve) {
      pendingPermissions.set(requestId, {
        resolve: resolve,
        toolName: toolName,
        toolUseID: options.toolUseID,
        input: input,
        suggestions: options.suggestions,
        clientId: activeClientId,
        sessionId: sessionId,
      });

      if (options.signal) {
        options.signal.addEventListener("abort", function () {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({ behavior: "deny", message: "Stream aborted.", toolUseID: options.toolUseID });
            sendTo(activeClientId, { type: "chat:permission_resolved", requestId: requestId, status: "denied" });
          }
        }, { once: true });
      }
    });
  } as CanUseTool;

  let shouldResume = false;
  if (isNewSession) {
    shouldResume = false;
  } else {
    const hash = cwd.replace(/\//g, "-");
    const sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
    shouldResume = existsSync(sessionFile);
  }

  if (shouldResume) {
    queryOptions.resume = sessionId;
  } else {
    queryOptions.sessionId = sessionId;
  }

  if (model && model !== "default") {
    queryOptions.model = model;
  }

  if (!model || model === "default") {
    if (latticeDefaults.defaultModel && typeof latticeDefaults.defaultModel === "string") {
      queryOptions.model = latticeDefaults.defaultModel as string;
    }
  }

  if (effort) {
    queryOptions.effort = effort;
  }

  if (!effort) {
    if (latticeDefaults.defaultEffort && typeof latticeDefaults.defaultEffort === "string") {
      queryOptions.effort = latticeDefaults.defaultEffort as any;
    }
  }

  if (latticeDefaults.thinking) {
    (queryOptions as any).thinking = latticeDefaults.thinking;
  }

  if (env) {
    queryOptions.env = env;
  }

  if (options.systemPrompt) {
    (queryOptions as any).systemPrompt = options.systemPrompt;
  }

  const prompt = resolvePromptText(text);

  sendTo(clientId, {
    type: "chat:user_message",
    text,
    uuid: crypto.randomUUID(),
  });

  const mq = createMessageQueue();
  const firstMsg = buildSDKUserMessage(prompt, attachments, sessionId);

  const stream = query({ prompt: mq as any, options: queryOptions });
  pendingStreams.delete(sessionId);

  const sessionStream: SessionStream = {
    sessionId,
    messageQueue: mq,
    queryInstance: stream,
    abortController,
    projectSlug,
    clientId,
    cwd,
    turnStartTime: startTime,
    firstUserMessage: text,
    currentModel: model,
    activeToolBlocks: {},
    hiddenToolIds: new Set<string>(),
    turnDoneSent: false,
    messageUUIDs: [],
    ended: false,
    accumulatedText: "",
    specId: options.specId,
    sawNewTurnContent: false,
    analyzer: new ContextAnalyzer(function (msg) {
      const ss = sessionStreams.get(sessionId);
      if (ss) sendTo(ss.clientId, msg as any);
    }),
  };
  sessionStreams.set(sessionId, sessionStream);
  persistStreamState();
  broadcast({ type: "session:busy", sessionId, busy: true }, clientId);

  void (async function () {
    log.chat("Session %s stream starting (resume=%s, model=%s)", sessionId, String(shouldResume), model || "default");
    try {
      await stream.initializationResult();
      log.chat("Session %s SDK initialized", sessionId);
    } catch (initErr) {
      log.chat("Session %s SDK initialization FAILED: %O", sessionId, initErr);
    }
    log.chat("Session %s pushing first message to queue", sessionId);
    mq.push(firstMsg);
    let retrying = false;
    try {
      log.chat("Session %s entering stream loop", sessionId);
      let msgCount = 0;
      for await (const msg of stream) {
        msgCount++;
        log.chat("Session %s msg #%d type=%s", sessionId, msgCount, msg.type);
        processMessage(sessionStream, msg);
      }
      log.chat("Session %s stream ended normally after %d messages", sessionId, msgCount);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.chat("Session %s stream error: %s", sessionId, errMsg);
      if (errMsg.includes("aborted") || errMsg.includes("AbortError")) {
        log.chat("Session %s stream aborted", sessionId);
      } else if (errMsg.includes("Sent before connected") && shouldResume) {
        log.chat("Session %s WebSocket not ready after resume, retrying in 500ms", sessionId);
        retrying = true;
      } else {
        console.error("[lattice] SDK stream error: " + errMsg);
        sendTo(sessionStream.clientId, { type: "chat:error", message: errMsg });
      }
    } finally {
      sessionStream.ended = true;
      pendingStreams.delete(sessionId);
      sessionStreams.delete(sessionId);
      persistStreamState();

      if (retrying) {
        log.chat("Session %s cleaning up for retry", sessionId);
        await new Promise(function (resolve) { setTimeout(resolve, 500); });
        startChatStream(options);
        return;
      }

      broadcast({ type: "session:busy", sessionId, busy: false }, sessionStream.clientId);

      const toCleanup: string[] = [];
      pendingPermissions.forEach(function (entry, reqId) {
        if (entry.sessionId === sessionId) {
          toCleanup.push(reqId);
          entry.resolve({ behavior: "deny", message: "Session ended.", toolUseID: entry.toolUseID });
          sendTo(entry.clientId, { type: "chat:permission_resolved", requestId: reqId, status: "denied" });
        }
      });
      toCleanup.forEach(function (reqId) { pendingPermissions.delete(reqId); });

      const elicitToCleanup: string[] = [];
      pendingElicitations.forEach(function (entry, reqId) {
        if (entry.sessionId === sessionId) {
          elicitToCleanup.push(reqId);
          entry.resolve({ action: "decline" });
        }
      });
      elicitToCleanup.forEach(function (reqId) { pendingElicitations.delete(reqId); });

      autoApprovedTools.delete(sessionId);
      sessionPermissionOverrides.delete(sessionId);

      if (!sessionStream.turnDoneSent) {
        sessionStream.turnDoneSent = true;
        sendTo(sessionStream.clientId, { type: "chat:done", cost: 0, duration: Date.now() - sessionStream.turnStartTime });
      }
    }
  })();
}

function processStructuredOutput(ss: SessionStream): void {
  const text = ss.accumulatedText;
  const specId = ss.specId!;

  const specFields = parseSpecPopulate(text);
  if (specFields) {
    const updated = populateSpec(specId, specFields, ss.sessionId);
    if (updated) {
      broadcastToProject(ss.projectSlug, { type: "specs:updated", spec: updated });
    }
  }

  const planContent = parsePlanContent(text);
  if (planContent) {
    const updatedPlan = updateSpecData(specId, {
      sections: { implementationPlan: planContent },
    });
    if (updatedPlan) {
      broadcastToProject(ss.projectSlug, { type: "specs:updated", spec: updatedPlan });
    }
  }

  let searchText = text;
  let activityData = parseSpecActivity(searchText);
  while (activityData) {
    const updatedActivity = addActivity(specId, activityData.type as any, activityData.detail, ss.sessionId);
    if (updatedActivity) {
      broadcastToProject(ss.projectSlug, { type: "specs:activity_added", spec: updatedActivity });
    }
    const endIdx = searchText.indexOf("</spec-activity>");
    searchText = searchText.slice(endIdx + "</spec-activity>".length);
    activityData = parseSpecActivity(searchText);
  }

  ss.accumulatedText = "";
}

function processMessage(ss: SessionStream, msg: SDKMessage): void {
  const sessionId = ss.sessionId;

  if (msg.type === "system") {
    const sysMsg = msg as { type: "system"; subtype?: string; mcp_servers?: { name: string; status: string }[]; tools?: string[] };
    if (sysMsg.subtype === "init") {
      const toolCount = (sysMsg.tools || []).length;
      const mcpCount = (sysMsg.mcp_servers || []).filter(function (s) { return s.status === "connected"; }).length;
      log.chat("Session ready: %d tools, %d MCP servers connected", toolCount, mcpCount);
    }
    return;
  }

  if (msg.type === "assistant") {
    const assistantMsg = msg as { type: "assistant"; message: { content: unknown; model?: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } } };
    log.chat("Session %s assistant message: model=%s", sessionId, assistantMsg.message.model || "unknown");
    const msgUsage = assistantMsg.message.usage;
    if (msgUsage && msgUsage.input_tokens != null) {
      const ctxWindow = guessContextWindow(assistantMsg.message.model || "");
      sendTo(ss.clientId, {
        type: "chat:context_usage",
        inputTokens: msgUsage.input_tokens || 0,
        outputTokens: msgUsage.output_tokens || 0,
        cacheReadTokens: msgUsage.cache_read_input_tokens || 0,
        cacheCreationTokens: msgUsage.cache_creation_input_tokens || 0,
        contextWindow: ctxWindow,
      });
      ss.analyzer.updateUsage({
        inputTokens: msgUsage.input_tokens || 0,
        outputTokens: msgUsage.output_tokens || 0,
        cacheReadTokens: msgUsage.cache_read_input_tokens || 0,
        cacheCreationTokens: msgUsage.cache_creation_input_tokens || 0,
      }, ctxWindow);
    }
    return;
  }

  if (msg.type === "stream_event") {
    const partial = msg as SDKPartialAssistantMessage;
    const evt = partial.event;

    if (evt.type === "content_block_start") {
      const blockInfo = (evt as { content_block: { type: string; name?: string }; index: number }).content_block;
      log.chat("Session %s content_block_start: type=%s name=%s", sessionId, blockInfo.type, blockInfo.name || "text");
      ss.sawNewTurnContent = true;
      const block = (evt as { content_block: { type: string; id?: string; name?: string }; index: number }).content_block;
      const idx = (evt as { index: number }).index;
      if (block.type === "tool_use" && block.id && block.name) {
        ss.activeToolBlocks[idx] = { id: block.id, name: block.name, inputJson: "" };
        ss.analyzer.onToolStart(block.id, block.name);
        if (HIDDEN_TOOLS.has(block.name)) {
          ss.hiddenToolIds.add(block.id);
        } else {
          sendTo(ss.clientId, {
            type: "chat:tool_start",
            toolId: block.id,
            name: block.name,
            args: "",
          });
        }
      }
      return;
    }

    if (evt.type === "content_block_delta") {
      const deltaEvt = evt as { index: number; delta: { type: string; text?: string; partial_json?: string } };
      const blockIdx = deltaEvt.index;

      if (deltaEvt.delta.type === "text_delta" && typeof deltaEvt.delta.text === "string") {
        sendTo(ss.clientId, { type: "chat:delta", text: deltaEvt.delta.text });
        if (ss.specId) {
          ss.accumulatedText += deltaEvt.delta.text;
        }
      } else if (deltaEvt.delta.type === "input_json_delta" && ss.activeToolBlocks[blockIdx]) {
        ss.activeToolBlocks[blockIdx].inputJson += deltaEvt.delta.partial_json || "";
      }
      return;
    }

    if (evt.type === "content_block_stop") {
      const stopIdx = (evt as { index: number }).index;
      const stoppedBlock = ss.activeToolBlocks[stopIdx];
      if (stoppedBlock) {
        if (!HIDDEN_TOOLS.has(stoppedBlock.name)) {
          sendTo(ss.clientId, {
            type: "chat:tool_start",
            toolId: stoppedBlock.id,
            name: stoppedBlock.name,
            args: stoppedBlock.inputJson,
          });
        }
        if (stoppedBlock.name === "TodoWrite" && stoppedBlock.inputJson) {
          try {
            const todoInput = JSON.parse(stoppedBlock.inputJson) as { todos?: Array<{ id?: string; content: string; status: string; activeForm?: string }> };
            if (todoInput.todos) {
              sendTo(ss.clientId, {
                type: "chat:todo_update",
                todos: todoInput.todos.map(function (t, idx) {
                  return { id: t.id || String(idx), content: t.content, status: t.status, priority: "medium" };
                }),
              });
            }
          } catch {}
        }
        if (stoppedBlock.name === "EnterPlanMode") {
          sendTo(ss.clientId, { type: "chat:plan_mode", active: true });
        }
        if (stoppedBlock.name === "ExitPlanMode") {
          sendTo(ss.clientId, { type: "chat:plan_mode", active: false });
        }
        delete ss.activeToolBlocks[stopIdx];
      }
      return;
    }

    return;
  }

  if (msg.type === "user") {
    const userMsg = msg as { type: "user"; message: { content: unknown }; uuid?: string; tool_use_result?: unknown };
    if (userMsg.uuid) {
      ss.messageUUIDs.push({ uuid: userMsg.uuid, type: "user" });
      sendTo(ss.clientId, { type: "chat:message_uuid" as any, uuid: userMsg.uuid, messageType: "user" });
    }
    const content = userMsg.message.content;
    if (Array.isArray(content)) {
      for (let i = 0; i < content.length; i++) {
        const item = content[i] as { type?: string; tool_use_id?: string; content?: unknown };
        if (item.type === "tool_result" && item.tool_use_id) {
          ss.analyzer.onToolResult(item.tool_use_id);
          if (ss.hiddenToolIds.has(item.tool_use_id)) continue;
          const resultContent = typeof item.content === "string"
            ? item.content
            : JSON.stringify(item.content ?? "");
          sendTo(ss.clientId, {
            type: "chat:tool_result",
            toolId: item.tool_use_id,
            content: resultContent,
          });
        }
      }
    }
    return;
  }

  if (msg.type === "rate_limit_event") {
    const rlMsg = msg as { type: string; rate_limit_info: { status: string; utilization?: number; resetsAt?: number; rateLimitType?: string; overageStatus?: string; overageResetsAt?: number; isUsingOverage?: boolean } };
    const rli = rlMsg.rate_limit_info;
    cacheRateLimitEntry({
      status: rli.status,
      utilization: rli.utilization,
      resetsAt: rli.resetsAt,
      rateLimitType: rli.rateLimitType,
      overageStatus: rli.overageStatus,
      overageResetsAt: rli.overageResetsAt,
      isUsingOverage: rli.isUsingOverage,
    });
    sendTo(ss.clientId, {
      type: "chat:rate_limit",
      status: rli.status,
      utilization: rli.utilization,
      resetsAt: rli.resetsAt,
      rateLimitType: rli.rateLimitType,
      overageStatus: rli.overageStatus,
      overageResetsAt: rli.overageResetsAt,
      isUsingOverage: rli.isUsingOverage,
    } as any);
    return;
  }

  if (msg.type === "prompt_suggestion") {
    const suggestion = (msg as { type: string; suggestion: string }).suggestion;
    if (suggestion) {
      sendTo(ss.clientId, { type: "chat:prompt_suggestion", suggestion: suggestion });
    }
    return;
  }

  if (msg.type === "result") {
    const resultMsg = msg as SDKResultMessage;
    log.chat("Session %s result: cost=$%s, sawContent=%s", sessionId, String(resultMsg.total_cost_usd || 0), String(ss.sawNewTurnContent));
    if (!ss.sawNewTurnContent) {
      log.chat("Session %s ignoring replayed result (no new turn content seen)", sessionId);
      return;
    }
    const dur = Date.now() - ss.turnStartTime;
    const cost = resultMsg.total_cost_usd || 0;

    if (resultMsg.usage) {
      let contextWindow = 0;
      if (resultMsg.modelUsage) {
        const modelKeys = Object.keys(resultMsg.modelUsage);
        for (let mk = 0; mk < modelKeys.length; mk++) {
          const mu = resultMsg.modelUsage[modelKeys[mk]];
          if (mu.contextWindow > contextWindow) {
            contextWindow = mu.contextWindow;
          }
        }
        if (contextWindow === 0 && modelKeys.length > 0) {
          contextWindow = guessContextWindow(modelKeys[0]);
        }
      }
      sendTo(ss.clientId, {
        type: "chat:context_usage",
        inputTokens: resultMsg.usage.input_tokens || 0,
        outputTokens: resultMsg.usage.output_tokens || 0,
        cacheReadTokens: resultMsg.usage.cache_read_input_tokens || 0,
        cacheCreationTokens: resultMsg.usage.cache_creation_input_tokens || 0,
        contextWindow: contextWindow,
      });
      ss.analyzer.updateUsage({
        inputTokens: resultMsg.usage.input_tokens || 0,
        outputTokens: resultMsg.usage.output_tokens || 0,
        cacheReadTokens: resultMsg.usage.cache_read_input_tokens || 0,
        cacheCreationTokens: resultMsg.usage.cache_creation_input_tokens || 0,
      }, contextWindow);
    }

    if (ss.specId && ss.accumulatedText) {
      processStructuredOutput(ss);
    }

    ss.turnDoneSent = true;
    sendTo(ss.clientId, { type: "chat:done", cost: cost, duration: dur });
    sendPush({ type: "done", title: "Task Complete", body: "Claude finished responding", sessionId, projectSlug: ss.projectSlug });
    invalidateDailySpendCache();
    const budgetConfig = loadConfig().costBudget;
    if (budgetConfig) {
      sendTo(ss.clientId, {
        type: "budget:status",
        dailySpend: getDailySpend(),
        dailyLimit: budgetConfig.dailyLimit,
        enforcement: budgetConfig.enforcement,
      } as never);
    }
    broadcast({ type: "session:busy", sessionId, busy: false }, ss.clientId);
    syncSessionToPeers(ss.cwd, ss.projectSlug, sessionId);

    void getSessionTitle(ss.projectSlug, sessionId).then(function (currentTitle) {
      if (!isDefaultTitle(currentTitle)) return;
      const newTitle = generateSessionTitle(ss.firstUserMessage);
      if (!newTitle) return;
      void renameSession(ss.projectSlug, sessionId, newTitle).then(function (ok) {
        if (!ok) return;
        log.session("Auto-titled session %s: %s", sessionId, newTitle);
        invalidateSessionCache(ss.projectSlug);
        void listSessions(ss.projectSlug, { limit: 40 }).then(function (result) {
          broadcast({ type: "session:list", projectSlug: ss.projectSlug, sessions: result.sessions, totalCount: result.totalCount });
        });
      });
    });

    return;
  }
}
