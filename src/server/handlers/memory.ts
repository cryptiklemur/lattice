import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ClientMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig } from "../config";

function getMemoryDir(projectSlug: string): string | null {
  if (projectSlug === "__global__") {
    return join(homedir(), ".claude", "memory");
  }
  const config = loadConfig();
  const project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
  if (!project) return null;
  const hash = "-" + project.path.replace(/\//g, "-").replace(/^-/, "");
  return join(homedir(), ".claude", "projects", hash, "memory");
}

function parseFrontmatter(content: string): { name: string; description: string; type: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "", type: "" };
  const yaml = match[1];
  let name = "";
  let description = "";
  let type = "";
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
    const typeMatch = line.match(/^type:\s*(.+)/);
    if (typeMatch) type = typeMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description, type };
}

async function regenerateIndex(memoryDir: string): Promise<void> {
  if (!existsSync(memoryDir)) return;
  const files = (await readdir(memoryDir)).filter(function (f) {
    return f.endsWith(".md") && f !== "MEMORY.md";
  });

  const grouped: Record<string, Array<{ filename: string; name: string; description: string }>> = {};

  for (let i = 0; i < files.length; i++) {
    try {
      const content = await readFile(join(memoryDir, files[i]), "utf-8");
      const meta = parseFrontmatter(content);
      const type = meta.type || "other";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ filename: files[i], name: meta.name || files[i], description: meta.description || "" });
    } catch {}
  }

  const lines: string[] = ["# Memory Index", ""];
  const types = Object.keys(grouped).sort();
  for (let t = 0; t < types.length; t++) {
    lines.push("## " + types[t].charAt(0).toUpperCase() + types[t].slice(1));
    const entries = grouped[types[t]];
    for (let e = 0; e < entries.length; e++) {
      const desc = entries[e].description ? " — " + entries[e].description : "";
      lines.push("- [" + entries[e].filename + "](" + entries[e].filename + ")" + desc);
    }
    lines.push("");
  }

  await writeFile(join(memoryDir, "MEMORY.md"), lines.join("\n"), "utf-8");
}

async function listMemoryFiles(memDir: string): Promise<Array<{ filename: string; name: string; description: string; type: string }>> {
  const files = (await readdir(memDir)).filter(function (f) {
    return f.endsWith(".md") && f !== "MEMORY.md";
  });
  const memories: Array<{ filename: string; name: string; description: string; type: string }> = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const content = await readFile(join(memDir, files[i]), "utf-8");
      const meta = parseFrontmatter(content);
      memories.push({
        filename: files[i],
        name: meta.name || files[i].replace(/\.md$/, ""),
        description: meta.description,
        type: meta.type || "other",
      });
    } catch {}
  }
  memories.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return memories;
}

registerHandler("memory", async function (clientId: string, message: ClientMessage) {
  if (message.type === "memory:list") {
    const listMsg = message as { type: "memory:list"; projectSlug: string };
    const memDir = getMemoryDir(listMsg.projectSlug);
    if (!memDir || !existsSync(memDir)) {
      sendTo(clientId, { type: "memory:list_result", projectSlug: listMsg.projectSlug, memories: [] });
      return;
    }

    const memories = await listMemoryFiles(memDir);
    sendTo(clientId, { type: "memory:list_result", projectSlug: listMsg.projectSlug, memories: memories });
    return;
  }

  if (message.type === "memory:view") {
    const viewMsg = message as { type: "memory:view"; projectSlug: string; filename: string };
    const viewDir = getMemoryDir(viewMsg.projectSlug);
    if (!viewDir) {
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: "Project not found." });
      return;
    }
    try {
      const viewContent = await readFile(join(viewDir, viewMsg.filename), "utf-8");
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: viewContent });
    } catch {
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: "File not found." });
    }
    return;
  }

  if (message.type === "memory:save") {
    const saveMsg = message as { type: "memory:save"; projectSlug: string; filename: string; content: string };
    const saveDir = getMemoryDir(saveMsg.projectSlug);
    if (!saveDir) {
      sendTo(clientId, { type: "memory:save_result", success: false, message: "Project not found." });
      return;
    }
    try {
      await mkdir(saveDir, { recursive: true });
      await writeFile(join(saveDir, saveMsg.filename), saveMsg.content, "utf-8");
      await regenerateIndex(saveDir);
      sendTo(clientId, { type: "memory:save_result", success: true });
      const updatedMemories = await listMemoryFiles(saveDir);
      sendTo(clientId, { type: "memory:list_result", projectSlug: saveMsg.projectSlug, memories: updatedMemories });
    } catch (err) {
      sendTo(clientId, { type: "memory:save_result", success: false, message: "Failed to save: " + String(err) });
    }
    return;
  }

  if (message.type === "memory:delete") {
    const delMsg = message as { type: "memory:delete"; projectSlug: string; filename: string };
    const delDir = getMemoryDir(delMsg.projectSlug);
    if (!delDir) {
      sendTo(clientId, { type: "memory:delete_result", success: false, message: "Project not found." });
      return;
    }
    try {
      const filePath = join(delDir, delMsg.filename);
      if (!existsSync(filePath)) {
        sendTo(clientId, { type: "memory:delete_result", success: false, message: "Memory not found." });
        return;
      }
      await unlink(filePath);
      await regenerateIndex(delDir);
      sendTo(clientId, { type: "memory:delete_result", success: true });
      const remainingMemories = await listMemoryFiles(delDir);
      sendTo(clientId, { type: "memory:list_result", projectSlug: delMsg.projectSlug, memories: remainingMemories });
    } catch (err) {
      sendTo(clientId, { type: "memory:delete_result", success: false, message: "Failed to delete: " + String(err) });
    }
    return;
  }
});
