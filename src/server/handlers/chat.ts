import type { ChatSendMessage, ChatPermissionResponseMessage, ChatSetPermissionModeMessage, ChatPromptResponseMessage, ClientMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { startChatStream, getPendingPermission, deletePendingPermission, addAutoApprovedTool, setSessionPermissionOverride, getActiveStream, getSessionStream, buildPermissionRule, getPendingElicitation, resolveElicitation } from "../project/sdk-bridge";
import { getAttachments } from "./attachment";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDailySpend } from "../analytics/engine";
import { log } from "../logger";
import { findSpecBySession } from "../features/specs";

function formatSdkRule(rule: { toolName: string; ruleContent?: string }): string {
  if (!rule.ruleContent) return rule.toolName;
  if (rule.toolName === "Bash") {
    const firstWord = rule.ruleContent.split(/\s+/)[0].replace(/:.*$/, "");
    if (firstWord === "curl" || firstWord === "wget") {
      const urlMatch = rule.ruleContent.match(/https?:\/\/[^\s"']+/);
      if (urlMatch) {
        try {
          const parsed = new URL(urlMatch[0]);
          return rule.toolName + "(" + firstWord + ":" + parsed.hostname + ")";
        } catch {}
      }
    }
    return rule.toolName + "(" + firstWord + ":*)";
  }
  return rule.toolName + "(" + rule.ruleContent + ")";
}

function addProjectAllowRules(projectPath: string, suggestions: Array<{ type: string; rules?: Array<{ toolName: string; ruleContent?: string }>; directories?: string[]; behavior?: string }> | undefined, fallbackToolName: string, fallbackInput: Record<string, unknown>): void {
  const claudeDir = join(projectPath, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  let settings: Record<string, unknown> = {};
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
  const permissions = settings.permissions as Record<string, unknown>;
  if (!Array.isArray(permissions.allow)) {
    permissions.allow = [];
  }
  if (!Array.isArray(permissions.additionalDirectories)) {
    permissions.additionalDirectories = [];
  }
  const allowList = permissions.allow as string[];
  const additionalDirs = permissions.additionalDirectories as string[];

  if (suggestions && suggestions.length > 0) {
    for (let si = 0; si < suggestions.length; si++) {
      const suggestion = suggestions[si];
      if (suggestion.type === "addRules" && suggestion.behavior === "allow" && suggestion.rules) {
        for (let ri = 0; ri < suggestion.rules.length; ri++) {
          const rule = formatSdkRule(suggestion.rules[ri]);
          if (!allowList.includes(rule)) {
            allowList.push(rule);
          }
          if (suggestion.rules[ri].ruleContent) {
            const ruleDir = suggestion.rules[ri].ruleContent!.replace(/\/\*\*$/, "").replace(/^\//, "");
            if (ruleDir.startsWith("/") && !additionalDirs.includes(ruleDir)) {
              additionalDirs.push(ruleDir);
            }
          }
        }
      }
      if (suggestion.type === "addDirectories" && suggestion.directories) {
        for (let di = 0; di < suggestion.directories.length; di++) {
          if (!additionalDirs.includes(suggestion.directories[di])) {
            additionalDirs.push(suggestion.directories[di]);
          }
        }
      }
    }
  } else {
    const fallbackRule = buildPermissionRule(fallbackToolName, fallbackInput);
    if (!allowList.includes(fallbackRule)) {
      allowList.push(fallbackRule);
    }
  }

  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
}

const activeSessionByClient = new Map<string, { projectSlug: string; sessionId: string }>();
const pendingBudgetOverride = new Map<string, { projectSlug: string; sessionId: string; sendMsg: ChatSendMessage; env: Record<string, string> | undefined; cwd: string; }>();

export function sendBudgetStatus(clientId: string): void {
  const config = loadConfig();
  if (!config.costBudget) return;
  const dailySpend = getDailySpend();
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
    const pending = pendingBudgetOverride.get(clientId);
    if (!pending) return;
    pendingBudgetOverride.delete(clientId);

    const overrideAttachments = pending.sendMsg.attachmentIds
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
    const sendMsg = message as ChatSendMessage;
    const active = activeSessionByClient.get(clientId);

    if (!active) {
      sendTo(clientId, { type: "chat:error", message: "No active session. Activate a session first." });
      return;
    }

    const project = getProjectBySlug(active.projectSlug);
    if (!project) {
      sendTo(clientId, { type: "chat:error", message: `Project not found: ${active.projectSlug}` });
      return;
    }

    const config = loadConfig();
    const env = Object.assign({}, config.globalEnv, project.env);

    if (config.costBudget && config.costBudget.dailyLimit > 0) {
      const dailySpend = getDailySpend();
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

    const attachments = sendMsg.attachmentIds
      ? getAttachments(clientId, sendMsg.attachmentIds)
      : [];

    const linkedSpec = findSpecBySession(active.sessionId);

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
      systemPrompt: sendMsg.systemPrompt,
      specId: linkedSpec ? linkedSpec.id : undefined,
    });

    return;
  }

  if (message.type === "chat:cancel") {
    const active = activeSessionByClient.get(clientId);
    if (!active) {
      sendTo(clientId, { type: "chat:error", message: "No active session." });
      return;
    }
    const stream = getActiveStream(active.sessionId);
    if (!stream) {
      sendTo(clientId, { type: "chat:error", message: "No active stream to cancel." });
      return;
    }
    stream.interrupt().catch(function () {});
    return;
  }

  if (message.type === "chat:permission_response") {
    const permMsg = message as ChatPermissionResponseMessage;
    const pending = getPendingPermission(permMsg.requestId);
    if (!pending) {
      return;
    }

    const active = activeSessionByClient.get(clientId);

    if (permMsg.allow) {
      if (permMsg.alwaysAllow && permMsg.alwaysAllowScope === "session" && active) {
        addAutoApprovedTool(active.sessionId, pending.toolName);
      }

      if (permMsg.alwaysAllow && permMsg.alwaysAllowScope === "project" && active) {
        const project = getProjectBySlug(active.projectSlug);
        if (project) {
          addProjectAllowRules(project.path, pending.suggestions as any, pending.toolName, pending.input);
        }
        pending.resolve({ behavior: "allow", updatedInput: pending.input, toolUseID: pending.toolUseID });
      } else {
        pending.resolve({ behavior: "allow", updatedInput: pending.input, toolUseID: pending.toolUseID });
      }

      const resolvedStatus = permMsg.alwaysAllow ? "always_allowed" : "allowed";
      sendTo(clientId, { type: "chat:permission_resolved", requestId: permMsg.requestId, status: resolvedStatus });
    } else {
      pending.resolve({ behavior: "deny", message: "User denied this operation.", toolUseID: pending.toolUseID });
      sendTo(clientId, { type: "chat:permission_resolved", requestId: permMsg.requestId, status: "denied" });
    }

    deletePendingPermission(permMsg.requestId);
    return;
  }

  if (message.type === "chat:prompt_response") {
    const promptRespMsg = message as ChatPromptResponseMessage;
    const pendingPrompt = getPendingPermission(promptRespMsg.requestId);
    if (!pendingPrompt || pendingPrompt.promptType !== "question") {
      return;
    }

    const updatedInput = Object.assign({}, pendingPrompt.input, {
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

  if ((message as any).type === "chat:elicitation_response") {
    const elicitMsg = message as { type: string; requestId: string; action: "accept" | "decline"; content?: Record<string, unknown> };
    const pendingElicit = getPendingElicitation(elicitMsg.requestId);
    if (!pendingElicit) return;
    resolveElicitation(elicitMsg.requestId, {
      action: elicitMsg.action,
      content: elicitMsg.content || {},
    });
    return;
  }

  if ((message as any).type === "chat:rewind_preview") {
    const rewindMsg = message as { type: string; messageUuid: string };
    const activeForRewind = activeSessionByClient.get(clientId);
    if (!activeForRewind) return;

    const sessionStreamForRewind = getSessionStream(activeForRewind.sessionId);
    if (!sessionStreamForRewind) {
      sendTo(clientId, { type: "chat:rewind_preview_result", messageUuid: rewindMsg.messageUuid, canRewind: false, error: "No active stream for rewind" } as any);
      return;
    }

    void sessionStreamForRewind.queryInstance.rewindFiles(rewindMsg.messageUuid, { dryRun: true }).then(function (result) {
      sendTo(clientId, {
        type: "chat:rewind_preview_result",
        messageUuid: rewindMsg.messageUuid,
        canRewind: result.canRewind,
        error: result.error,
        filesChanged: (result.filesChanged || []).length,
        filesCreated: 0,
        filesDeleted: 0,
      } as any);
    }).catch(function (err) {
      sendTo(clientId, { type: "chat:rewind_preview_result", messageUuid: rewindMsg.messageUuid, canRewind: false, error: String(err) } as any);
    });
    return;
  }

  if ((message as any).type === "chat:rewind_execute") {
    const execRewindMsg = message as { type: string; messageUuid: string; mode: string };
    const activeForExec = activeSessionByClient.get(clientId);
    if (!activeForExec) return;

    const sessionStreamForExec = getSessionStream(activeForExec.sessionId);
    if (!sessionStreamForExec) {
      sendTo(clientId, { type: "chat:rewind_execute_result", messageUuid: execRewindMsg.messageUuid, success: false, error: "No active stream" } as any);
      return;
    }

    if (execRewindMsg.mode === "files" || execRewindMsg.mode === "both") {
      void sessionStreamForExec.queryInstance.rewindFiles(execRewindMsg.messageUuid, { dryRun: false }).then(function (result) {
        sendTo(clientId, {
          type: "chat:rewind_execute_result",
          messageUuid: execRewindMsg.messageUuid,
          success: result.canRewind,
          error: result.error,
        } as any);
      }).catch(function (err) {
        sendTo(clientId, { type: "chat:rewind_execute_result", messageUuid: execRewindMsg.messageUuid, success: false, error: String(err) } as any);
      });
    } else {
      sendTo(clientId, { type: "chat:rewind_execute_result", messageUuid: execRewindMsg.messageUuid, success: true } as any);
    }
    return;
  }

  if ((message as any).type === "chat:set_model") {
    const modelMsg = message as { type: string; model: string };
    const activeSession = activeSessionByClient.get(clientId);
    if (!activeSession) return;

    const sessionStream = getSessionStream(activeSession.sessionId);
    if (sessionStream) {
      void sessionStream.queryInstance.setModel(modelMsg.model === "default" ? undefined : modelMsg.model).catch(function (err) {
        log.chat("Failed to switch model: %O", err);
      });
      sessionStream.currentModel = modelMsg.model;
    }
    return;
  }

  if (message.type === "chat:set_permission_mode") {
    const modeMsg = message as ChatSetPermissionModeMessage;
    const activeSession = activeSessionByClient.get(clientId);
    if (!activeSession) {
      return;
    }

    const stream = getActiveStream(activeSession.sessionId);
    if (stream) {
      void stream.setPermissionMode(modeMsg.mode);
    } else {
      setSessionPermissionOverride(activeSession.sessionId, modeMsg.mode);
    }
    return;
  }
});
