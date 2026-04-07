import type { ClientMessage, BrainstormSelectMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getActiveBrainstorm, getAnyActiveBrainstorm, writeBrainstormEvent, stopBrainstorm } from "../features/brainstorm";
import { getActiveProjectForClient } from "./fs";

registerHandler("brainstorm", function (clientId: string, message: ClientMessage) {
  if (message.type === "brainstorm:select") {
    var selectMsg = message as BrainstormSelectMessage;
    writeBrainstormEvent(selectMsg.sessionDir, {
      type: "click",
      choice: selectMsg.choice,
      text: selectMsg.text,
      timestamp: Date.now(),
    });
    return;
  }

  if (message.type === "brainstorm:stop") {
    var stopProjectSlug = getActiveProjectForClient(clientId);
    stopBrainstorm(stopProjectSlug || undefined);
    return;
  }

  if (message.type === "brainstorm:status_request") {
    var projectSlug = getActiveProjectForClient(clientId);
    var active = projectSlug ? getActiveBrainstorm(projectSlug) : getAnyActiveBrainstorm();
    if (active) {
      sendTo(clientId, {
        type: "brainstorm:status",
        active: true,
        html: active.html,
        filename: active.filename,
        sessionDir: active.sessionDir,
      });
    } else {
      sendTo(clientId, { type: "brainstorm:status", active: false });
    }
    return;
  }
});
