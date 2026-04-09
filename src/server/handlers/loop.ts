import type { ClientMessage, LoopStartMessage, LoopStopMessage, LoopStatusRequestMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { startLoop, stopLoop, getLoopStatus } from "../features/ralph-loop";

registerHandler("loop", function (clientId: string, message: ClientMessage) {
  if (message.type === "loop:start") {
    const startMsg = message as LoopStartMessage;
    const loop = startLoop(startMsg.projectSlug);
    if (!loop) {
      sendTo(clientId, { type: "chat:error", message: "No PROMPT.md found in .claude/loops/ for this project" });
      return;
    }
    sendTo(clientId, { type: "loop:started", loop });
    return;
  }

  if (message.type === "loop:stop") {
    const stopMsg = message as LoopStopMessage;
    const stopped = stopLoop(stopMsg.loopId);
    if (!stopped) {
      sendTo(clientId, { type: "chat:error", message: "Loop not found or not running" });
    }
    return;
  }

  if (message.type === "loop:status") {
    const statusMsg = message as LoopStatusRequestMessage;
    const status = getLoopStatus(statusMsg.loopId);
    if (!status) {
      sendTo(clientId, { type: "chat:error", message: "Loop not found" });
      return;
    }
    sendTo(clientId, { type: "loop:status_update", loop: status });
    return;
  }
});
