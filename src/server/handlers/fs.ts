import type { ClientMessage, FsListMessage, FsReadMessage, FsWriteMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast, subscribeClientToProject, broadcastToProject } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { listDirectory, readFile, writeFile } from "../project/file-browser";
import { readdir, readFile as fsReadFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../config";

var activeProjectByClient = new Map<string, string>();

export function setActiveProject(clientId: string, projectSlug: string): void {
  activeProjectByClient.set(clientId, projectSlug);
  subscribeClientToProject(clientId, projectSlug);
}

export function clearActiveProject(clientId: string): void {
  activeProjectByClient.delete(clientId);
}

export function getActiveProjectForClient(clientId: string): string | undefined {
  return activeProjectByClient.get(clientId);
}

registerHandler("fs", async function (clientId: string, message: ClientMessage) {
  if (message.type === "fs:list") {
    var listMsg = message as FsListMessage;
    var projectSlug = activeProjectByClient.get(clientId) || listMsg.projectSlug;
    if (listMsg.projectSlug) {
      setActiveProject(clientId, listMsg.projectSlug);
      projectSlug = listMsg.projectSlug;
    }
    if (!projectSlug) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:list" });
      return;
    }

    var project = getProjectBySlug(projectSlug);
    if (!project) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlug });
      return;
    }

    var entries = await listDirectory(project.path, listMsg.path);
    sendTo(clientId, { type: "fs:list_result", path: listMsg.path, entries });
    return;
  }

  if (message.type === "fs:read") {
    var readMsg = message as FsReadMessage;
    var projectSlugRead = activeProjectByClient.get(clientId) || readMsg.projectSlug;
    if (readMsg.projectSlug) {
      setActiveProject(clientId, readMsg.projectSlug);
      projectSlugRead = readMsg.projectSlug;
    }
    if (!projectSlugRead) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:read" });
      return;
    }

    var projectRead = getProjectBySlug(projectSlugRead);
    if (!projectRead) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlugRead });
      return;
    }

    var content = await readFile(projectRead.path, readMsg.path);
    if (content === null) {
      sendTo(clientId, { type: "chat:error", message: "Cannot read file: " + readMsg.path });
      return;
    }

    sendTo(clientId, { type: "fs:read_result", path: readMsg.path, content });
    return;
  }

  if (message.type === "fs:write") {
    var writeMsg = message as FsWriteMessage;
    var projectSlugWrite = activeProjectByClient.get(clientId);
    if (!projectSlugWrite) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:write" });
      return;
    }

    var projectWrite = getProjectBySlug(projectSlugWrite);
    if (!projectWrite) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlugWrite });
      return;
    }

    var ok = await writeFile(projectWrite.path, writeMsg.path, writeMsg.content);
    if (!ok) {
      sendTo(clientId, { type: "chat:error", message: "Cannot write file: " + writeMsg.path });
      return;
    }

    broadcastToProject(projectSlugWrite, { type: "fs:changed", path: writeMsg.path });
    return;
  }
});

function resolvePath(path: string): string {
  if (!path || path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

async function detectProjectName(dirPath: string): Promise<string | null> {
  try {
    var pkgPath = join(dirPath, "package.json");
    var pkg = JSON.parse(await fsReadFile(pkgPath, "utf-8"));
    if (pkg.name) return pkg.name;
  } catch {}

  try {
    var cargoPath = join(dirPath, "Cargo.toml");
    var cargo = await fsReadFile(cargoPath, "utf-8");
    var cargoMatch = cargo.match(/\[package\][\s\S]*?name\s*=\s*"([^"]+)"/);
    if (cargoMatch) return cargoMatch[1];
  } catch {}

  try {
    var composerPath = join(dirPath, "composer.json");
    var composer = JSON.parse(await fsReadFile(composerPath, "utf-8"));
    if (composer.name) return composer.name;
  } catch {}

  try {
    var pyprojectPath = join(dirPath, "pyproject.toml");
    var pyproject = await fsReadFile(pyprojectPath, "utf-8");
    var pyMatch = pyproject.match(/\[project\][\s\S]*?name\s*=\s*"([^"]+)"/);
    if (pyMatch) return pyMatch[1];
  } catch {}

  try {
    var goModPath = join(dirPath, "go.mod");
    var goMod = await fsReadFile(goModPath, "utf-8");
    var goMatch = goMod.match(/^module\s+(\S+)/m);
    if (goMatch) {
      var parts = goMatch[1].split("/");
      return parts[parts.length - 1];
    }
  } catch {}

  try {
    var entries = await readdir(dirPath);
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].endsWith(".sln") || entries[i].endsWith(".csproj")) {
        return entries[i].replace(/\.[^.]+$/, "");
      }
    }
  } catch {}

  return null;
}

registerHandler("browse", async function (clientId: string, message: ClientMessage) {
  if (message.type === "browse:list") {
    var browseMsg = message as { type: "browse:list"; path: string };
    var resolvedPath = resolvePath(browseMsg.path);
    var home = homedir();

    try {
      var pathStat = await stat(resolvedPath);
      if (!pathStat.isDirectory()) {
        sendTo(clientId, { type: "browse:list_result", path: resolvedPath, homedir: home, entries: [] });
        return;
      }
    } catch {
      sendTo(clientId, { type: "browse:list_result", path: resolvedPath, homedir: home, entries: [] });
      return;
    }

    try {
      var dirEntries = await readdir(resolvedPath, { withFileTypes: true });
      var results: Array<{ name: string; path: string; hasClaudeMd: boolean; projectName: string | null }> = [];

      for (var i = 0; i < dirEntries.length; i++) {
        var entry = dirEntries[i];
        if (!entry.isDirectory()) continue;

        var entryPath = join(resolvedPath, entry.name);
        var hasClaudeMd = existsSync(join(entryPath, "CLAUDE.md"));
        var projectName = await detectProjectName(entryPath);

        results.push({
          name: entry.name,
          path: entryPath,
          hasClaudeMd: hasClaudeMd,
          projectName: projectName,
        });
      }

      results.sort(function (a, b) { return a.name.localeCompare(b.name); });

      sendTo(clientId, { type: "browse:list_result", path: resolvedPath, homedir: home, entries: results });
    } catch {
      sendTo(clientId, { type: "browse:list_result", path: resolvedPath, homedir: home, entries: [] });
    }
    return;
  }

  if (message.type === "browse:suggestions") {
    var claudeProjectsDir = join(homedir(), ".claude", "projects");
    var config = loadConfig();
    var existingPaths = new Set(config.projects.map(function (p: typeof config.projects[number]) { return p.path; }));
    var suggestions: Array<{ path: string; name: string; hasClaudeMd: boolean }> = [];

    try {
      var hashDirs = await readdir(claudeProjectsDir);
      for (var i = 0; i < hashDirs.length; i++) {
        var hashDir = hashDirs[i];
        var candidatePath = "/" + hashDir.slice(1).replace(/-/g, "/");

        if (!existsSync(candidatePath)) continue;
        if (existingPaths.has(candidatePath)) continue;

        try {
          var candidateStat = await stat(candidatePath);
          if (!candidateStat.isDirectory()) continue;
        } catch { continue; }

        var hasClaudeMd = existsSync(join(candidatePath, "CLAUDE.md"));
        var name = candidatePath.split("/").pop() || hashDir;

        suggestions.push({
          path: candidatePath,
          name: name,
          hasClaudeMd: hasClaudeMd,
        });
      }
    } catch {}

    suggestions.sort(function (a, b) { return a.name.localeCompare(b.name); });
    sendTo(clientId, { type: "browse:suggestions_result", suggestions: suggestions });
    return;
  }
});
