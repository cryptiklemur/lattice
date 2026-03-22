import type { ChatSendMessage, ChatPermissionResponseMessage, ChatSetPermissionModeMessage, ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { startChatStream, getPendingPermission, deletePendingPermission, addAutoApprovedTool, setSessionPermissionOverride, getActiveStream, buildPermissionRule } from "../project/sdk-bridge";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

export function setActiveSession(clientId: string, projectSlug: string, sessionId: string): void {
  activeSessionByClient.set(clientId, { projectSlug, sessionId });
}

export function clearActiveSession(clientId: string): void {
  activeSessionByClient.delete(clientId);
}

export function getActiveSession(clientId: string): { projectSlug: string; sessionId: string } | undefined {
  return activeSessionByClient.get(clientId);
}

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

    startChatStream({
      projectSlug: active.projectSlug,
      sessionId: active.sessionId,
      text: sendMsg.text,
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
    console.log("[chat] chat:cancel - clientId:", clientId, "active:", active ? active.sessionId : "NONE");
    if (!active) {
      sendTo(clientId, { type: "chat:error", message: "No active session." });
      return;
    }
    var stream = getActiveStream(active.sessionId);
    console.log("[chat] chat:cancel - stream found:", !!stream);
    if (!stream) {
      sendTo(clientId, { type: "chat:error", message: "No active stream to cancel." });
      return;
    }
    console.log("[chat] Interrupting stream for session:", active.sessionId);
    stream.interrupt().then(function () {
      console.log("[chat] Stream interrupted successfully");
    }).catch(function (err: unknown) {
      console.error("[chat] Stream interrupt failed:", err instanceof Error ? err.message : String(err));
    });
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
