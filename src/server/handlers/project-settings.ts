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
  const mdPath = join(homedir(), ".claude", "CLAUDE.md");
  if (existsSync(mdPath)) {
    try {
      return readFileSync(mdPath, "utf-8");
    } catch {}
  }
  return "";
}

function buildProjectSettings(projectSlug: string): ProjectSettings | { error: string } {
  const project = getProjectBySlug(projectSlug);
  if (!project) {
    return { error: "Project not found" };
  }
  if (!existsSync(project.path)) {
    return { error: "Project path does not exist on disk" };
  }

  const claudeMd = readProjectClaudeMd(project.path);
  const claudeSettings = readProjectClaudeSettings(project.path);
  const lattice = (claudeSettings.lattice ?? {}) as Record<string, unknown>;
  const permissions = (claudeSettings.permissions ?? { allow: [], deny: [] }) as { allow: string[]; deny: string[] };
  const rules = readProjectRules(project.path);
  const mcpServers = readProjectMcpServers(project.path) as Record<string, McpServerConfig>;
  const skills = readProjectSkills(project.path);

  const config = loadConfig();

  const settings: ProjectSettings = {
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
    const getMsg = message as ProjectSettingsGetMessage;
    const result = buildProjectSettings(getMsg.projectSlug);
    if ("error" in result) {
      sendTo(clientId, { type: "project-settings:error", projectSlug: getMsg.projectSlug, message: result.error });
      return;
    }
    sendTo(clientId, { type: "project-settings:data", projectSlug: getMsg.projectSlug, settings: result });
    return;
  }

  if (message.type === "project-settings:update") {
    const updateMsg = message as ProjectSettingsUpdateMessage;
    const projectSlug = updateMsg.projectSlug;
    const section = updateMsg.section;
    const settings = updateMsg.settings;

    const project = getProjectBySlug(projectSlug);
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
        const config = loadConfig();
        const idx = config.projects.findIndex(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
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
        const latticeUpdates: Record<string, unknown> = {};
        if (settings.defaultModel !== undefined) latticeUpdates.defaultModel = settings.defaultModel;
        if (settings.defaultEffort !== undefined) latticeUpdates.defaultEffort = settings.defaultEffort;
        if (settings.thinking !== undefined) latticeUpdates.thinking = settings.thinking;
        if (settings.defaultPermissionMode !== undefined) latticeUpdates.defaultPermissionMode = settings.defaultPermissionMode;
        if (Object.keys(latticeUpdates).length > 0) {
          mergeProjectClaudeSettings(project.path, { lattice: latticeUpdates });
        }
      } else if (section === "environment") {
        invalidateConfigCache();
        const config = loadConfig();
        const idx = config.projects.findIndex(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
        if (idx !== -1) {
          config.projects[idx].env = (settings.env as Record<string, string>) ?? {};
          saveConfig(config);
        }
      } else if (section === "mcp") {
        writeProjectMcpServers(project.path, (settings.mcpServers as Record<string, unknown>) ?? {});
      } else if (section === "rules") {
        writeProjectRules(project.path, (settings.rules as Array<{ filename: string; content: string }>) ?? []);
      } else if (section === "plugins") {
        const disabledPlugins = Array.isArray(settings.disabledPlugins) ? settings.disabledPlugins : [];
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
      const errMsg = err instanceof Error ? err.message : String(err);
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: errMsg });
      return;
    }

    const updated = buildProjectSettings(projectSlug);
    if ("error" in updated) {
      sendTo(clientId, { type: "project-settings:error", projectSlug, message: updated.error });
      return;
    }
    sendTo(clientId, { type: "project-settings:data", projectSlug, settings: updated });
    return;
  }
});
