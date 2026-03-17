import type {
  ClientMessage,
  SessionActivateMessage,
  SessionCreateMessage,
  SessionDeleteMessage,
  SessionRenameMessage,
} from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import {
  createSession,
  deleteSession,
  findProjectSlugForSession,
  listSessions,
  loadSessionHistory,
  renameSession,
} from "../project/session";
import { setActiveSession } from "./chat";
import { setActiveProject } from "./fs";

registerHandler("session", function (clientId: string, message: ClientMessage) {
  if (message.type === "session:create") {
    var createMsg = message as SessionCreateMessage;
    var session = createSession(createMsg.projectSlug);
    sendTo(clientId, { type: "session:created", session });
    sendTo(clientId, {
      type: "session:list",
      projectSlug: createMsg.projectSlug,
      sessions: listSessions(createMsg.projectSlug),
    });
    return;
  }

  if (message.type === "session:activate") {
    var activateMsg = message as SessionActivateMessage;
    setActiveSession(clientId, activateMsg.projectSlug, activateMsg.sessionId);
    setActiveProject(clientId, activateMsg.projectSlug);
    var history = loadSessionHistory(activateMsg.projectSlug, activateMsg.sessionId);
    sendTo(clientId, { type: "session:history", messages: history });
    return;
  }

  if (message.type === "session:rename") {
    var renameMsg = message as SessionRenameMessage;
    var projectSlug = findProjectSlugForSession(renameMsg.sessionId);
    if (!projectSlug) {
      return;
    }
    renameSession(projectSlug, renameMsg.sessionId, renameMsg.title);
    sendTo(clientId, {
      type: "session:list",
      projectSlug,
      sessions: listSessions(projectSlug),
    });
    return;
  }

  if (message.type === "session:delete") {
    var deleteMsg = message as SessionDeleteMessage;
    var deleteProjectSlug = findProjectSlugForSession(deleteMsg.sessionId);
    if (!deleteProjectSlug) {
      return;
    }
    deleteSession(deleteProjectSlug, deleteMsg.sessionId);
    sendTo(clientId, {
      type: "session:list",
      projectSlug: deleteProjectSlug,
      sessions: listSessions(deleteProjectSlug),
    });
  }
});
