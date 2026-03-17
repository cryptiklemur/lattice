import type { ClientMessage, SettingsGetMessage, SettingsUpdateMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { loadConfig, saveConfig } from "../config";
import { addProject } from "../project/registry";
import type { LatticeConfig } from "@lattice/shared";

registerHandler("settings", function (clientId: string, message: ClientMessage) {
  if (message.type === "settings:get") {
    var config = loadConfig();
    sendTo(clientId, { type: "settings:data", config });
    sendTo(clientId, {
      type: "projects:list",
      projects: config.projects.map(function (p) {
        return { slug: p.slug, path: p.path, title: p.title, nodeId: "local", nodeName: config.name, isRemote: false };
      }),
    });
    return;
  }

  if (message.type === "settings:update") {
    var updateMsg = message as SettingsUpdateMessage;
    var current = loadConfig();

    var incomingProjects = (updateMsg.settings as any).projects as Array<{ path: string; slug?: string; title: string; env?: Record<string, string> }> | undefined;
    if (incomingProjects && incomingProjects.length > 0) {
      for (var i = 0; i < incomingProjects.length; i++) {
        var proj = incomingProjects[i];
        addProject(proj.path, proj.title);
      }
    }

    var refreshed = loadConfig();
    var updated: LatticeConfig = {
      ...refreshed,
      ...(updateMsg.settings as Partial<LatticeConfig>),
      globalEnv: {
        ...refreshed.globalEnv,
        ...(updateMsg.settings.globalEnv ?? {}),
      },
      projects: refreshed.projects,
    };
    saveConfig(updated);
    sendTo(clientId, { type: "settings:data", config: updated });
    broadcast({
      type: "projects:list",
      projects: updated.projects.map(function (p) {
        return { slug: p.slug, path: p.path, title: p.title, nodeId: "local", nodeName: updated.name, isRemote: false };
      }),
    });
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
