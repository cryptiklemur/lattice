import type { ClientMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { streamAnalyticsSections } from "../analytics/engine";

registerHandler("analytics", function (clientId: string, message: ClientMessage) {
  if (message.type === "analytics:request") {
    var msg = message as { type: string; requestId: string; scope: string; projectSlug?: string; sessionId?: string; period: string; forceRefresh?: boolean };

    streamAnalyticsSections(
      msg.scope as "global" | "project" | "session",
      msg.period as "24h" | "7d" | "30d" | "90d" | "all",
      msg.projectSlug,
      msg.sessionId,
      msg.forceRefresh,
      function (sectionName, sectionData) {
        sendTo(clientId, {
          type: "analytics:section",
          requestId: msg.requestId,
          section: sectionName,
          data: sectionData,
        });
      },
    ).then(function () {
      sendTo(clientId, {
        type: "analytics:complete",
        requestId: msg.requestId,
      });
    }).catch(function (err) {
      sendTo(clientId, {
        type: "analytics:error",
        scope: msg.scope,
        message: err instanceof Error ? err.message : "Analytics computation failed",
      });
    });

    return;
  }
});
