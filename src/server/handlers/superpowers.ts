import type { ClientMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { isSuperpowersInstalled, getSuperpowersVersion, getAvailableSkills } from "../features/superpowers";

registerHandler("superpowers", function (clientId: string, message: ClientMessage) {
  if (message.type === "superpowers:status_request") {
    sendTo(clientId, {
      type: "superpowers:status",
      installed: isSuperpowersInstalled(),
      version: getSuperpowersVersion(),
      skillsAvailable: getAvailableSkills(),
    });
  }
});
