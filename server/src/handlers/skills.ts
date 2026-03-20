import { readdirSync, readFileSync, existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import type { ClientMessage } from "@lattice/shared";
import type { SkillInfo } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig } from "../config";
import { readGlobalMcpServers, readGlobalSkills } from "../project/project-files";

var searchCache = new Map<string, { skills: Array<{ id: string; skillId: string; name: string; source: string; installs: number }>; count: number; time: number }>();

var skillsCache: SkillInfo[] | null = null;
var lastScanTime: number = 0;
var CACHE_TTL_MS = 60000;

function parseFrontmatter(content: string): { name: string; description: string } {
  var match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "" };
  var yaml = match[1];
  var name = "";
  var desc = "";
  var lines = yaml.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    var descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description: desc };
}

function findSkillFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  try {
    var output = execSync(
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
    var content = readFileSync(filePath, "utf-8");
    var name = fileName.replace(/\.md$/, "");
    var desc = "";
    var lines = content.split(/\r?\n/);
    for (var i = 0; i < Math.min(lines.length, 10); i++) {
      var line = lines[i].trim();
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
  var results: SkillInfo[] = [];
  if (!existsSync(dirPath)) return results;
  try {
    var entries = readdirSync(dirPath);
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i].endsWith(".md")) continue;
      var filePath = join(dirPath, entries[i]);
      var info = parseCommandFile(filePath, entries[i]);
      if (info) results.push(info);
    }
  } catch {}
  return results;
}

function getSkills(): SkillInfo[] {
  var now = Date.now();
  if (skillsCache && now - lastScanTime < CACHE_TTL_MS) {
    return skillsCache;
  }

  var home = homedir();
  var skills: SkillInfo[] = [];

  var skillDirs = [
    join(home, ".claude"),
    join(home, ".agents"),
    join(home, ".superpowers"),
  ];

  for (var d = 0; d < skillDirs.length; d++) {
    var files = findSkillFiles(skillDirs[d]);
    for (var f = 0; f < files.length; f++) {
      try {
        var content = readFileSync(files[f], "utf-8");
        var meta = parseFrontmatter(content);
        if (meta.name) {
          var skillName = meta.name;
          var filePath = files[f];

          var pluginMatch = filePath.match(/plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/);
          if (pluginMatch) {
            var pluginName = pluginMatch[1];
            var rawSkillName = pluginMatch[2];
            if (skillName.indexOf(":") === -1 && skillName === rawSkillName) {
              skillName = pluginName + ":" + skillName;
            }
          }

          var extPluginMatch = filePath.match(/external_plugins\/([^/]+)\/skills\/([^/]+)\/SKILL\.md$/);
          if (extPluginMatch) {
            var extPluginName = extPluginMatch[1];
            var extSkillName = extPluginMatch[2];
            if (skillName.indexOf(":") === -1 && skillName === extSkillName) {
              skillName = extPluginName + ":" + skillName;
            }
          }

          var marketplaceSkillMatch = filePath.match(/marketplaces\/([^/]+)\/.claude\/skills\/([^/]+)\/SKILL\.md$/);
          if (marketplaceSkillMatch) {
            var mktName = marketplaceSkillMatch[1];
            var mktSkill = marketplaceSkillMatch[2];
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

  var config = loadConfig();
  for (var p = 0; p < config.projects.length; p++) {
    var projectPath = config.projects[p].path;
    var projectSkillDirs = [
      join(projectPath, ".claude", "skills"),
      join(projectPath, ".claude", "commands"),
      join(projectPath, ".superpowers", "skills"),
    ];
    for (var pd = 0; pd < projectSkillDirs.length; pd++) {
      if (projectSkillDirs[pd].endsWith("commands")) {
        var cmds = scanCommandsDir(projectSkillDirs[pd]);
        for (var c = 0; c < cmds.length; c++) skills.push(cmds[c]);
      } else {
        var projFiles = findSkillFiles(projectSkillDirs[pd]);
        for (var pf = 0; pf < projFiles.length; pf++) {
          try {
            var projContent = readFileSync(projFiles[pf], "utf-8");
            var projMeta = parseFrontmatter(projContent);
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

  var globalCommands = scanCommandsDir(join(home, ".claude", "commands"));
  for (var gc = 0; gc < globalCommands.length; gc++) {
    skills.push(globalCommands[gc]);
  }

  var namespacedBareNames = new Set<string>();
  for (var n = 0; n < skills.length; n++) {
    var colonIdx = skills[n].name.indexOf(":");
    if (colonIdx !== -1) {
      namespacedBareNames.add(skills[n].name.slice(colonIdx + 1));
    }
  }

  var filtered: SkillInfo[] = [];
  for (var fi = 0; fi < skills.length; fi++) {
    if (skills[fi].name.indexOf(":") === -1 && namespacedBareNames.has(skills[fi].name)) {
      continue;
    }
    filtered.push(skills[fi]);
  }

  filtered.sort(function (a, b) { return a.name.localeCompare(b.name); });

  var seen = new Set<string>();
  var unique: SkillInfo[] = [];
  for (var i = 0; i < filtered.length; i++) {
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
  var skills = getSkills();
  var match = skills.find(function (s) { return s.name === skillName; });
  if (!match) return null;
  try {
    return readFileSync(match.path, "utf-8");
  } catch {
    return null;
  }
}

registerHandler("skills", function (clientId: string, message: ClientMessage) {
  if (message.type === "skills:list_request") {
    var skills = getSkills();
    sendTo(clientId, { type: "skills:list", skills: skills });
    return;
  }

  if (message.type === "skills:search") {
    var searchMsg = message as { type: "skills:search"; query: string };
    var query = searchMsg.query.trim();
    if (!query) {
      sendTo(clientId, { type: "skills:search_results", query: query, skills: [], count: 0 });
      return;
    }

    var cacheKey = "search:" + query;
    var cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 60000) {
      sendTo(clientId, { type: "skills:search_results", query: query, skills: cached.skills, count: cached.count });
      return;
    }

    void fetch("https://skills.sh/api/search?q=" + encodeURIComponent(query))
      .then(function (res) { return res.json(); })
      .then(function (data: { skills?: Array<{ id: string; skillId: string; name: string; source: string; installs: number }>; count?: number }) {
        var skills = (data.skills ?? []).map(function (s) {
          return { id: s.id, skillId: s.skillId, name: s.name, source: s.source, installs: s.installs };
        });
        var count = data.count ?? skills.length;
        searchCache.set(cacheKey, { skills: skills, count: count, time: Date.now() });
        sendTo(clientId, { type: "skills:search_results", query: query, skills: skills, count: count });
      })
      .catch(function () {
        sendTo(clientId, { type: "skills:search_results", query: query, skills: [], count: 0, error: "Search unavailable" });
      });
    return;
  }

  if (message.type === "skills:install") {
    var installMsg = message as { type: "skills:install"; source: string; scope: "global" | "project"; projectSlug?: string };
    var cwd = homedir();
    if (installMsg.scope === "project" && installMsg.projectSlug) {
      var installConfig = loadConfig();
      var installProject = installConfig.projects.find(function (p) { return p.slug === installMsg.projectSlug; });
      if (installProject) {
        cwd = installProject.path;
      }
    }

    try {
      var proc = Bun.spawn(["npx", "skillsadd", installMsg.source], {
        cwd: cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      var timeout = setTimeout(function () {
        proc.kill();
      }, 60000);

      void proc.exited.then(function (code) {
        clearTimeout(timeout);
        skillsCache = null;
        if (code === 0) {
          sendTo(clientId, { type: "skills:install_result", success: true, message: "Installed successfully" });
        } else {
          sendTo(clientId, { type: "skills:install_result", success: false, message: "Install failed (exit code " + code + ")" });
        }
        if (installMsg.scope === "global") {
          var globalConfig = loadConfig();
          sendTo(clientId, {
            type: "settings:data",
            config: globalConfig,
            mcpServers: readGlobalMcpServers() as Record<string, import("@lattice/shared").McpServerConfig>,
            globalSkills: readGlobalSkills(),
          });
        }
      });
    } catch (err) {
      sendTo(clientId, { type: "skills:install_result", success: false, message: "Failed to start install: " + String(err) });
    }
    return;
  }
});
