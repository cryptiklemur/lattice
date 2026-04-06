import type { ClientMessage, ProjectSettingsGetMessage, ProjectSettingsUpdateMessage, ProjectSettings, McpServerConfig } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig, saveConfig, invalidateConfigCache } from "../config";
import { getProjectBySlug } from "../project/registry";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  readProjectClaudeMd,
  writeProjectClaudeMd,
  readProjectClaudeSettings,
  mergeProjectClaudeSettings,
  readProjectRules,
  writeProjectRules,
  readProjectMcpServers,
  writeProjectMcpServers,
  readProjectSkills,
  readGlobalRules,
  readGlobalPermissions,
  readGlobalMcpServers,
  readGlobalSkills,
} from "../project/project-files";

function loadGlobalClaudeMd(): string {
  var mdPath = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(mdPath)) {
    try {
      return readFileSync(mdPath, "utf-8");
    } catch {}
  }
  return "";
}

function buildProjectSettings(projectSlug: string): ProjectSettings | { error: string } {
  var project = getProjectBySlug(projectSlug);
  if (!project) {
    return { error: "Project not found" };
  }
  if (!existsSync(project.path)) {
    return { error: "Project path does not exist on disk" };
  }

  var claudeMd = readProjectClaudeMd(project.path);
  var claudeSettings = readProjectClaudeSettings(project.path);
  var lattice = (claudeSettings.lattice ?? {}) as Record<string, unknown>;
  var permissions = (claudeSettings.permissions ?? { allow: [], deny: [] }) as { allow: string[]; deny: string[] };
  var rules = readProjectRules(project.path);
  var mcpServers = readProjectMcpServers(project.path) as Record<string, McpServerConfig>;
  var skills = readProjectSkills(project.path);

  var config = loadConfig();

  var settings: ProjectSettings = {
    title: project.title,
    path: project.path,
    icon: (project as Record<string, unknown>).icon as ProjectSettings["icon"],
    claudeMd,
    defaultModel: (lattice.defaultModel as string) || undefined,
    defaultEffort: (lattice.defaultEffort as string) || undefined,
    thinking: lattice.thinking as ProjectSettings["thinking"],
    permissionMode: (lattice.defaultPermissionMode as string) || undefined,
    permissions: {
      allow: Array.isArray(permissions.allow) ? permissions.allow : [],
      deny: Array.isArray(permissions.deny) ? permissions.deny : [],
    },
    env: project.env ?? {},
    mcpServers,
    rules,
    skills,
    disabledPlugins: Array.isArray(lattice.disabledPlugins) ? lattice.disabledPlugins as string[] : [],
    global: {
      claudeMd: loadGlobalClaudeMd(),
      defaultModel: "",
      defaultEffort: "",
      env: config.globalEnv ?? {},
      permissions: readGlobalPermissions(),
      rules: readGlobalRules(),
      mcpServers: readGlobalMcpServers() as Record<string, McpServerConfig>,
      skills: readGlobalSkills(),
    },
  };

  return settings;
}

registerHandler("project-settings", function (clientId: string, message: ClientMessage) {
  if (message.type === "project-settings:get") {
    var getMsg = message as ProjectSettingsGetMessage;
    var result = buildProjectSettings(getMsg.projectSlug);
    if ("error" in result) {
      sendTo(clientId, { type: "project-settings:error", projectSlug: getMsg.projectSlug, message: result.error });
      return;
    }
    sendTo(clientId, { type: "project-settings:data", projectSlug: getMsg.projectSlug, settings: result });
    return;
  }

  if (message.type === "project-settings:update") {
    var updateMsg = message as ProjectSettingsUpdateMessage;
    var projectSlug = updateMsg.projectSlug;
    var section = updateMsg.section;
    var settings = updateMsg.settings;

    var project = getProjectBySlug(projectSlug);
    if (!project) {
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: "Project not found" });
      return;
    }
    if (!existsSync(project.path)) {
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: "Project path does not exist on disk" });
      return;
    }

    try {
      if (section === "general") {
        invalidateConfigCache();
        var config = loadConfig();
        var idx = config.projects.findIndex(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
        if (idx !== -1) {
          if (typeof settings.title === "string") {
            config.projects[idx].title = settings.title;
          }
          if (settings.icon !== undefined) {
            config.projects[idx].icon = settings.icon as ProjectSettings["icon"];
          }
          saveConfig(config);
        }
      } else if (section === "claude") {
        if (typeof settings.claudeMd === "string") {
          writeProjectClaudeMd(project.path, settings.claudeMd);
        }
        var latticeUpdates: Record<string, unknown> = {};
        if (settings.defaultModel !== undefined) latticeUpdates.defaultModel = settings.defaultModel;
        if (settings.defaultEffort !== undefined) latticeUpdates.defaultEffort = settings.defaultEffort;
        if (settings.thinking !== undefined) latticeUpdates.thinking = settings.thinking;
        if (settings.defaultPermissionMode !== undefined) latticeUpdates.defaultPermissionMode = settings.defaultPermissionMode;
        if (Object.keys(latticeUpdates).length > 0) {
          mergeProjectClaudeSettings(project.path, { lattice: latticeUpdates });
        }
      } else if (section === "environment") {
        invalidateConfigCache();
        var config = loadConfig();
        var idx = config.projects.findIndex(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
        if (idx !== -1) {
          config.projects[idx].env = (settings.env as Record<string, string>) ?? {};
          saveConfig(config);
        }
      } else if (section === "mcp") {
        writeProjectMcpServers(project.path, (settings.mcpServers as Record<string, unknown>) ?? {});
      } else if (section === "rules") {
        writeProjectRules(project.path, (settings.rules as Array<{ filename: string; content: string }>) ?? []);
      } else if (section === "plugins") {
        var disabledPlugins = Array.isArray(settings.disabledPlugins) ? settings.disabledPlugins : [];
        mergeProjectClaudeSettings(project.path, {
          lattice: { disabledPlugins: disabledPlugins },
        });
      } else if (section === "permissions") {
        mergeProjectClaudeSettings(project.path, {
          permissions: {
            allow: (settings.allow as string[]) ?? [],
            deny: (settings.deny as string[]) ?? [],
          },
        });
      }
    } catch (err) {
      var errMsg = err instanceof Error ? err.message : String(err);
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: errMsg });
      return;
    }

    var updated = buildProjectSettings(projectSlug);
    if ("error" in updated) {
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: updated.error });
      return;
    }
    sendTo(clientId, { type: "project-settings:data", projectSlug, settings: updated });
    return;
  }
});
