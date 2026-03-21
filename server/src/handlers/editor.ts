import { execSync, spawn } from "node:child_process";
import { join } from "node:path";
import type { ClientMessage, EditorDetectMessage, EditorOpenMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { getActiveSession } from "./chat";

var binaryNames: Record<string, string[]> = {
  "vscode": ["code"],
  "vscode-insiders": ["code-insiders"],
  "cursor": ["cursor"],
  "webstorm": ["webstorm", "webstorm.sh", "wstorm"],
  "intellij": ["idea", "idea.sh"],
  "pycharm": ["pycharm", "pycharm.sh", "charm"],
  "goland": ["goland", "goland.sh"],
  "notepad++": ["notepad++"],
  "sublime": ["subl", "sublime_text"],
};

function detectEditorPath(editorType: string): string | null {
  var names = binaryNames[editorType];
  if (!names) return null;

  for (var i = 0; i < names.length; i++) {
    try {
      var result = execSync("which " + names[i], { encoding: "utf-8", timeout: 3000 }).trim();
      if (result) return result;
    } catch {
      // not found
    }
  }
  return null;
}

registerHandler("editor", function (clientId: string, message: ClientMessage) {
  if (message.type === "editor:detect") {
    var detectMsg = message as EditorDetectMessage;
    var detectedPath = detectEditorPath(detectMsg.editorType);
    sendTo(clientId, { type: "editor:detect_result", editorType: detectMsg.editorType, path: detectedPath });
    return;
  }

  if (message.type !== "editor:open") return;

  var msg = message as EditorOpenMessage;

  var projectSlug = msg.projectSlug || null;
  if (!projectSlug) {
    var active = getActiveSession(clientId);
    if (active) projectSlug = active.projectSlug;
  }
  if (!projectSlug) {
    console.warn("[editor] No project context for editor:open");
    return;
  }

  var project = getProjectBySlug(projectSlug);
  if (!project) {
    console.warn("[editor] Project not found: " + projectSlug);
    return;
  }

  var fullPath = msg.path === "." ? project.path : join(project.path, msg.path);
  var config = loadConfig();
  var editorConfig = config.editor;
  var editorType = editorConfig?.type || "vscode";

  if (editorType === "custom" && editorConfig?.customCommand) {
    var expanded = editorConfig.customCommand
      .replace(/\{file\}/g, fullPath)
      .replace(/\{line\}/g, String(msg.line || 1));
    try {
      execSync(expanded, { stdio: "ignore", timeout: 5000 });
    } catch {
      // command failed silently
    }
    return;
  }

  var executable = editorConfig?.paths?.[editorType] || null;
  if (!executable) {
    executable = detectEditorPath(editorType) || "";
  }
  if (!executable) return;

  var args: string[] = [];
  if (editorType === "vscode" || editorType === "vscode-insiders" || editorType === "cursor") {
    if (msg.line) {
      args = ["-g", fullPath + ":" + msg.line];
    } else {
      args = [fullPath];
    }
  } else if (editorType === "sublime") {
    args = msg.line ? [fullPath + ":" + msg.line] : [fullPath];
  } else if (editorType === "notepad++") {
    args = msg.line ? ["-n" + msg.line, fullPath] : [fullPath];
  } else {
    // JetBrains IDEs (webstorm, intellij, pycharm, goland)
    args = msg.line ? ["--line", String(msg.line), fullPath] : [fullPath];
  }

  try {
    spawn(executable, args, { detached: true, stdio: "ignore" }).unref();
  } catch (err) {
    console.error("[editor] Failed to spawn " + executable + ": " + (err instanceof Error ? err.message : String(err)));
  }
});
