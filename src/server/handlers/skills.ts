import { readdirSync, readFileSync, existsSync, lstatSync, realpathSync, statSync, rmSync } from "node:fs";
import { join, sep, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync, spawn } from "node:child_process";
import type { ClientMessage } from "#shared";
import type { SkillInfo } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig } from "../config";
import { readGlobalMcpServers, readGlobalSkills } from "../project/project-files";

const searchCache = new Map<string, { skills: Array<{ id: string; skillId: string; name: string; source: string; installs: number }>; count: number; time: number }>();

let skillsCache: SkillInfo[] | null = null;
let lastScanTime: number = 0;
const CACHE_TTL_MS = 60000;

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "" };
  const yaml = match[1];
  let name = "";
  let desc = "";
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description: desc };
}

function findSkillFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  try {
    const output = execSync(
      "find " + JSON.stringify(rootDir) + " -name SKILL.md -type f 2>/dev/null",
      { encoding: "utf-8", timeout: 5000 }
    );
    return output.trim().split("\n").filter(function (l) { return l.length > 0; });
  } catch {
    return [];
  }
}

function parseCommandFile(filePath: string, fileName: string): SkillInfo | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const name = fileName.replace(/\.md$/, "");
    let desc = "";
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (line.length > 0 && !line.startsWith("#") && !line.startsWith("---")) {
        desc = line.slice(0, 120);
        break;
      }
    }
    return { name: name, description: desc || "Command: " + name, path: filePath };
  } catch {
    return null;
  }
}

function scanCommandsDir(dirPath: string): SkillInfo[] {
  const results: SkillInfo[] = [];
  if (!existsSync(dirPath)) return results;
  try {
    const entries = readdirSync(dirPath);
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].endsWith(".md")) continue;
      const filePath = join(dirPath, entries[i]);
      const info = parseCommandFile(filePath, entries[i]);
      if (info) results.push(info);
    }
  } catch {}
  return results;
}

function getSkills(): SkillInfo[] {
  const now = Date.now();
  if (skillsCache && now - lastScanTime < CACHE_TTL_MS) {
    return skillsCache;
  }

  const home = homedir();
  const skills: SkillInfo[] = [];

  const skillDirs = [
    join(home, ".claude"),
    join(home, ".agents"),
    join(home, ".superpowers"),
  ];

  for (let d = 0; d < skillDirs.length; d++) {
    const files = findSkillFiles(skillDirs[d]);
    for (let f = 0; f < files.length; f++) {
      try {
        const content = readFileSync(files[f], "utf-8");
        const meta = parseFrontmatter(content);
        if (meta.name) {
          let skillName = meta.name;
          const filePath = files[f];

          const pluginMatch = filePath.match(/plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/);
          if (pluginMatch) {
            const pluginName = pluginMatch[1];
            const rawSkillName = pluginMatch[2];
            if (skillName.indexOf(":") === -1 && skillName === rawSkillName) {
              skillName = pluginName + ":" + skillName;
            }
          }

          const extPluginMatch = filePath.match(/external_plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/);
          if (extPluginMatch) {
            const extPluginName = extPluginMatch[1];
            const extSkillName = extPluginMatch[2];
            if (skillName.indexOf(":") === -1 && skillName === extSkillName) {
              skillName = extPluginName + ":" + skillName;
            }
          }

          const marketplaceSkillMatch = filePath.match(/marketplaces\/([^/]+)\/.claude\/skills\/([^/]+)\/SKILL\.md$/);
          if (marketplaceSkillMatch) {
            const mktName = marketplaceSkillMatch[1];
            const mktSkill = marketplaceSkillMatch[2];
            if (skillName.indexOf(":") === -1 && skillName === mktSkill) {
              skillName = mktName + ":" + skillName;
            }
          }

          skills.push({
            name: skillName,
            description: meta.description,
            path: filePath,
          });
        }
      } catch {}
    }
  }

  const config = loadConfig();
  for (let p = 0; p < config.projects.length; p++) {
    const projectPath = config.projects[p].path;
    const projectSkillDirs = [
      join(projectPath, ".claude", "skills"),
      join(projectPath, ".claude", "commands"),
      join(projectPath, ".superpowers", "skills"),
    ];
    for (let pd = 0; pd < projectSkillDirs.length; pd++) {
      if (projectSkillDirs[pd].endsWith("commands")) {
        const cmds = scanCommandsDir(projectSkillDirs[pd]);
        for (let c = 0; c < cmds.length; c++) skills.push(cmds[c]);
      } else {
        const projFiles = findSkillFiles(projectSkillDirs[pd]);
        for (let pf = 0; pf < projFiles.length; pf++) {
          try {
            const projContent = readFileSync(projFiles[pf], "utf-8");
            const projMeta = parseFrontmatter(projContent);
            if (projMeta.name) {
              skills.push({
                name: projMeta.name,
                description: projMeta.description,
                path: projFiles[pf],
              });
            }
          } catch {}
        }
      }
    }
  }

  const globalCommands = scanCommandsDir(join(home, ".claude", "commands"));
  for (let gc = 0; gc < globalCommands.length; gc++) {
    skills.push(globalCommands[gc]);
  }

  const namespacedBareNames = new Set<string>();
  for (let n = 0; n < skills.length; n++) {
    const colonIdx = skills[n].name.indexOf(":");
    if (colonIdx !== -1) {
      namespacedBareNames.add(skills[n].name.slice(colonIdx + 1));
    }
  }

  const filtered: SkillInfo[] = [];
  for (let fi = 0; fi < skills.length; fi++) {
    if (skills[fi].name.indexOf(":") === -1 && namespacedBareNames.has(skills[fi].name)) {
      continue;
    }
    filtered.push(skills[fi]);
  }

  filtered.sort(function (a, b) { return a.name.localeCompare(b.name); });

  const seen = new Set<string>();
  const unique: SkillInfo[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (!seen.has(filtered[i].name)) {
      seen.add(filtered[i].name);
      unique.push(filtered[i]);
    }
  }

  skillsCache = unique;
  lastScanTime = now;
  return unique;
}

export function resolveSkillContent(skillName: string): string | null {
  const skills = getSkills();
  const match = skills.find(function (s) { return s.name === skillName; });
  if (!match) return null;
  try {
    return readFileSync(match.path, "utf-8");
  } catch {
    return null;
  }
}

registerHandler("skills", function (clientId: string, message: ClientMessage) {
  if (message.type === "skills:list_request") {
    const skills = getSkills();
    sendTo(clientId, { type: "skills:list", skills: skills });
    return;
  }

  if (message.type === "skills:search") {
    const searchMsg = message as { type: "skills:search"; query: string };
    const query = searchMsg.query.trim();
    if (!query) {
      sendTo(clientId, { type: "skills:search_results", query: query, skills: [], count: 0 });
      return;
    }

    const cacheKey = "search:" + query;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 60000) {
      sendTo(clientId, { type: "skills:search_results", query: query, skills: cached.skills, count: cached.count });
      return;
    }

    void fetch("https://skills.sh/api/search?q=" + encodeURIComponent(query))
      .then(function (res) { return res.json(); })
      .then(function (data: { skills?: Array<{ id: string; skillId: string; name: string; source: string; installs: number }>; count?: number }) {
        const skills = (data.skills ?? []).map(function (s) {
          return { id: s.id, skillId: s.skillId, name: s.name, source: s.source, installs: s.installs };
        });
        const count = data.count ?? skills.length;
        searchCache.set(cacheKey, { skills: skills, count: count, time: Date.now() });
        sendTo(clientId, { type: "skills:search_results", query: query, skills: skills, count: count });
      })
      .catch(function () {
        sendTo(clientId, { type: "skills:search_results", query: query, skills: [], count: 0, error: "Search unavailable" });
      });
    return;
  }

  if (message.type === "skills:install") {
    const installMsg = message as { type: "skills:install"; source: string; scope: "global" | "project"; projectSlug?: string };
    let cwd = homedir();
    if (installMsg.scope === "project" && installMsg.projectSlug) {
      const installConfig = loadConfig();
      const installProject = installConfig.projects.find(function (p: typeof installConfig.projects[number]) { return p.slug === installMsg.projectSlug; });
      if (installProject) {
        cwd = installProject.path;
      }
    }

    try {
      const proc = spawn("npx", ["skillsadd", installMsg.source], {
        cwd: cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(function () {
        proc.kill();
      }, 60000);

      proc.on("close", function (code) {
        clearTimeout(timeout);
        skillsCache = null;
        if (code === 0) {
          sendTo(clientId, { type: "skills:install_result", success: true, message: "Installed successfully" });
        } else {
          sendTo(clientId, { type: "skills:install_result", success: false, message: "Install failed (exit code " + code + ")" });
        }
        if (installMsg.scope === "global") {
          const globalConfig = loadConfig();
          sendTo(clientId, {
            type: "settings:data",
            config: globalConfig,
            mcpServers: readGlobalMcpServers() as Record<string, import("#shared").McpServerConfig>,
            globalSkills: readGlobalSkills(),
          });
        }
      });
    } catch (err) {
      sendTo(clientId, { type: "skills:install_result", success: false, message: "Failed to start install: " + String(err) });
    }
    return;
  }

  if (message.type === "skills:view") {
    const viewMsg = message as { type: "skills:view"; path: string };
    try {
      if (!existsSync(viewMsg.path)) {
        sendTo(clientId, { type: "skills:view_result", path: viewMsg.path, content: "File not found." });
        return;
      }
      const viewContent = readFileSync(viewMsg.path, "utf-8");
      sendTo(clientId, { type: "skills:view_result", path: viewMsg.path, content: viewContent });
    } catch {
      sendTo(clientId, { type: "skills:view_result", path: viewMsg.path, content: "Failed to read file." });
    }
    return;
  }

  if (message.type === "skills:delete") {
    const deleteMsg = message as { type: "skills:delete"; path: string };
    try {
      const skillDir = dirname(deleteMsg.path);
      if (!existsSync(deleteMsg.path)) {
        sendTo(clientId, { type: "skills:delete_result", success: false, message: "Skill not found." });
        return;
      }
      rmSync(skillDir, { recursive: true, force: true });
      skillsCache = null;
      sendTo(clientId, { type: "skills:delete_result", success: true, message: "Skill deleted." });
      const delConfig = loadConfig();
      sendTo(clientId, {
        type: "settings:data",
        config: delConfig,
        mcpServers: readGlobalMcpServers() as Record<string, import("#shared").McpServerConfig>,
        globalSkills: readGlobalSkills(),
      });
    } catch (err) {
      sendTo(clientId, { type: "skills:delete_result", success: false, message: "Failed to delete: " + String(err) });
    }
    return;
  }

  if (message.type === "skills:update") {
    const updateMsg = message as { type: "skills:update"; source: string };
    try {
      const updateProc = spawn("npx", ["skillsadd", updateMsg.source], {
        cwd: homedir(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      const updateTimeout = setTimeout(function () {
        updateProc.kill();
      }, 60000);

      updateProc.on("close", function (code) {
        clearTimeout(updateTimeout);
        skillsCache = null;
        if (code === 0) {
          sendTo(clientId, { type: "skills:install_result", success: true, message: "Updated successfully" });
        } else {
          sendTo(clientId, { type: "skills:install_result", success: false, message: "Update failed (exit code " + code + ")" });
        }
        const updConfig = loadConfig();
        sendTo(clientId, {
          type: "settings:data",
          config: updConfig,
          mcpServers: readGlobalMcpServers() as Record<string, import("#shared").McpServerConfig>,
          globalSkills: readGlobalSkills(),
        });
      });
    } catch (err) {
      sendTo(clientId, { type: "skills:install_result", success: false, message: "Failed to start update: " + String(err) });
    }
    return;
  }
});
