import type { ClientMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getAnalytics } from "../analytics/engine";

registerHandler("analytics", function (clientId: string, message: ClientMessage) {
  if (message.type === "analytics:request") {
    var msg = message as { type: string; requestId: string; scope: string; projectSlug?: string; sessionId?: string; period: string; forceRefresh?: boolean };

    getAnalytics(
      msg.scope as "global" | "project" | "session",
      msg.period as "24h" | "7d" | "30d" | "90d" | "all",
      msg.projectSlug,
      msg.sessionId,
      msg.forceRefresh
    ).then(function (data) {
      sendTo(clientId, {
        type: "analytics:data",
        requestId: msg.requestId,
        scope: msg.scope,
        period: msg.period,
        data: data,
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
