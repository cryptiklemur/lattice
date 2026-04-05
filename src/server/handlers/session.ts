import type {
  ClientMessage,
  SessionActivateMessage,
  SessionCreateMessage,
  SessionDeleteMessage,
  SessionSummary,
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
  invalidateSessionCache,
  invalidateHistoryCache,
  getSessionHistoryPage,
  loadSessionHistory,
  renameSession,
  getSessionFileSizeBytes,
} from "../project/session";
import { getContextBreakdown } from "../project/context-breakdown";
import { setActiveSession, getActiveSession } from "./chat";
import { setActiveProject } from "./fs";
import { wasSessionInterrupted, clearInterruptedFlag } from "../project/sdk-bridge";
import { log } from "../logger";

registerHandler("session", function (clientId: string, message: ClientMessage) {
  if (message.type === "session:list_request") {
    var listReqMsg = message as SessionListRequestMessage;
    var offset = listReqMsg.offset || 0;
    var limit = listReqMsg.limit || 0;
    var t0 = Date.now();
    void listSessions(listReqMsg.projectSlug, { offset, limit }).then(function (result) {
      log.session("session:list_request for %s took %dms (%d sessions)", listReqMsg.projectSlug, Date.now() - t0, result.sessions.length);
      sendTo(clientId, {
        type: "session:list",
        projectSlug: listReqMsg.projectSlug,
        sessions: result.sessions,
        totalCount: result.totalCount,
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
    var allPromises = config.projects.map(function (p: typeof config.projects[number]) {
      return listSessions(p.slug, { limit: 20 });
    });
    void Promise.all(allPromises).then(function (results) {
      var merged: SessionSummary[] = [];
      for (var i = 0; i < results.length; i++) {
        for (var j = 0; j < results[i].sessions.length; j++) {
          merged.push(results[i].sessions[j]);
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

  if (message.type === "session:history_page") {
    var pageMsg = message as { type: "session:history_page"; sessionId: string; before: number; limit: number };
    var activeSession = getActiveSession(clientId);
    void getSessionHistoryPage(pageMsg.sessionId, pageMsg.before, pageMsg.limit, activeSession?.projectSlug).then(function (page) {
      sendTo(clientId, {
        type: "session:history_page_result",
        sessionId: pageMsg.sessionId,
        messages: page.messages,
        hasMore: page.hasMore,
        totalMessages: page.totalMessages,
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
    var activateMsg = message as SessionActivateMessage & { refresh?: boolean };
    setActiveSession(clientId, activateMsg.projectSlug, activateMsg.sessionId);
    setActiveProject(clientId, activateMsg.projectSlug);
    invalidateHistoryCache(activateMsg.sessionId);
    var fileSize = getSessionFileSizeBytes(activateMsg.projectSlug, activateMsg.sessionId);
    sendTo(clientId, { type: "session:loading_progress", sessionId: activateMsg.sessionId, fileSize });
    var activateT0 = Date.now();
    void loadSessionHistory(activateMsg.projectSlug, activateMsg.sessionId).then(function (historyResult) {
      log.session("session:activate history: %dms", Date.now() - activateT0);
      var title: string | null = null;
      var interrupted = wasSessionInterrupted(activateMsg.sessionId);
      if (interrupted) {
        clearInterruptedFlag(activateMsg.sessionId);
      }
      sendTo(clientId, {
        type: "session:history",
        projectSlug: activateMsg.projectSlug,
        sessionId: activateMsg.sessionId,
        messages: historyResult.messages,
        title: title,
        interrupted: interrupted || undefined,
        totalMessages: historyResult.totalMessages,
        hasMore: historyResult.hasMore,
      });
    }).catch(function (err) {
      log.session("Error sending session history: %O", err);
      sendTo(clientId, { type: "chat:error", message: "Failed to load session history" });
    });

    setTimeout(function () {
    void getSessionTitle(activateMsg.projectSlug, activateMsg.sessionId).then(function (sessionTitle) {
      if (sessionTitle) {
        sendTo(clientId, { type: "session:history", projectSlug: activateMsg.projectSlug, sessionId: activateMsg.sessionId, messages: [], title: sessionTitle });
      }
    }).catch(function () {});
    void Promise.all([
      getSessionUsage(activateMsg.projectSlug, activateMsg.sessionId).catch(function () { return null; }),
      getContextBreakdown(activateMsg.projectSlug, activateMsg.sessionId).catch(function () { return null; }),
    ]).then(function (results) {
      try {
        var usage = results[0];
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
        log.session("Error sending context usage: %O", err);
      }
      try {
        var breakdown = results[1];
        if (breakdown) {
          sendTo(clientId, {
            type: "chat:context_breakdown",
            segments: breakdown.segments,
            contextWindow: breakdown.contextWindow,
            autocompactAt: breakdown.autocompactAt,
          });
        }
      } catch (err) {
        log.session("Error sending context breakdown: %O", err);
      }
    }).catch(function (err) {
      log.session("Failed to activate session: %O", err);
      sendTo(clientId, { type: "chat:error", message: "Failed to activate session" });
    });
    }, 50);
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
        invalidateSessionCache(projectSlug);
        void listSessions(projectSlug, { limit: 40 }).then(function (result) {
          sendTo(clientId, {
            type: "session:list",
            projectSlug,
            sessions: result.sessions,
            totalCount: result.totalCount,
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
        invalidateSessionCache(deleteProjectSlug);
        void listSessions(deleteProjectSlug, { limit: 40 }).then(function (result) {
          sendTo(clientId, {
            type: "session:list",
            projectSlug: deleteProjectSlug,
            sessions: result.sessions,
            totalCount: result.totalCount,
          });
        });
      });
    });
  }

});
