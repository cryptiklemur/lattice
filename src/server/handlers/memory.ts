import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
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
  var config = loadConfig();
  var project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === projectSlug; });
  if (!project) return null;
  var hash = "-" + project.path.replace(/\//g, "-").replace(/^-/, "");
  return join(homedir(), ".claude", "projects", hash, "memory");
}

function parseFrontmatter(content: string): { name: string; description: string; type: string } {
  var match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "", type: "" };
  var yaml = match[1];
  var name = "";
  var description = "";
  var type = "";
  var lines = yaml.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    var descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
    var typeMatch = line.match(/^type:\s*(.+)/);
    if (typeMatch) type = typeMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description, type };
}

function regenerateIndex(memoryDir: string): void {
  if (!existsSync(memoryDir)) return;
  var files = readdirSync(memoryDir).filter(function (f) {
    return f.endsWith(".md") && f !== "MEMORY.md";
  });

  var grouped: Record<string, Array<{ filename: string; name: string; description: string }>> = {};

  for (var i = 0; i < files.length; i++) {
    try {
      var content = readFileSync(join(memoryDir, files[i]), "utf-8");
      var meta = parseFrontmatter(content);
      var type = meta.type || "other";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ filename: files[i], name: meta.name || files[i], description: meta.description || "" });
    } catch {}
  }

  var lines: string[] = ["# Memory Index", ""];
  var types = Object.keys(grouped).sort();
  for (var t = 0; t < types.length; t++) {
    lines.push("## " + types[t].charAt(0).toUpperCase() + types[t].slice(1));
    var entries = grouped[types[t]];
    for (var e = 0; e < entries.length; e++) {
      var desc = entries[e].description ? " — " + entries[e].description : "";
      lines.push("- [" + entries[e].filename + "](" + entries[e].filename + ")" + desc);
    }
    lines.push("");
  }

  writeFileSync(join(memoryDir, "MEMORY.md"), lines.join("\n"), "utf-8");
}

registerHandler("memory", function (clientId: string, message: ClientMessage) {
  if (message.type === "memory:list") {
    var listMsg = message as { type: "memory:list"; projectSlug: string };
    var memDir = getMemoryDir(listMsg.projectSlug);
    if (!memDir || !existsSync(memDir)) {
      sendTo(clientId, { type: "memory:list_result", projectSlug: listMsg.projectSlug, memories: [] });
      return;
    }

    var files = readdirSync(memDir).filter(function (f) {
      return f.endsWith(".md") && f !== "MEMORY.md";
    });

    var memories: Array<{ filename: string; name: string; description: string; type: string }> = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var content = readFileSync(join(memDir, files[i]), "utf-8");
        var meta = parseFrontmatter(content);
        memories.push({
          filename: files[i],
          name: meta.name || files[i].replace(/\.md$/, ""),
          description: meta.description,
          type: meta.type || "other",
        });
      } catch {}
    }

    memories.sort(function (a, b) { return a.name.localeCompare(b.name); });
    sendTo(clientId, { type: "memory:list_result", projectSlug: listMsg.projectSlug, memories: memories });
    return;
  }

  if (message.type === "memory:view") {
    var viewMsg = message as { type: "memory:view"; projectSlug: string; filename: string };
    var viewDir = getMemoryDir(viewMsg.projectSlug);
    if (!viewDir) {
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: "Project not found." });
      return;
    }
    try {
      var viewContent = readFileSync(join(viewDir, viewMsg.filename), "utf-8");
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: viewContent });
    } catch {
      sendTo(clientId, { type: "memory:view_result", filename: viewMsg.filename, content: "File not found." });
    }
    return;
  }

  if (message.type === "memory:save") {
    var saveMsg = message as { type: "memory:save"; projectSlug: string; filename: string; content: string };
    var saveDir = getMemoryDir(saveMsg.projectSlug);
    if (!saveDir) {
      sendTo(clientId, { type: "memory:save_result", success: false, message: "Project not found." });
      return;
    }
    try {
      mkdirSync(saveDir, { recursive: true });
      writeFileSync(join(saveDir, saveMsg.filename), saveMsg.content, "utf-8");
      regenerateIndex(saveDir);
      sendTo(clientId, { type: "memory:save_result", success: true });
      var updatedFiles = readdirSync(saveDir).filter(function (f) { return f.endsWith(".md") && f !== "MEMORY.md"; });
      var updatedMemories: Array<{ filename: string; name: string; description: string; type: string }> = [];
      for (var j = 0; j < updatedFiles.length; j++) {
        try {
          var c = readFileSync(join(saveDir, updatedFiles[j]), "utf-8");
          var m = parseFrontmatter(c);
          updatedMemories.push({ filename: updatedFiles[j], name: m.name || updatedFiles[j].replace(/\.md$/, ""), description: m.description, type: m.type || "other" });
        } catch {}
      }
      updatedMemories.sort(function (a, b) { return a.name.localeCompare(b.name); });
      sendTo(clientId, { type: "memory:list_result", projectSlug: saveMsg.projectSlug, memories: updatedMemories });
    } catch (err) {
      sendTo(clientId, { type: "memory:save_result", success: false, message: "Failed to save: " + String(err) });
    }
    return;
  }

  if (message.type === "memory:delete") {
    var delMsg = message as { type: "memory:delete"; projectSlug: string; filename: string };
    var delDir = getMemoryDir(delMsg.projectSlug);
    if (!delDir) {
      sendTo(clientId, { type: "memory:delete_result", success: false, message: "Project not found." });
      return;
    }
    try {
      var filePath = join(delDir, delMsg.filename);
      if (!existsSync(filePath)) {
        sendTo(clientId, { type: "memory:delete_result", success: false, message: "Memory not found." });
        return;
      }
      unlinkSync(filePath);
      regenerateIndex(delDir);
      sendTo(clientId, { type: "memory:delete_result", success: true });
      var remainingFiles = readdirSync(delDir).filter(function (f) { return f.endsWith(".md") && f !== "MEMORY.md"; });
      var remainingMemories: Array<{ filename: string; name: string; description: string; type: string }> = [];
      for (var k = 0; k < remainingFiles.length; k++) {
        try {
          var rc = readFileSync(join(delDir, remainingFiles[k]), "utf-8");
          var rm = parseFrontmatter(rc);
          remainingMemories.push({ filename: remainingFiles[k], name: rm.name || remainingFiles[k].replace(/\.md$/, ""), description: rm.description, type: rm.type || "other" });
        } catch {}
      }
      remainingMemories.sort(function (a, b) { return a.name.localeCompare(b.name); });
      sendTo(clientId, { type: "memory:list_result", projectSlug: delMsg.projectSlug, memories: remainingMemories });
    } catch (err) {
      sendTo(clientId, { type: "memory:delete_result", success: false, message: "Failed to delete: " + String(err) });
    }
    return;
  }
});
