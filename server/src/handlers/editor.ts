import { exec, execSync, spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ClientMessage, EditorDetectMessage, EditorOpenMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { getActiveSession } from "./chat";

var autoDetectedWSL: boolean | null = null;

function detectWSL(): boolean {
  if (autoDetectedWSL !== null) return autoDetectedWSL;
  try {
    if (existsSync("/proc/version")) {
      var version = execSync("cat /proc/version", { encoding: "utf-8" });
      autoDetectedWSL = version.toLowerCase().includes("microsoft");
    } else {
      autoDetectedWSL = false;
    }
  } catch {
    autoDetectedWSL = false;
  }
  return autoDetectedWSL;
}

function isWSLEnabled(): boolean {
  var config = loadConfig();
  var wslSetting = config.wsl;
  if (wslSetting === true) return true;
  if (wslSetting === false) return false;
  return detectWSL();
}

function toEditorPath(linuxPath: string): string {
  if (!isWSLEnabled()) return linuxPath;
  try {
    return execSync("wslpath -w " + JSON.stringify(linuxPath), { encoding: "utf-8", timeout: 3000 }).trim();
  } catch {
    return linuxPath;
  }
}

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

  console.log("[editor] Received editor:open:", JSON.stringify(message));
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
    var customFilePath = toEditorPath(fullPath);
    var expanded = editorConfig.customCommand
      .replace(/\{file\}/g, customFilePath)
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
  if (!executable) {
    console.warn("[editor] No executable found for " + editorType);
    return;
  }

  var editorFilePath = fullPath;
  var args: string[] = [];
  if (editorType === "vscode" || editorType === "vscode-insiders" || editorType === "cursor") {
    if (msg.line) {
      args = ["-g", editorFilePath + ":" + msg.line];
    } else {
      args = [editorFilePath];
    }
  } else if (editorType === "sublime") {
    args = msg.line ? [editorFilePath + ":" + msg.line] : [editorFilePath];
  } else if (editorType === "notepad++") {
    args = msg.line ? ["-n" + msg.line, editorFilePath] : [editorFilePath];
  } else {
    args = msg.line ? ["--line", String(msg.line), editorFilePath] : [editorFilePath];
  }

  function shellEscape(s: string): string {
    return "'" + s.replace(/'/g, "'\\''") + "'";
  }
  var cmd = shellEscape(executable) + " " + args.map(shellEscape).join(" ");
  console.log("[editor] exec: " + cmd);

  exec("echo EXEC_WORKS", function (testErr, testOut) {
    console.log("[editor] exec test: err=" + testErr + " out=" + (testOut || "").trim());
  });

  exec(cmd, { env: process.env }, function (err, stdout, stderr) {
    console.log("[editor] exec callback fired");
    if (err) console.error("[editor] exec error: " + err.message);
    if (stdout) console.log("[editor] stdout: " + stdout.trim());
    if (stderr) console.error("[editor] stderr: " + stderr.trim());
    if (!err && !stdout && !stderr) console.log("[editor] exec completed with no output");
  });
});
