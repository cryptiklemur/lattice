import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";

export function readProjectClaudeMd(projectPath: string): string {
  const filePath = join(projectPath, "CLAUDE.md");
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
  const filePath = join(projectPath, ".claude", "settings.json");
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

export function mergeProjectClaudeSettings(projectPath: string, updates: Record<string, unknown>): void {
  const existing = readProjectClaudeSettings(projectPath);
  Object.assign(existing, updates);
  const dir = join(projectPath, ".claude");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "settings.json"), JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

export function readProjectRules(projectPath: string): Array<{ filename: string; content: string }> {
  const dir = join(projectPath, ".claude", "rules");
  if (!existsSync(dir)) return [];
  const results: Array<{ filename: string; content: string }> = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = readFileSync(join(dir, file), "utf-8");
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
  const dir = join(projectPath, ".claude", "rules");
  mkdirSync(dir, { recursive: true });

  const incoming = new Set<string>();
  for (const rule of rules) {
    incoming.add(rule.filename);
  }

  try {
    const existing = readdirSync(dir);
    for (const file of existing) {
      if (file.endsWith(".md") && !incoming.has(file)) {
        unlinkSync(join(dir, file));
      }
    }
  } catch {
    // dir just created, nothing to delete
  }

  for (const rule of rules) {
    writeFileSync(join(dir, rule.filename), rule.content, "utf-8");
  }
}

export function readProjectMcpServers(projectPath: string): Record<string, unknown> {
  const filePath = join(projectPath, ".mcp.json");
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed?.mcpServers ?? {};
  } catch {
    return {};
  }
}

export function writeProjectMcpServers(projectPath: string, servers: Record<string, unknown>): void {
  const filePath = join(projectPath, ".mcp.json");
  writeFileSync(filePath, JSON.stringify({ mcpServers: servers }, null, 2) + "\n", "utf-8");
}

export function readProjectSkills(projectPath: string): Array<{ name: string; description: string; path: string }> {
  return scanSkillsDir(join(projectPath, ".claude", "skills"));
}

export function readGlobalRules(): Array<{ filename: string; content: string }> {
  const dir = join(homedir(), ".claude", "rules");
  if (!existsSync(dir)) return [];
  const results: Array<{ filename: string; content: string }> = [];
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        const content = readFileSync(join(dir, file), "utf-8");
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
  const settings = readJsonFile(join(homedir(), ".claude", "settings.json"));
  const local = readJsonFile(join(homedir(), ".claude", "settings.local.json"));

  const allow = new Set<string>();
  const deny = new Set<string>();

  collectPermissions(settings, allow, deny);
  collectPermissions(local, allow, deny);

  return { allow: Array.from(allow), deny: Array.from(deny) };
}

export function readGlobalMcpServers(): Record<string, unknown> {
  const filePath = join(homedir(), ".claude.json");
  if (!existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return parsed?.mcpServers ?? {};
  } catch {
    return {};
  }
}

export function writeGlobalMcpServers(servers: Record<string, unknown>): void {
  const filePath = join(homedir(), ".claude.json");
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      existing = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {}
  }
  existing.mcpServers = servers;
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n", "utf-8");
}

export function readGlobalSkills(): Array<{ name: string; description: string; path: string }> {
  const results: Array<{ name: string; description: string; path: string }> = [];
  const dirs = [
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".agents", "skills"),
  ];
  for (const dir of dirs) {
    const skills = scanSkillsDir(dir);
    for (const skill of skills) {
      results.push(skill);
    }
  }
  return results;
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
  const perms = obj.permissions as Record<string, unknown> | undefined;
  if (!perms) return;
  const allowArr = perms.allow;
  const denyArr = perms.deny;
  if (Array.isArray(allowArr)) {
    for (const item of allowArr) {
      if (typeof item === "string") allow.add(item);
    }
  }
  if (Array.isArray(denyArr)) {
    for (const item of denyArr) {
      if (typeof item === "string") deny.add(item);
    }
  }
}

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

function scanSkillsDir(dir: string): Array<{ name: string; description: string; path: string }> {
  if (!existsSync(dir)) return [];
  const results: Array<{ name: string; description: string; path: string }> = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        try {
          const subFiles = readdirSync(entryPath);
          for (const subFile of subFiles) {
            if (subFile.toUpperCase().startsWith("SKILL")) {
              const skillPath = join(entryPath, subFile);
              const content = readFileSync(skillPath, "utf-8");
              const meta = parseFrontmatter(content);
              const skillName = meta.name || entry.name;
              const description = meta.description || firstNonEmptyLine(content.replace(/^---[\s\S]*?---\s*/, ""));
              results.push({ name: skillName, description, path: skillPath });
              break;
            }
          }
        } catch {
          // skip unreadable subdirectories
        }
      } else if (entry.name.toUpperCase().startsWith("SKILL")) {
        try {
          const content = readFileSync(entryPath, "utf-8");
          const meta = parseFrontmatter(content);
          const name = meta.name || entry.name.replace(/\.[^.]+$/, "");
          const description = meta.description || firstNonEmptyLine(content.replace(/^---[\s\S]*?---\s*/, ""));
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
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}
