import type { ChatSendMessage, ChatPermissionResponseMessage, ChatSetPermissionModeMessage, ChatPromptResponseMessage, ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { startChatStream, getPendingPermission, deletePendingPermission, addAutoApprovedTool, setSessionPermissionOverride, getActiveStream, buildPermissionRule, getPendingElicitation, resolveElicitation } from "../project/sdk-bridge";
import { getAttachments } from "./attachment";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDailySpend } from "../analytics/engine";

function formatSdkRule(rule: { toolName: string; ruleContent?: string }): string {
  if (!rule.ruleContent) return rule.toolName;
  if (rule.toolName === "Bash") {
    var firstWord = rule.ruleContent.split(/\s+/)[0].replace(/:.*$/, "");
    if (firstWord === "curl" || firstWord === "wget") {
      var urlMatch = rule.ruleContent.match(/https?:\/\/[^\s"']+/);
      if (urlMatch) {
        try {
          var parsed = new URL(urlMatch[0]);
          return rule.toolName + "(" + firstWord + ":" + parsed.hostname + ")";
        } catch {}
      }
    }
    return rule.toolName + "(" + firstWord + ":*)";
  }
  return rule.toolName + "(" + rule.ruleContent + ")";
}

function addProjectAllowRules(projectPath: string, suggestions: Array<{ type: string; rules?: Array<{ toolName: string; ruleContent?: string }>; directories?: string[]; behavior?: string }> | undefined, fallbackToolName: string, fallbackInput: Record<string, unknown>): void {
  var claudeDir = join(projectPath, ".claude");
  var settingsPath = join(claudeDir, "settings.json");

  var settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  if (!settings.permissions) {
    settings.permissions = {};
  }
  var permissions = settings.permissions as Record<string, unknown>;
  if (!Array.isArray(permissions.allow)) {
    permissions.allow = [];
  }
  if (!Array.isArray(permissions.additionalDirectories)) {
    permissions.additionalDirectories = [];
  }
  var allowList = permissions.allow as string[];
  var additionalDirs = permissions.additionalDirectories as string[];

  if (suggestions && suggestions.length > 0) {
    for (var si = 0; si < suggestions.length; si++) {
      var suggestion = suggestions[si];
      if (suggestion.type === "addRules" && suggestion.behavior === "allow" && suggestion.rules) {
        for (var ri = 0; ri < suggestion.rules.length; ri++) {
          var rule = formatSdkRule(suggestion.rules[ri]);
          if (!allowList.includes(rule)) {
            allowList.push(rule);
          }
          if (suggestion.rules[ri].ruleContent) {
            var ruleDir = suggestion.rules[ri].ruleContent!.replace(/\/\*\*$/, "").replace(/^\//, "");
            if (ruleDir.startsWith("/") && !additionalDirs.includes(ruleDir)) {
              additionalDirs.push(ruleDir);
            }
          }
        }
      }
      if (suggestion.type === "addDirectories" && suggestion.directories) {
        for (var di = 0; di < suggestion.directories.length; di++) {
          if (!additionalDirs.includes(suggestion.directories[di])) {
            additionalDirs.push(suggestion.directories[di]);
          }
        }
      }
    }
  } else {
    var fallbackRule = buildPermissionRule(fallbackToolName, fallbackInput);
    if (!allowList.includes(fallbackRule)) {
      allowList.push(fallbackRule);
    }
  }

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}

var activeSessionByClient = new Map<string, { projectSlug: string; sessionId: string }>();
var pendingBudgetOverride = new Map<string, { projectSlug: string; sessionId: string; sendMsg: ChatSendMessage; env: Record<string, string> | undefined; cwd: string; }>();

export function sendBudgetStatus(clientId: string): void {
  var config = loadConfig();
  if (!config.costBudget) return;
  var dailySpend = getDailySpend();
  sendTo(clientId, {
    type: "budget:status",
    dailySpend: dailySpend,
    dailyLimit: config.costBudget.dailyLimit,
    enforcement: config.costBudget.enforcement,
  } as never);
}

export function setActiveSession(clientId: string, projectSlug: string, sessionId: string): void {
  activeSessionByClient.set(clientId, { projectSlug, sessionId });
}

export function clearActiveSession(clientId: string): void {
  activeSessionByClient.delete(clientId);
}

export function getActiveSession(clientId: string): { projectSlug: string; sessionId: string } | undefined {
  return activeSessionByClient.get(clientId);
}

registerHandler("budget", function (clientId: string, message: ClientMessage) {
  if (message.type === "budget:override") {
    var pending = pendingBudgetOverride.get(clientId);
    if (!pending) return;
    pendingBudgetOverride.delete(clientId);

    var overrideAttachments = pending.sendMsg.attachmentIds
      ? getAttachments(clientId, pending.sendMsg.attachmentIds)
      : [];

    startChatStream({
      projectSlug: pending.projectSlug,
      sessionId: pending.sessionId,
      text: pending.sendMsg.text,
      attachments: overrideAttachments,
      clientId,
      cwd: pending.cwd,
      env: pending.env,
      model: pending.sendMsg.model,
      effort: pending.sendMsg.effort as "low" | "medium" | "high" | "max" | undefined,
    });
    return;
  }
});

registerHandler("chat", function (clientId: string, message: ClientMessage) {
  if (message.type === "chat:send") {
    var sendMsg = message as ChatSendMessage;
    var active = activeSessionByClient.get(clientId);

    if (!active) {
      sendTo(clientId, { type: "chat:error", message: "No active session. Activate a session first." });
      return;
    }

    var project = getProjectBySlug(active.projectSlug);
    if (!project) {
      sendTo(clientId, { type: "chat:error", message: `Project not found: ${active.projectSlug}` });
      return;
    }

    var config = loadConfig();
    var env = Object.assign({}, config.globalEnv, project.env);

    if (config.costBudget && config.costBudget.dailyLimit > 0) {
      var dailySpend = getDailySpend();
      if (dailySpend >= config.costBudget.dailyLimit) {
        if (config.costBudget.enforcement === "hard-block") {
          sendTo(clientId, { type: "chat:error", message: "Daily cost budget exceeded ($" + dailySpend.toFixed(2) + " / $" + config.costBudget.dailyLimit.toFixed(2) + "). Sending is blocked until tomorrow." });
          return;
        }
        if (config.costBudget.enforcement === "soft-block") {
          pendingBudgetOverride.set(clientId, {
            projectSlug: active.projectSlug,
            sessionId: active.sessionId,
            sendMsg: sendMsg,
            env: Object.keys(env).length > 0 ? env : undefined,
            cwd: project.path,
          });
          sendTo(clientId, {
            type: "budget:exceeded",
            dailySpend: dailySpend,
            dailyLimit: config.costBudget.dailyLimit,
          } as never);
          return;
        }
      }
    }

    var attachments = sendMsg.attachmentIds
      ? getAttachments(clientId, sendMsg.attachmentIds)
      : [];

    startChatStream({
      projectSlug: active.projectSlug,
      sessionId: active.sessionId,
      text: sendMsg.text,
      attachments,
      clientId,
      cwd: project.path,
      env: Object.keys(env).length > 0 ? env : undefined,
      model: sendMsg.model,
      effort: sendMsg.effort as "low" | "medium" | "high" | "max" | undefined,
    });

    return;
  }

  if (message.type === "chat:cancel") {
    var active = activeSessionByClient.get(clientId);
    if (!active) {
      sendTo(clientId, { type: "chat:error", message: "No active session." });
      return;
    }
    var stream = getActiveStream(active.sessionId);
    if (!stream) {
      sendTo(clientId, { type: "chat:error", message: "No active stream to cancel." });
      return;
    }
    stream.interrupt().catch(function () {});
    return;
  }

  if (message.type === "chat:permission_response") {
    var permMsg = message as ChatPermissionResponseMessage;
    var pending = getPendingPermission(permMsg.requestId);
    if (!pending) {
      return;
    }

    var active = activeSessionByClient.get(clientId);

    if (permMsg.allow) {
      if (permMsg.alwaysAllow && permMsg.alwaysAllowScope === "session" && active) {
        addAutoApprovedTool(active.sessionId, pending.toolName);
      }

      if (permMsg.alwaysAllow && permMsg.alwaysAllowScope === "project" && active) {
        var project = getProjectBySlug(active.projectSlug);
        if (project) {
          addProjectAllowRules(project.path, pending.suggestions as any, pending.toolName, pending.input);
        }
        pending.resolve({ behavior: "allow", updatedInput: pending.input, toolUseID: pending.toolUseID });
      } else {
        pending.resolve({ behavior: "allow", updatedInput: pending.input, toolUseID: pending.toolUseID });
      }

      var resolvedStatus = permMsg.alwaysAllow ? "always_allowed" : "allowed";
      sendTo(clientId, { type: "chat:permission_resolved", requestId: permMsg.requestId, status: resolvedStatus });
    } else {
      pending.resolve({ behavior: "deny", message: "User denied this operation.", toolUseID: pending.toolUseID });
      sendTo(clientId, { type: "chat:permission_resolved", requestId: permMsg.requestId, status: "denied" });
    }

    deletePendingPermission(permMsg.requestId);
    return;
  }

  if (message.type === "chat:prompt_response") {
    var promptRespMsg = message as ChatPromptResponseMessage;
    var pendingPrompt = getPendingPermission(promptRespMsg.requestId);
    if (!pendingPrompt || pendingPrompt.promptType !== "question") {
      return;
    }

    var updatedInput = Object.assign({}, pendingPrompt.input, {
      answers: promptRespMsg.answers,
    });
    if (promptRespMsg.annotations) {
      (updatedInput as Record<string, unknown>).annotations = promptRespMsg.annotations;
    }

    pendingPrompt.resolve({
      behavior: "allow",
      updatedInput: updatedInput,
      toolUseID: pendingPrompt.toolUseID,
    });

    sendTo(clientId, { type: "chat:prompt_resolved", requestId: promptRespMsg.requestId });
    deletePendingPermission(promptRespMsg.requestId);
    return;
  }

  if (message.type === "chat:elicitation_response") {
    var elicitMsg = message as { type: string; requestId: string; action: "accept" | "decline"; content?: Record<string, unknown> };
    var pendingElicit = getPendingElicitation(elicitMsg.requestId);
    if (!pendingElicit) return;
    resolveElicitation(elicitMsg.requestId, {
      action: elicitMsg.action,
      content: elicitMsg.content || {},
    });
    return;
  }

  if (message.type === "chat:set_permission_mode") {
    var modeMsg = message as ChatSetPermissionModeMessage;
    var activeSession = activeSessionByClient.get(clientId);
    if (!activeSession) {
      return;
    }

    var stream = getActiveStream(activeSession.sessionId);
    if (stream) {
      void stream.setPermissionMode(modeMsg.mode);
    } else {
      setSessionPermissionOverride(activeSession.sessionId, modeMsg.mode);
    }
    return;
  }
});
