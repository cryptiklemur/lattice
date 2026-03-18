import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKPartialAssistantMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { CanUseTool, PermissionMode, PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { sendTo } from "../ws/broadcast";
import { syncSessionToPeers } from "../mesh/session-sync";
import { resolveSkillContent } from "../handlers/skills";
import { guessContextWindow } from "./session";

interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  toolName: string;
  toolUseID: string;
  suggestions: PermissionUpdate[] | undefined;
  clientId: string;
  sessionId: string;
}

var pendingPermissions = new Map<string, PendingPermission>();
var autoApprovedTools = new Map<string, Set<string>>();
var sessionPermissionOverrides = new Map<string, PermissionMode>();

export interface ChatStreamOptions {
  projectSlug: string;
  sessionId: string;
  text: string;
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

export function getPendingPermission(requestId: string): PendingPermission | undefined {
  return pendingPermissions.get(requestId);
}

export function deletePendingPermission(requestId: string): void {
  pendingPermissions.delete(requestId);
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

export function startChatStream(options: ChatStreamOptions): void {
  var { projectSlug, sessionId, text, clientId, cwd, env, model, effort, isNewSession } = options;
  var startTime = Date.now();

  if (activeStreams.has(sessionId)) {
    sendTo(clientId, { type: "chat:error", message: "Session already has an active stream." });
    return;
  }

  var effectiveMode: PermissionMode = sessionPermissionOverrides.get(sessionId) || "default";
  sessionPermissionOverrides.delete(sessionId);

  var queryOptions: Parameters<typeof query>[0]["options"] = {
    cwd,
    permissionMode: effectiveMode,
  };

  queryOptions.canUseTool = function (toolName, input, options) {
    var approved = autoApprovedTools.get(sessionId);
    if (approved && approved.has(toolName)) {
      return Promise.resolve({ behavior: "allow", toolUseID: options.toolUseID } as PermissionResult);
    }

    var requestId = options.toolUseID;

    sendTo(clientId, {
      type: "chat:permission_request",
      requestId: requestId,
      tool: toolName,
      args: JSON.stringify(input),
      title: options.title,
      decisionReason: options.decisionReason,
    });

    return new Promise<PermissionResult>(function (resolve) {
      pendingPermissions.set(requestId, {
        resolve: resolve,
        toolName: toolName,
        toolUseID: options.toolUseID,
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

  if (effort) {
    queryOptions.effort = effort;
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

  var stream = query({ prompt: prompt, options: queryOptions });
  activeStreams.set(sessionId, stream);

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
      activeStreams.delete(sessionId);

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
        delete activeToolBlocks[stopIdx];
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
      sendTo(clientId, { type: "chat:done", cost: cost, duration: dur });
      syncSessionToPeers(cwd, projectSlug, sessionId);
      return;
    }
  }
}
