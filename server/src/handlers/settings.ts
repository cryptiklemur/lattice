import type { ClientMessage, SettingsGetMessage, SettingsUpdateMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig, saveConfig } from "../config";
import type { LatticeConfig } from "@lattice/shared";

registerHandler("settings", function (clientId: string, message: ClientMessage) {
  if (message.type === "settings:get") {
    var config = loadConfig();
    sendTo(clientId, { type: "settings:data", config });
    return;
  }

  if (message.type === "settings:update") {
    var updateMsg = message as SettingsUpdateMessage;
    var current = loadConfig();
    var updated: LatticeConfig = {
      ...current,
      ...(updateMsg.settings as Partial<LatticeConfig>),
      globalEnv: {
        ...current.globalEnv,
        ...(updateMsg.settings.globalEnv ?? {}),
      },
      projects: current.projects,
    };
    saveConfig(updated);
    sendTo(clientId, { type: "settings:data", config: updated });
    return;
  }

  if (message.type === "settings:restart") {
    console.log("[lattice] Restart requested by client");
    setTimeout(function () {
      process.exit(0);
    }, 200);
    return;
  }
});
