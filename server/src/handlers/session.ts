import type {
  ClientMessage,
  SessionActivateMessage,
  SessionCreateMessage,
  SessionDeleteMessage,
  SessionListRequestMessage,
  SessionPreviewRequestMessage,
  SessionRenameMessage,
} from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig } from "../config";
import {
  createSession,
  deleteSession,
  findProjectSlugForSession,
  getSessionPreview,
  getSessionTitle,
  getSessionUsage,
  listSessions,
  loadSessionHistory,
  renameSession,
} from "../project/session";
import { getContextBreakdown } from "../project/context-breakdown";
import { setActiveSession } from "./chat";
import { setActiveProject } from "./fs";
import { wasSessionInterrupted, clearInterruptedFlag, isSessionBusy, watchSessionLock, stopExternalSession } from "../project/sdk-bridge";

registerHandler("session", function (clientId: string, message: ClientMessage) {
  if (message.type === "session:list_request") {
    var listReqMsg = message as SessionListRequestMessage;
    void listSessions(listReqMsg.projectSlug).then(function (sessions) {
      var offset = listReqMsg.offset || 0;
      var limit = listReqMsg.limit || 0;
      var totalCount = sessions.length;
      var sliced = limit > 0 ? sessions.slice(offset, offset + limit) : sessions;
      sendTo(clientId, {
        type: "session:list",
        projectSlug: listReqMsg.projectSlug,
        sessions: sliced,
        totalCount,
        offset,
      });
    });
    return;
  }

  if (message.type === "session:preview_request") {
    var previewMsg = message as SessionPreviewRequestMessage;
    void getSessionPreview(previewMsg.projectSlug, previewMsg.sessionId).then(function (preview) {
      if (preview) {
        sendTo(clientId, { type: "session:preview", sessionId: previewMsg.sessionId, preview });
      }
    });
    return;
  }

  if (message.type === "session:list_all_request") {
    var config = loadConfig();
    var allPromises = config.projects.map(function (p) {
      return listSessions(p.slug);
    });
    void Promise.all(allPromises).then(function (results) {
      var merged: typeof results[0] = [];
      for (var i = 0; i < results.length; i++) {
        for (var j = 0; j < results[i].length; j++) {
          merged.push(results[i][j]);
        }
      }
      merged.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      sendTo(clientId, {
        type: "session:list_all",
        sessions: merged.slice(0, 20),
      });
    });
    return;
  }

  if (message.type === "session:create") {
    var createMsg = message as SessionCreateMessage;
    var session = createSession(createMsg.projectSlug);
    sendTo(clientId, { type: "session:created", session });
    return;
  }

  if (message.type === "session:activate") {
    var activateMsg = message as SessionActivateMessage;
    setActiveSession(clientId, activateMsg.projectSlug, activateMsg.sessionId);
    setActiveProject(clientId, activateMsg.projectSlug);
    watchSessionLock(activateMsg.sessionId);
    void Promise.all([
      loadSessionHistory(activateMsg.projectSlug, activateMsg.sessionId).catch(function (err) {
        console.error("[lattice] Failed to load session history:", err);
        return null;
      }),
      getSessionTitle(activateMsg.projectSlug, activateMsg.sessionId).catch(function (err) {
        console.error("[lattice] Failed to load session title:", err);
        return null;
      }),
      getSessionUsage(activateMsg.projectSlug, activateMsg.sessionId).catch(function (err) {
        console.error("[lattice] Failed to load session usage:", err);
        return null;
      }),
      getContextBreakdown(activateMsg.projectSlug, activateMsg.sessionId).catch(function (err) {
        console.error("[lattice] Failed to load context breakdown:", err);
        return null;
      }),
    ]).then(function (results) {
      try {
        var interrupted = wasSessionInterrupted(activateMsg.sessionId);
        if (interrupted) {
          clearInterruptedFlag(activateMsg.sessionId);
        }
        var busy = isSessionBusy(activateMsg.sessionId);
        sendTo(clientId, {
          type: "session:history",
          projectSlug: activateMsg.projectSlug,
          sessionId: activateMsg.sessionId,
          messages: results[0] || [],
          title: results[1],
          interrupted: interrupted || undefined,
          busy: busy || undefined,
        });
      } catch (err) {
        console.error("[lattice] Error sending session history:", err);
        sendTo(clientId, { type: "chat:error", message: "Failed to load session history" });
      }
      try {
        var usage = results[2];
        if (usage) {
          sendTo(clientId, {
            type: "chat:context_usage",
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cacheReadTokens: usage.cacheReadTokens,
            cacheCreationTokens: usage.cacheCreationTokens,
            contextWindow: usage.contextWindow,
          });
        }
      } catch (err) {
        console.error("[lattice] Error sending context usage:", err);
      }
      try {
        var breakdown = results[3];
        if (breakdown) {
          sendTo(clientId, {
            type: "chat:context_breakdown",
            segments: breakdown.segments,
            contextWindow: breakdown.contextWindow,
            autocompactAt: breakdown.autocompactAt,
          });
        }
      } catch (err) {
        console.error("[lattice] Error sending context breakdown:", err);
      }
    }).catch(function (err) {
      console.error("[lattice] Failed to activate session:", err);
      sendTo(clientId, { type: "chat:error", message: "Failed to activate session" });
    });
    return;
  }

  if (message.type === "session:rename") {
    var renameMsg = message as SessionRenameMessage;
    void findProjectSlugForSession(renameMsg.sessionId).then(function (projectSlug) {
      if (!projectSlug) {
        sendTo(clientId, { type: "chat:error", message: "Session not found" });
        return;
      }
      void renameSession(projectSlug, renameMsg.sessionId, renameMsg.title).then(function () {
        void listSessions(projectSlug).then(function (sessions) {
          sendTo(clientId, {
            type: "session:list",
            projectSlug,
            sessions,
          });
        });
      });
    });
    return;
  }

  if (message.type === "session:delete") {
    var deleteMsg = message as SessionDeleteMessage;
    void findProjectSlugForSession(deleteMsg.sessionId).then(function (deleteProjectSlug) {
      if (!deleteProjectSlug) {
        sendTo(clientId, { type: "chat:error", message: "Session not found" });
        return;
      }
      void deleteSession(deleteProjectSlug, deleteMsg.sessionId).then(function () {
        void listSessions(deleteProjectSlug).then(function (sessions) {
          sendTo(clientId, {
            type: "session:list",
            projectSlug: deleteProjectSlug,
            sessions,
          });
        });
      });
    });
  }

  if (message.type === "session:stop_external") {
    var stopMsg = message as { type: string; sessionId: string };
    var stopped = stopExternalSession(stopMsg.sessionId);
    if (stopped) {
      console.log("[lattice] Sent SIGINT to external CLI process for session " + stopMsg.sessionId);
    } else {
      sendTo(clientId, { type: "chat:error", message: "No external process found for this session." });
    }
  }
});
