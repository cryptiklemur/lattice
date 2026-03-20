import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

export function readProjectClaudeMd(projectPath: string): string {
  var filePath = join(projectPath, "CLAUDE.md");
  if (!existsSync(filePath)) return "";
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

export function writeProjectClaudeMd(projectPath: string, content: string): void {
  writeFileSync(join(projectPath, "CLAUDE.md"), content, "utf-8");
}

export function readProjectClaudeSettings(projectPath: string): Record<string, unknown> {
  var filePath = join(projectPath, ".claude", "settings.json");
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

export function mergeProjectClaudeSettings(projectPath: string, updates: Record<string, unknown>): void {
  var existing = readProjectClaudeSettings(projectPath);
  Object.assign(existing, updates);
  var dir = join(projectPath, ".claude");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "settings.json"), JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

export function readProjectRules(projectPath: string): Array<{ filename: string; content: string }> {
  var dir = join(projectPath, ".claude", "rules");
  if (!existsSync(dir)) return [];
  var results: Array<{ filename: string; content: string }> = [];
  try {
    var files = readdirSync(dir);
    for (var file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        var content = readFileSync(join(dir, file), "utf-8");
        results.push({ filename: file, content });
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    return [];
  }
  return results;
}

export function writeProjectRules(projectPath: string, rules: Array<{ filename: string; content: string }>): void {
  var dir = join(projectPath, ".claude", "rules");
  mkdirSync(dir, { recursive: true });

  var incoming = new Set<string>();
  for (var rule of rules) {
    incoming.add(rule.filename);
  }

  try {
    var existing = readdirSync(dir);
    for (var file of existing) {
      if (file.endsWith(".md") && !incoming.has(file)) {
        unlinkSync(join(dir, file));
      }
    }
  } catch {
    // dir just created, nothing to delete
  }

  for (var rule of rules) {
    writeFileSync(join(dir, rule.filename), rule.content, "utf-8");
  }
}

export function readProjectMcpServers(projectPath: string): Record<string, unknown> {
  var filePath = join(projectPath, ".mcp.json");
  if (!existsSync(filePath)) return {};
  try {
    var parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed?.mcpServers ?? {};
  } catch {
    return {};
  }
}

export function writeProjectMcpServers(projectPath: string, servers: Record<string, unknown>): void {
  var filePath = join(projectPath, ".mcp.json");
  writeFileSync(filePath, JSON.stringify({ mcpServers: servers }, null, 2) + "\n", "utf-8");
}

export function readProjectSkills(projectPath: string): Array<{ name: string; description: string; path: string }> {
  return scanSkillsDir(join(projectPath, ".claude", "skills"));
}

export function readGlobalRules(): Array<{ filename: string; content: string }> {
  var dir = join(homedir(), ".claude", "rules");
  if (!existsSync(dir)) return [];
  var results: Array<{ filename: string; content: string }> = [];
  try {
    var files = readdirSync(dir);
    for (var file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        var content = readFileSync(join(dir, file), "utf-8");
        results.push({ filename: file, content });
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    return [];
  }
  return results;
}

export function readGlobalPermissions(): { allow: string[]; deny: string[] } {
  var settings = readJsonFile(join(homedir(), ".claude", "settings.json"));
  var local = readJsonFile(join(homedir(), ".claude", "settings.local.json"));

  var allow = new Set<string>();
  var deny = new Set<string>();

  collectPermissions(settings, allow, deny);
  collectPermissions(local, allow, deny);

  return { allow: Array.from(allow), deny: Array.from(deny) };
}

export function readGlobalMcpServers(): Record<string, unknown> {
  var filePath = join(homedir(), ".claude.json");
  if (!existsSync(filePath)) return {};
  try {
    var parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed?.mcpServers ?? {};
  } catch {
    return {};
  }
}

export function writeGlobalMcpServers(servers: Record<string, unknown>): void {
  var filePath = join(homedir(), ".claude.json");
  var existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {}
  }
  existing.mcpServers = servers;
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

export function readGlobalSkills(): Array<{ name: string; description: string; path: string }> {
  return scanSkillsDir(join(homedir(), ".claude", "skills"));
}

function readJsonFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function collectPermissions(obj: Record<string, unknown>, allow: Set<string>, deny: Set<string>): void {
  var perms = obj.permissions as Record<string, unknown> | undefined;
  if (!perms) return;
  var allowArr = perms.allow;
  var denyArr = perms.deny;
  if (Array.isArray(allowArr)) {
    for (var item of allowArr) {
      if (typeof item === "string") allow.add(item);
    }
  }
  if (Array.isArray(denyArr)) {
    for (var item of denyArr) {
      if (typeof item === "string") deny.add(item);
    }
  }
}

function scanSkillsDir(dir: string): Array<{ name: string; description: string; path: string }> {
  if (!existsSync(dir)) return [];
  var results: Array<{ name: string; description: string; path: string }> = [];
  try {
    var entries = readdirSync(dir, { withFileTypes: true });
    for (var entry of entries) {
      var entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        try {
          var subFiles = readdirSync(entryPath);
          for (var subFile of subFiles) {
            if (subFile.toUpperCase().startsWith("SKILL")) {
              var skillPath = join(entryPath, subFile);
              var content = readFileSync(skillPath, "utf-8");
              var description = firstNonEmptyLine(content);
              results.push({ name: entry.name, description, path: skillPath });
              break;
            }
          }
        } catch {
          // skip unreadable subdirectories
        }
      } else if (entry.name.toUpperCase().startsWith("SKILL")) {
        try {
          var content = readFileSync(entryPath, "utf-8");
          var description = firstNonEmptyLine(content);
          var name = entry.name.replace(/\.[^.]+$/, "");
          results.push({ name, description, path: entryPath });
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    return [];
  }
  return results;
}

function firstNonEmptyLine(text: string): string {
  var lines = text.split("\n");
  for (var line of lines) {
    var trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}
