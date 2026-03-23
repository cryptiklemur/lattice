import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKPartialAssistantMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionMode, PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { Attachment } from "@lattice/shared";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { sendTo, broadcast } from "../ws/broadcast";
import { syncSessionToPeers } from "../mesh/session-sync";
import { resolveSkillContent } from "../handlers/skills";
import { guessContextWindow, getSessionTitle, renameSession, listSessions } from "./session";
import { getLatticeHome, loadConfig } from "../config";
import { log } from "../logger";
import { getDailySpend, invalidateDailySpendCache } from "../analytics/engine";

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

var pendingPermissions = new Map<string, PendingPermission>();
var autoApprovedTools = new Map<string, Set<string>>();
var sessionPermissionOverrides = new Map<string, PermissionMode>();

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
}

export interface ModelEntry {
  value: string;
  displayName: string;
}

var KNOWN_MODELS: ModelEntry[] = [
  { value: "default", displayName: "Default" },
  { value: "opus", displayName: "Opus" },
  { value: "sonnet", displayName: "Sonnet" },
  { value: "haiku", displayName: "Haiku" },
];

export function getAvailableModels(): ModelEntry[] {
  return KNOWN_MODELS.slice();
}

var activeStreams = new Map<string, Query>();
var pendingStreams = new Set<string>();
var streamMetadata = new Map<string, { projectSlug: string; clientId: string; startedAt: number }>();
var interruptedSessions = new Set<string>();

// Track external lock state so we only broadcast on changes
var externalLockState = new Map<string, boolean>();
var watchedSessions = new Set<string>();

/**
 * Start polling a session's lock file for external CLI usage.
 * Called when a client activates a session.
 */
export function watchSessionLock(sessionId: string): void {
  watchedSessions.add(sessionId);
}

/**
 * Stop polling a session's lock file.
 */
export function unwatchSessionLock(sessionId: string): void {
  watchedSessions.delete(sessionId);
  externalLockState.delete(sessionId);
}

// Poll every 3 seconds for external lock changes
setInterval(function () {
  for (var sessionId of watchedSessions) {
    // Skip sessions with active Lattice streams — those are already tracked
    if (activeStreams.has(sessionId)) continue;

    var locked = isSessionLockedByExternal(sessionId);
    var prev = externalLockState.get(sessionId) ?? false;

    if (locked !== prev) {
      externalLockState.set(sessionId, locked);
      broadcast({ type: "session:busy", sessionId, busy: locked });
    }
  }
}, 3000);

function getStreamStatePath(): string {
  return join(getLatticeHome(), "active-streams.json");
}

function persistStreamState(): void {
  var entries: Record<string, { projectSlug: string; clientId: string; startedAt: number }> = {};
  streamMetadata.forEach(function (meta, sessionId) {
    entries[sessionId] = meta;
  });
  var dir = getLatticeHome();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getStreamStatePath(), JSON.stringify(entries), "utf-8");
}

export function loadInterruptedSessions(): void {
  var path = getStreamStatePath();
  if (!existsSync(path)) return;
  try {
    var data = JSON.parse(readFileSync(path, "utf-8"));
    for (var sessionId of Object.keys(data)) {
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
  var toRemove: string[] = [];
  pendingPermissions.forEach(function (entry, requestId) {
    if (entry.clientId === clientId) {
      toRemove.push(requestId);
      entry.resolve({ behavior: "deny", message: "Client disconnected.", toolUseID: entry.toolUseID });
    }
  });
  for (var i = 0; i < toRemove.length; i++) {
    pendingPermissions.delete(toRemove[i]);
  }
  if (toRemove.length > 0) {
    log.chat("Cleaned up %d pending permission(s) for disconnected client %s", toRemove.length, clientId);
  }
}

export function addAutoApprovedTool(sessionId: string, toolName: string): void {
  var tools = autoApprovedTools.get(sessionId);
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
  return activeStreams.get(sessionId);
}

export function getActiveStreamCount(): number {
  return activeStreams.size;
}

/**
 * Check if a session is controlled by an external process (not Lattice).
 * Lattice's own active streams are handled by isProcessing on the client,
 * so this ONLY returns true for external CLI instances.
 */
export function isSessionBusy(sessionId: string): boolean {
  return isSessionLockedByExternal(sessionId);
}

/**
 * Check if a PID is the Lattice daemon or one of its child processes.
 * The SDK spawns child processes (e.g. claude-agent-sdk/cli.js) that hold
 * lock files — those are NOT external.
 */
function isOwnProcess(pid: number): boolean {
  var myPid = process.pid;
  if (pid === myPid) return true;
  // Walk up the process tree to see if pid is a descendant of us
  var current = pid;
  for (var i = 0; i < 10; i++) {
    try {
      var stat = readFileSync("/proc/" + current + "/stat", "utf-8");
      // Format: pid (comm) state ppid ...
      var match = stat.match(/^\d+\s+\([^)]*\)\s+\S+\s+(\d+)/);
      if (!match) return false;
      var ppid = parseInt(match[1], 10);
      if (ppid === myPid) return true;
      if (ppid <= 1) return false;
      current = ppid;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Get PIDs holding the session lock file, excluding Lattice's own process tree.
 * Returns the list of truly external PIDs.
 */
function getExternalLockPids(sessionId: string): number[] {
  var lockPath = join(homedir(), ".claude", "tasks", sessionId, ".lock");
  if (!existsSync(lockPath)) return [];
  try {
    var result = Bun.spawnSync(["fuser", lockPath], {
      stderr: "ignore",
    });
    if (result.exitCode !== 0) return [];
    var output = result.stdout.toString().trim();
    var pids = output.split(/\s+/)
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (p) { return !isNaN(p) && !isOwnProcess(p); });
    return pids;
  } catch {
    return [];
  }
}

function isSessionLockedByExternal(sessionId: string): boolean {
  return getExternalLockPids(sessionId).length > 0;
}

/**
 * Get the first external PID holding the session lock file.
 * Used to send SIGINT to stop the external process.
 */
function getExternalLockPid(sessionId: string): number | null {
  var pids = getExternalLockPids(sessionId);
  return pids.length > 0 ? pids[0] : null;
}

/**
 * Gracefully stop an external Claude Code CLI process controlling a session.
 * Sends SIGINT which triggers Claude Code's graceful shutdown.
 * Returns true if a signal was sent.
 */
export function stopExternalSession(sessionId: string): boolean {
  var pid = getExternalLockPid(sessionId);
  if (pid === null) return false;
  try {
    process.kill(pid, "SIGINT");
    return true;
  } catch {
    return false;
  }
}

export function getSessionStreamClientId(sessionId: string): string | undefined {
  var meta = streamMetadata.get(sessionId);
  return meta ? meta.clientId : undefined;
}

export function matchesAllowRules(rules: string[], toolName: string, currentRule: string): boolean {
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (rule === toolName || rule === currentRule) return true;
    var ruleMatch = rule.match(/^(\w+)\((.+)\)$/);
    if (!ruleMatch) continue;
    var ruleToolName = ruleMatch[1];
    var rulePattern = ruleMatch[2];
    if (ruleToolName !== toolName) continue;
    var currentMatch = currentRule.match(/^\w+\((.+)\)$/);
    if (!currentMatch) continue;
    var currentContent = currentMatch[1];
    if (rulePattern === "*") return true;
    if (rulePattern.endsWith(":*")) {
      var rulePrefix = rulePattern.slice(0, -1);
      if (currentContent.startsWith(rulePrefix) || currentContent === rulePattern.slice(0, -2)) return true;
    }
    if (rulePattern.endsWith("**")) {
      var dirPrefix = rulePattern.slice(0, -2);
      if (currentContent.startsWith(dirPrefix)) return true;
    }
  }
  return false;
}

export function buildPermissionRule(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash") {
    var command = input.command || input.cmd || "";
    if (typeof command === "string" && command) {
      var firstWord = command.split(/\s+/)[0];
      if (firstWord === "curl" || firstWord === "wget") {
        var urlMatch = command.match(/https?:\/\/[^\s"']+/);
        if (urlMatch) {
          try {
            var parsed = new URL(urlMatch[0]);
            return toolName + "(" + firstWord + ":" + parsed.hostname + ")";
          } catch {}
        }
      }
      return toolName + "(" + firstWord + ":*)";
    }
  }

  if (toolName === "Read" || toolName === "Edit" || toolName === "Write") {
    var filePath = input.file_path || input.path || "";
    if (typeof filePath === "string" && filePath) {
      var dirParts = filePath.split("/");
      dirParts.pop();
      var dir = dirParts.join("/");
      if (dir) {
        var prefix = dir.startsWith("/") ? "" : "/";
        return toolName + "(" + prefix + dir + "/**)";
      }
    }
  }

  if (toolName === "WebFetch") {
    var url = input.url || "";
    if (typeof url === "string" && url) {
      try {
        var parsed = new URL(url);
        return toolName + "(domain:" + parsed.hostname + ")";
      } catch {}
    }
  }

  return toolName;
}

var STRIP_PREFIXES = [
  /^please\s+/i,
  /^can\s+you\s+/i,
  /^could\s+you\s+/i,
  /^help\s+me\s+/i,
  /^i\s+need\s+you\s+to\s+/i,
  /^i\s+want\s+you\s+to\s+/i,
  /^i'd\s+like\s+you\s+to\s+/i,
];

function generateSessionTitle(userMessage: string): string {
  var title = userMessage
    .replace(/[#*_`~>\[\]()!]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  for (var i = 0; i < STRIP_PREFIXES.length; i++) {
    title = title.replace(STRIP_PREFIXES[i], "");
  }

  title = title.trim();

  if (title.length > 50) {
    title = title.slice(0, 50);
    var lastSpace = title.lastIndexOf(" ");
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

export function startChatStream(options: ChatStreamOptions): void {
  var { projectSlug, sessionId, text, attachments, clientId, cwd, env, model, effort, isNewSession } = options;
  var startTime = Date.now();
  var firstUserMessage = text;

  if (activeStreams.has(sessionId) || pendingStreams.has(sessionId)) {
    sendTo(clientId, { type: "chat:error", message: "Session already has an active stream." });
    return;
  }

  pendingStreams.add(sessionId);

  var projectSettingsPath = join(cwd, ".claude", "settings.json");
  var savedAdditionalDirs: string[] = [];
  var latticeDefaults: Record<string, unknown> = {};
  if (existsSync(projectSettingsPath)) {
    try {
      var projSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
      if (projSettings.permissions && Array.isArray(projSettings.permissions.additionalDirectories)) {
        savedAdditionalDirs = projSettings.permissions.additionalDirectories;
      }
      if (projSettings.lattice && typeof projSettings.lattice === "object") {
        latticeDefaults = projSettings.lattice as Record<string, unknown>;
      }
    } catch {}
  }

  var effectiveMode: PermissionMode = sessionPermissionOverrides.get(sessionId)
    || (latticeDefaults.defaultPermissionMode as PermissionMode | undefined)
    || "acceptEdits";
  sessionPermissionOverrides.delete(sessionId);

  var mcpServers: Record<string, unknown> = {};
  var claudeJsonPath = join(homedir(), ".claude.json");
  if (existsSync(claudeJsonPath)) {
    try {
      var claudeJson = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
      if (claudeJson.mcpServers && typeof claudeJson.mcpServers === "object") {
        mcpServers = claudeJson.mcpServers;
      }
    } catch {}
  }

  var projectMcpPath = join(cwd, ".mcp.json");
  if (existsSync(projectMcpPath)) {
    try {
      var projectMcpJson = JSON.parse(readFileSync(projectMcpPath, "utf-8"));
      if (projectMcpJson.mcpServers && typeof projectMcpJson.mcpServers === "object") {
        mcpServers = { ...mcpServers, ...projectMcpJson.mcpServers };
      }
    } catch {}
  }

  var queryOptions: Parameters<typeof query>[0]["options"] = {
    cwd,
    permissionMode: effectiveMode,
    promptSuggestions: true,
    additionalDirectories: savedAdditionalDirs.length > 0 ? savedAdditionalDirs : undefined,
    mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers as Record<string, any> : undefined,
  };

  (queryOptions as any).toolConfig = {
    askUserQuestion: { previewFormat: "html" },
  };

  queryOptions.canUseTool = function (toolName, input, options) {
    var approved = autoApprovedTools.get(sessionId);
    if (approved && approved.has(toolName)) {
      return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
    }

    if (toolName === "AskUserQuestion") {
      var promptRequestId = options.toolUseID;
      var questions = (input as { questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string; preview?: string }>; multiSelect: boolean }> }).questions;
      sendTo(clientId, {
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
          clientId: clientId,
          sessionId: sessionId,
          promptType: "question",
        });
      });
    }

    if (toolName === "ExitPlanMode") {
      sendTo(clientId, {
        type: "chat:plan_mode",
        active: false,
      });
    }

    if (toolName === "Read") {
      var readPath = (input.file_path || input.path || "") as string;
      if (readPath.startsWith("/tmp/") || readPath === "/tmp") {
        return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
      }
    }

    if (toolName === "Bash") {
      var cmd = ((input.command || "") as string).trim();
      if (cmd.startsWith("cd ")) {
        var cdTarget = cmd.slice(3).trim().replace(/^["']|["']$/g, "");
        if (cdTarget.startsWith("~")) {
          cdTarget = join(homedir(), cdTarget.slice(1));
        }
        var cdResolved = resolve(cwd, cdTarget);
        var home = homedir();
        if (cdResolved.startsWith(cwd) || cdResolved === cwd || cdResolved.startsWith(home) || cdResolved === home) {
          return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
        }
      }
    }

    var allowRules: string[] = [];
    if (existsSync(projectSettingsPath)) {
      try {
        var projSettingsForRules = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
        if (projSettingsForRules.permissions && Array.isArray(projSettingsForRules.permissions.allow)) {
          allowRules = projSettingsForRules.permissions.allow;
        }
      } catch {}
    }

    if (allowRules.length > 0) {
      var currentRule = buildPermissionRule(toolName, input);
      if (matchesAllowRules(allowRules, toolName, currentRule)) {
        return Promise.resolve({ behavior: "allow", updatedInput: input, toolUseID: options.toolUseID } as PermissionResult);
      }
    }

    var requestId = options.toolUseID;
    var rule = buildPermissionRule(toolName, input);
    var title = options.title || rule;

    sendTo(clientId, {
      type: "chat:permission_request",
      requestId: requestId,
      tool: toolName,
      args: JSON.stringify(input),
      title: title,
      decisionReason: options.decisionReason,
      permissionRule: rule,
    });

    return new Promise<PermissionResult>(function (resolve) {
      pendingPermissions.set(requestId, {
        resolve: resolve,
        toolName: toolName,
        toolUseID: options.toolUseID,
        input: input,
        suggestions: options.suggestions,
        clientId: clientId,
        sessionId: sessionId,
      });

      if (options.signal) {
        options.signal.addEventListener("abort", function () {
          if (pendingPermissions.has(requestId)) {
            pendingPermissions.delete(requestId);
            resolve({ behavior: "deny", message: "Stream aborted.", toolUseID: options.toolUseID });
            sendTo(clientId, { type: "chat:permission_resolved", requestId: requestId, status: "denied" });
          }
        }, { once: true });
      }
    });
  } as CanUseTool;

  var shouldResume = false;
  if (isNewSession) {
    shouldResume = false;
  } else {
    var hash = cwd.replace(/\//g, "-");
    var sessionFile = join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
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

  var prompt = text;
  if (text.startsWith("/")) {
    var parts = text.split(/\s+/);
    var skillName = parts[0].slice(1);
    var skillArgs = parts.slice(1).join(" ");
    var skillContent = resolveSkillContent(skillName);
    if (skillContent) {
      prompt = "<skill-name>" + skillName + "</skill-name>\n" +
        "<skill-content>\n" + skillContent + "\n</skill-content>\n" +
        (skillArgs ? "<skill-args>" + skillArgs + "</skill-args>\n" : "") +
        "Execute this skill. Follow its instructions exactly.";
    }
  }

  sendTo(clientId, {
    type: "chat:user_message",
    text,
    uuid: crypto.randomUUID(),
  });

  var activeToolBlocks: Record<number, { id: string; name: string; inputJson: string }> = {};
  var doneSent = false;

  var queryPrompt: string | AsyncIterable<SDKUserMessage>;

  if (attachments && attachments.length > 0) {
    var contentBlocks: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];
    contentBlocks.push({ type: "text", text: prompt });

    for (var ai = 0; ai < attachments.length; ai++) {
      var att = attachments[ai];
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
        var prefix = att.name ? "[Attached: " + att.name + "]\n" : "";
        contentBlocks.push({
          type: "text",
          text: prefix + att.content,
        });
      }
    }

    var userMessage: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: contentBlocks } as MessageParam,
      parent_tool_use_id: null,
    };

    queryPrompt = (async function* () {
      yield userMessage;
    })();
  } else {
    queryPrompt = prompt;
  }

  var stream = query({ prompt: queryPrompt, options: queryOptions });
  pendingStreams.delete(sessionId);
  activeStreams.set(sessionId, stream);
  streamMetadata.set(sessionId, { projectSlug, clientId, startedAt: Date.now() });
  persistStreamState();
  broadcast({ type: "session:busy", sessionId, busy: true }, clientId);

  void (async function () {
    try {
      for await (var msg of stream) {
        processMessage(msg);
      }
    } catch (err: unknown) {
      var errMsg = err instanceof Error ? err.message : String(err);
      console.error("[lattice] SDK stream error: " + errMsg);
      sendTo(clientId, { type: "chat:error", message: errMsg });
    } finally {
      pendingStreams.delete(sessionId);
      activeStreams.delete(sessionId);
      streamMetadata.delete(sessionId);
      persistStreamState();
      broadcast({ type: "session:busy", sessionId, busy: false }, clientId);

      var toCleanup: string[] = [];
      pendingPermissions.forEach(function (entry, reqId) {
        if (entry.sessionId === sessionId) {
          toCleanup.push(reqId);
          entry.resolve({ behavior: "deny", message: "Session ended.", toolUseID: entry.toolUseID });
          sendTo(entry.clientId, { type: "chat:permission_resolved", requestId: reqId, status: "denied" });
        }
      });
      toCleanup.forEach(function (reqId) { pendingPermissions.delete(reqId); });

      autoApprovedTools.delete(sessionId);
      sessionPermissionOverrides.delete(sessionId);

      if (!doneSent) {
        doneSent = true;
        sendTo(clientId, { type: "chat:done", cost: 0, duration: Date.now() - startTime });
      }
    }
  })();

  function processMessage(msg: SDKMessage): void {

    if (msg.type === "system") {
      var sysMsg = msg as { type: "system"; subtype?: string; mcp_servers?: { name: string; status: string }[]; tools?: string[] };
      if (sysMsg.subtype === "init") {
        var toolCount = (sysMsg.tools || []).length;
        var mcpCount = (sysMsg.mcp_servers || []).filter(function (s) { return s.status === "connected"; }).length;
        log.chat("Session ready: %d tools, %d MCP servers connected", toolCount, mcpCount);
      }
      return;
    }

    if (msg.type === "assistant") {
      var assistantMsg = msg as { type: "assistant"; message: { content: unknown; model?: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } } };
      var msgUsage = assistantMsg.message.usage;
      if (msgUsage && msgUsage.input_tokens != null) {
        sendTo(clientId, {
          type: "chat:context_usage",
          inputTokens: msgUsage.input_tokens || 0,
          outputTokens: msgUsage.output_tokens || 0,
          cacheReadTokens: msgUsage.cache_read_input_tokens || 0,
          cacheCreationTokens: msgUsage.cache_creation_input_tokens || 0,
          contextWindow: guessContextWindow(assistantMsg.message.model || ""),
        });
      }
      var aContent = assistantMsg.message.content;
      if (Array.isArray(aContent)) {
        for (var ai = 0; ai < aContent.length; ai++) {
          var aBlock = aContent[ai] as { type?: string; text?: string; id?: string; name?: string; input?: unknown };
          if (aBlock.type === "text" && aBlock.text) {
            sendTo(clientId, { type: "chat:delta", text: aBlock.text });
          } else if (aBlock.type === "tool_use" && aBlock.id && aBlock.name) {
            sendTo(clientId, {
              type: "chat:tool_start",
              toolId: aBlock.id,
              name: aBlock.name,
              args: JSON.stringify(aBlock.input ?? {}),
            });
            if (aBlock.name === "TodoWrite" && aBlock.input) {
              var todoInput = aBlock.input as { todos?: Array<{ id?: string; content: string; status: string; activeForm?: string }> };
              if (todoInput.todos) {
                sendTo(clientId, {
                  type: "chat:todo_update",
                  todos: todoInput.todos.map(function (t, idx) {
                    return { id: t.id || String(idx), content: t.content, status: t.status, priority: "medium" };
                  }),
                });
              }
            }
            if (aBlock.name === "EnterPlanMode") {
              sendTo(clientId, { type: "chat:plan_mode", active: true });
            }
            if (aBlock.name === "ExitPlanMode") {
              sendTo(clientId, { type: "chat:plan_mode", active: false });
            }
          }
        }
      } else if (typeof aContent === "string" && aContent) {
        sendTo(clientId, { type: "chat:delta", text: aContent });
      }
      return;
    }

    if (msg.type === "stream_event") {
      var partial = msg as SDKPartialAssistantMessage;
      var evt = partial.event;

      if (evt.type === "content_block_start") {
        var block = (evt as { content_block: { type: string; id?: string; name?: string }; index: number }).content_block;
        var idx = (evt as { index: number }).index;
        if (block.type === "tool_use" && block.id && block.name) {
          activeToolBlocks[idx] = { id: block.id, name: block.name, inputJson: "" };
          sendTo(clientId, {
            type: "chat:tool_start",
            toolId: block.id,
            name: block.name,
            args: "",
          });
        }
        return;
      }

      if (evt.type === "content_block_delta") {
        var deltaEvt = evt as { index: number; delta: { type: string; text?: string; partial_json?: string } };
        var blockIdx = deltaEvt.index;

        if (deltaEvt.delta.type === "text_delta" && typeof deltaEvt.delta.text === "string") {
          sendTo(clientId, { type: "chat:delta", text: deltaEvt.delta.text });
        } else if (deltaEvt.delta.type === "input_json_delta" && activeToolBlocks[blockIdx]) {
          activeToolBlocks[blockIdx].inputJson += deltaEvt.delta.partial_json || "";
          var updatedTool = activeToolBlocks[blockIdx];
          sendTo(clientId, {
            type: "chat:tool_start",
            toolId: updatedTool.id,
            name: updatedTool.name,
            args: updatedTool.inputJson,
          });
        }
        return;
      }

      if (evt.type === "content_block_stop") {
        var stopIdx = (evt as { index: number }).index;
        var stoppedBlock = activeToolBlocks[stopIdx];
        if (stoppedBlock) {
          if (stoppedBlock.name === "TodoWrite" && stoppedBlock.inputJson) {
            try {
              var todoInput = JSON.parse(stoppedBlock.inputJson) as { todos?: Array<{ id?: string; content: string; status: string }> };
              if (todoInput.todos) {
                sendTo(clientId, {
                  type: "chat:todo_update",
                  todos: todoInput.todos.map(function (t, idx) {
                    return { id: t.id || String(idx), content: t.content, status: t.status, priority: "medium" };
                  }),
                });
              }
            } catch {}
          }
          if (stoppedBlock.name === "EnterPlanMode") {
            sendTo(clientId, { type: "chat:plan_mode", active: true });
          }
          if (stoppedBlock.name === "ExitPlanMode") {
            sendTo(clientId, { type: "chat:plan_mode", active: false });
          }
          delete activeToolBlocks[stopIdx];
        }
        return;
      }

      return;
    }

    if (msg.type === "user") {
      var userMsg = msg as { type: "user"; message: { content: unknown }; tool_use_result?: unknown };
      var content = userMsg.message.content;
      if (Array.isArray(content)) {
        for (var i = 0; i < content.length; i++) {
          var item = content[i] as { type?: string; tool_use_id?: string; content?: unknown };
          if (item.type === "tool_result" && item.tool_use_id) {
            var resultContent = typeof item.content === "string"
              ? item.content
              : JSON.stringify(item.content ?? "");
            sendTo(clientId, {
              type: "chat:tool_result",
              toolId: item.tool_use_id,
              content: resultContent,
            });
          }
        }
      }
      return;
    }

    if (msg.type === "prompt_suggestion") {
      var suggestion = (msg as { type: string; suggestion: string }).suggestion;
      if (suggestion) {
        sendTo(clientId, { type: "chat:prompt_suggestion", suggestion: suggestion });
      }
      return;
    }

    if (msg.type === "result") {
      var resultMsg = msg as SDKResultMessage;
      var dur = Date.now() - startTime;
      var cost = resultMsg.total_cost_usd || 0;

      if (resultMsg.usage && resultMsg.modelUsage) {
        var contextWindow = 0;
        var modelKeys = Object.keys(resultMsg.modelUsage);
        for (var mk = 0; mk < modelKeys.length; mk++) {
          var mu = resultMsg.modelUsage[modelKeys[mk]];
          if (mu.contextWindow > contextWindow) {
            contextWindow = mu.contextWindow;
          }
        }
        sendTo(clientId, {
          type: "chat:context_usage",
          inputTokens: resultMsg.usage.input_tokens || 0,
          outputTokens: resultMsg.usage.output_tokens || 0,
          cacheReadTokens: resultMsg.usage.cache_read_input_tokens || 0,
          cacheCreationTokens: resultMsg.usage.cache_creation_input_tokens || 0,
          contextWindow: contextWindow,
        });
      }

      doneSent = true;
      activeStreams.delete(sessionId);
      streamMetadata.delete(sessionId);
      persistStreamState();
      sendTo(clientId, { type: "chat:done", cost: cost, duration: dur });
      invalidateDailySpendCache();
      var budgetConfig = loadConfig().costBudget;
      if (budgetConfig) {
        sendTo(clientId, {
          type: "budget:status",
          dailySpend: getDailySpend(),
          dailyLimit: budgetConfig.dailyLimit,
          enforcement: budgetConfig.enforcement,
        } as never);
      }
      broadcast({ type: "session:busy", sessionId, busy: false }, clientId);
      syncSessionToPeers(cwd, projectSlug, sessionId);

      void getSessionTitle(projectSlug, sessionId).then(function (currentTitle) {
        if (!isDefaultTitle(currentTitle)) return;
        var newTitle = generateSessionTitle(firstUserMessage);
        if (!newTitle) return;
        void renameSession(projectSlug, sessionId, newTitle).then(function (ok) {
          if (!ok) return;
          log.session("Auto-titled session %s: %s", sessionId, newTitle);
          void listSessions(projectSlug).then(function (sessions) {
            broadcast({ type: "session:list", projectSlug, sessions });
          });
        });
      });

      return;
    }
  }
}
