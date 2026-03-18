import type { ChatSendMessage, ChatPermissionResponseMessage, ChatSetPermissionModeMessage, ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { startChatStream, getPendingPermission, deletePendingPermission, addAutoApprovedTool, setSessionPermissionOverride, getActiveStream } from "../project/sdk-bridge";

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
    sendTo(clientId, { type: "chat:error", message: "Cancel not yet implemented." });
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

      if (permMsg.alwaysAllow && permMsg.alwaysAllowScope === "project" && pending.suggestions) {
        pending.resolve({ behavior: "allow", updatedPermissions: pending.suggestions, toolUseID: pending.toolUseID });
      } else {
        pending.resolve({ behavior: "allow", toolUseID: pending.toolUseID });
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
