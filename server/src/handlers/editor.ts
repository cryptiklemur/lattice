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
  "webstorm": ["webstorm"],
  "intellij": ["idea"],
  "pycharm": ["pycharm"],
  "goland": ["goland"],
  "notepad++": ["notepad++"],
  "sublime": ["subl"],
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
  var active = getActiveSession(clientId);
  if (!active) return;

  var project = getProjectBySlug(active.projectSlug);
  if (!project) return;

  var fullPath = join(project.path, msg.path);
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

  var lineArg = msg.line ? ":" + msg.line : "";

  var args: string[] = [];
  if (editorType === "vscode" || editorType === "vscode-insiders" || editorType === "cursor") {
    args = ["-g", fullPath + lineArg];
  } else if (editorType === "sublime") {
    args = [fullPath + lineArg];
  } else if (editorType === "notepad++") {
    args = ["-n" + String(msg.line || 1), fullPath];
  } else {
    args = ["--line", String(msg.line || 1), fullPath];
  }

  spawn(executable, args, { detached: true, stdio: "ignore" }).unref();
});
