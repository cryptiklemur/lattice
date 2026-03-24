import type { ClientMessage, SettingsGetMessage, SettingsUpdateMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { loadConfig, saveConfig } from "../config";
import { addProject, removeProject } from "../project/registry";
import type { LatticeConfig } from "@lattice/shared";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readGlobalMcpServers, writeGlobalMcpServers, readGlobalSkills, readGlobalRules } from "../project/project-files";
import { sendBudgetStatus } from "./chat";
import { buildNodesMessage } from "./mesh";

function detectIdeProjectName(projectPath: string): string | undefined {
  try {
    var ideDir = join(projectPath, ".idea");
    if (!existsSync(ideDir)) return undefined;
    var ideNameFile = join(ideDir, ".name");
    if (existsSync(ideNameFile)) {
      var name = readFileSync(ideNameFile, "utf-8").trim();
      if (name) return name;
    }
    return projectPath.split("/").pop() || undefined;
  } catch {}
  return undefined;
}
import { loadOrCreateIdentity } from "../identity";

function loadGlobalClaudeMd(): string {
  var mdPath = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(mdPath)) {
    try {
      return readFileSync(mdPath, "utf-8");
    } catch {}
  }
  return "";
}

function saveGlobalClaudeMd(content: string): void {
  var claudeDir = join(homedir(), ".claude");
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }
  writeFileSync(join(claudeDir, "CLAUDE.md"), content, "utf-8");
}

function loadSpinnerVerbs(): string[] {
  var claudeSettingsPath = join(homedir(), ".claude", "settings.json");
  var defaultVerbs = ["Thinking", "Analyzing", "Processing", "Computing", "Evaluating", "Considering", "Examining", "Reviewing"];
  try {
    var claudeSettings = JSON.parse(readFileSync(claudeSettingsPath, "utf-8"));
    if (claudeSettings.spinnerVerbs) {
      if (claudeSettings.spinnerVerbs.mode === "replace") {
        return claudeSettings.spinnerVerbs.verbs || [];
      }
      return [...defaultVerbs, ...(claudeSettings.spinnerVerbs.verbs || [])];
    }
  } catch {}
  return defaultVerbs;
}

registerHandler("settings", function (clientId: string, message: ClientMessage) {
  if (message.type === "settings:get") {
    var config = loadConfig();
    var identity = loadOrCreateIdentity();
    var configWithClaudeMd = { ...config, claudeMd: loadGlobalClaudeMd() };
    sendTo(clientId, {
      type: "settings:data",
      config: configWithClaudeMd,
      mcpServers: readGlobalMcpServers() as Record<string, import("@lattice/shared").McpServerConfig>,
      globalSkills: readGlobalSkills(),
      globalRules: readGlobalRules(),
      spinnerVerbs: loadSpinnerVerbs(),
      wslDistro: process.env.WSL_DISTRO_NAME || undefined,
    });
    sendTo(clientId, {
      type: "projects:list",
      projects: config.projects.map(function (p: typeof config.projects[number]) {
        return { slug: p.slug, path: p.path, title: p.title, nodeId: identity.id, nodeName: config.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path) };
      }),
    });
    sendTo(clientId, { type: "mesh:nodes", nodes: buildNodesMessage() });
    sendBudgetStatus(clientId);
    return;
  }

  if (message.type === "settings:update") {
    var updateMsg = message as SettingsUpdateMessage;
    var current = loadConfig();

    var incoming = updateMsg.settings as Record<string, unknown>;
    if (typeof incoming.claudeMd === "string") {
      saveGlobalClaudeMd(incoming.claudeMd);
      delete incoming.claudeMd;
    }

    if (incoming.mcpServers != null) {
      writeGlobalMcpServers(incoming.mcpServers as Record<string, unknown>);
      delete incoming.mcpServers;
    }

    if (typeof incoming.removeProject === "string") {
      removeProject(incoming.removeProject as string);
      delete incoming.removeProject;
    }

    var incomingProjects = incoming.projects as Array<{ path: string; slug?: string; title: string; env?: Record<string, string> }> | undefined;
    if (incomingProjects && incomingProjects.length > 0) {
      for (var i = 0; i < incomingProjects.length; i++) {
        var proj = incomingProjects[i];
        addProject(proj.path, proj.title);
      }
    }

    var refreshed = loadConfig();
    var updated: LatticeConfig = {
      ...refreshed,
      ...(incoming as Partial<LatticeConfig>),
      globalEnv: {
        ...refreshed.globalEnv,
        ...((incoming.globalEnv as Record<string, string>) ?? {}),
      },
      projects: refreshed.projects,
    };
    saveConfig(updated);
    var updatedWithClaudeMd = { ...updated, claudeMd: loadGlobalClaudeMd() };
    sendTo(clientId, {
      type: "settings:data",
      config: updatedWithClaudeMd,
      mcpServers: readGlobalMcpServers() as Record<string, import("@lattice/shared").McpServerConfig>,
      globalSkills: readGlobalSkills(),
      globalRules: readGlobalRules(),
      spinnerVerbs: loadSpinnerVerbs(),
      wslDistro: process.env.WSL_DISTRO_NAME || undefined,
    });
    var updatedIdentity = loadOrCreateIdentity();
    broadcast({
      type: "projects:list",
      projects: updated.projects.map(function (p: typeof updated.projects[number]) {
        return { slug: p.slug, path: p.path, title: p.title, nodeId: updatedIdentity.id, nodeName: updated.name, isRemote: false };
      }),
    });
    sendBudgetStatus(clientId);
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
