import type { ClientMessage, LoopStartMessage, LoopStopMessage, LoopStatusRequestMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { startLoop, stopLoop, getLoopStatus } from "../features/ralph-loop";

registerHandler("loop", function (clientId: string, message: ClientMessage) {
  if (message.type === "loop:start") {
    var startMsg = message as LoopStartMessage;
    var loop = startLoop(startMsg.projectSlug);
    if (!loop) {
      sendTo(clientId, { type: "chat:error", message: "No PROMPT.md found in .claude/loops/ for this project" });
      return;
    }
    sendTo(clientId, { type: "loop:started", loop });
    return;
  }

  if (message.type === "loop:stop") {
    var stopMsg = message as LoopStopMessage;
    var stopped = stopLoop(stopMsg.loopId);
    if (!stopped) {
      sendTo(clientId, { type: "chat:error", message: "Loop not found or not running" });
    }
    return;
  }

  if (message.type === "loop:status") {
    var statusMsg = message as LoopStatusRequestMessage;
    var status = getLoopStatus(statusMsg.loopId);
    if (!status) {
      sendTo(clientId, { type: "chat:error", message: "Loop not found" });
      return;
    }
    sendTo(clientId, { type: "loop:status_update", loop: status });
    return;
  }
});
