import type { ChatSendMessage, ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { findProjectSlugForSession } from "../project/session";
import { loadConfig } from "../config";
import { startChatStream } from "../project/sdk-bridge";

var activeSessionByClient = new Map<string, { projectSlug: string; sessionId: string }>();

export function setActiveSession(clientId: string, projectSlug: string, sessionId: string): void {
  activeSessionByClient.set(clientId, { projectSlug, sessionId });
}

export function clearActiveSession(clientId: string): void {
  activeSessionByClient.delete(clientId);
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
    });

    return;
  }

  if (message.type === "chat:cancel") {
    // TODO: implement cancel via Query.interrupt()
    return;
  }

  if (message.type === "chat:permission_response") {
    // TODO: implement interactive permission flow
    return;
  }
});
