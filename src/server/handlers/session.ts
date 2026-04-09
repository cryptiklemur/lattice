import type {
  ClientMessage,
  SessionActivateMessage,
  SessionCreateMessage,
  SessionDeleteMessage,
  SessionSummary,
  SessionListRequestMessage,
  SessionPreviewRequestMessage,
  SessionRenameMessage,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast, broadcastToProject } from "../ws/broadcast";
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
  updateSessionInIndex,
  removeSessionFromIndex,
} from "../project/session";
import { getContextBreakdown } from "../project/context-breakdown";
import { setActiveSession, getActiveSession } from "./chat";
import { setActiveProject } from "./fs";
import { wasSessionInterrupted, clearInterruptedFlag } from "../project/sdk-bridge";
import { log } from "../logger";

registerHandler("session", async function (clientId: string, message: ClientMessage) {
  if (message.type === "session:list_request") {
    const listReqMsg = message as SessionListRequestMessage;
    const offset = listReqMsg.offset || 0;
    const limit = listReqMsg.limit || 0;
    const t0 = Date.now();
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
    const previewMsg = message as SessionPreviewRequestMessage;
    void getSessionPreview(previewMsg.projectSlug, previewMsg.sessionId).then(function (preview) {
      if (preview) {
        sendTo(clientId, { type: "session:preview", sessionId: previewMsg.sessionId, preview });
      }
    });
    return;
  }

  if (message.type === "session:list_all_request") {
    const config = loadConfig();
    const allPromises = config.projects.map(function (p: typeof config.projects[number]) {
      return listSessions(p.slug, { limit: 20 });
    });
    void Promise.all(allPromises).then(function (results) {
      const merged: SessionSummary[] = [];
      for (let i = 0; i < results.length; i++) {
        for (let j = 0; j < results[i].sessions.length; j++) {
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
    const pageMsg = message as { type: "session:history_page"; sessionId: string; before?: number; loaded?: number; limit: number };
    const activeSession = getActiveSession(clientId);
    void getSessionHistoryPage(pageMsg.sessionId, pageMsg.before, pageMsg.limit, activeSession?.projectSlug, pageMsg.loaded).then(function (page) {
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
    const createMsg = message as SessionCreateMessage;
    const session = createSession(createMsg.projectSlug, createMsg.sessionType);
    updateSessionInIndex(createMsg.projectSlug, session);
    sendTo(clientId, { type: "session:created", session });
    broadcastToProject(createMsg.projectSlug, {
      type: "session:list",
      projectSlug: createMsg.projectSlug,
      sessions: [session],
      totalCount: undefined,
      offset: 0,
    } as any);
    return;
  }

  if (message.type === "session:activate") {
    const activateMsg = message as SessionActivateMessage & { refresh?: boolean };
    setActiveSession(clientId, activateMsg.projectSlug, activateMsg.sessionId);
    setActiveProject(clientId, activateMsg.projectSlug);
    invalidateHistoryCache(activateMsg.sessionId);
    const fileSize = await getSessionFileSizeBytes(activateMsg.projectSlug, activateMsg.sessionId);
    sendTo(clientId, { type: "session:loading_progress", sessionId: activateMsg.sessionId, fileSize });
    const activateT0 = Date.now();
    void Promise.all([
      loadSessionHistory(activateMsg.projectSlug, activateMsg.sessionId),
      getSessionTitle(activateMsg.projectSlug, activateMsg.sessionId).catch(function () { return null; }),
      getSessionUsage(activateMsg.projectSlug, activateMsg.sessionId).catch(function () { return null; }),
      getContextBreakdown(activateMsg.projectSlug, activateMsg.sessionId).catch(function () { return null; }),
    ]).then(function (results) {
      const historyResult = results[0];
      const sessionTitle = results[1];
      const usage = results[2];
      const breakdown = results[3];

      log.session("session:activate: %dms", Date.now() - activateT0);

      const interrupted = wasSessionInterrupted(activateMsg.sessionId);
      if (interrupted) {
        clearInterruptedFlag(activateMsg.sessionId);
      }

      sendTo(clientId, {
        type: "session:history",
        projectSlug: activateMsg.projectSlug,
        sessionId: activateMsg.sessionId,
        messages: historyResult.messages,
        title: sessionTitle,
        interrupted: interrupted || undefined,
        totalMessages: historyResult.totalMessages,
        hasMore: historyResult.hasMore,
      });

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

      if (breakdown) {
        sendTo(clientId, {
          type: "chat:context_breakdown",
          segments: breakdown.segments,
          contextWindow: breakdown.contextWindow,
          autocompactAt: breakdown.autocompactAt,
        });
      }
    }).catch(function (err) {
      log.session("Failed to activate session: %O", err);
      sendTo(clientId, { type: "chat:error", message: "Failed to load session" });
    });
    return;
  }

  if (message.type === "session:rename") {
    const renameMsg = message as SessionRenameMessage;
    void findProjectSlugForSession(renameMsg.sessionId).then(function (projectSlug) {
      if (!projectSlug) {
        sendTo(clientId, { type: "chat:error", message: "Session not found" });
        return;
      }
      void renameSession(projectSlug, renameMsg.sessionId, renameMsg.title).then(function () {
        invalidateSessionCache(projectSlug);
        void listSessions(projectSlug, { limit: 40 }).then(function (result) {
          broadcastToProject(projectSlug, {
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
    const deleteMsg = message as SessionDeleteMessage;
    void findProjectSlugForSession(deleteMsg.sessionId).then(function (deleteProjectSlug) {
      if (!deleteProjectSlug) {
        sendTo(clientId, { type: "chat:error", message: "Session not found" });
        return;
      }
      void deleteSession(deleteProjectSlug, deleteMsg.sessionId).then(function () {
        removeSessionFromIndex(deleteProjectSlug, deleteMsg.sessionId);
        void listSessions(deleteProjectSlug, { limit: 40 }).then(function (result) {
          broadcastToProject(deleteProjectSlug, {
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
