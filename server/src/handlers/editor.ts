import { exec, execSync, spawn } from "node:child_process";
import { join } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
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
  var scriptLines = ["#!/bin/bash"];

  if (isWSLEnabled()) {
    for (var ai = 0; ai < args.length; ai++) {
      if (args[ai].startsWith("/") && !args[ai].startsWith("/mnt/")) {
        scriptLines.push("ARG" + ai + '="$(wslpath -w \'' + args[ai].replace(/'/g, "'\\''") + '\')"');
        args[ai] = "$ARG" + ai;
      }
    }
  }

  var quotedArgs = args.map(function (a) {
    if (a.startsWith("$ARG")) return '"' + a + '"';
    return "'" + a.replace(/'/g, "'\\''") + "'";
  }).join(" ");

  scriptLines.push("'" + executable.replace(/'/g, "'\\''") + "' " + quotedArgs);

  var script = scriptLines.join("\n");
  var tmpFile = "/tmp/lattice-editor-" + Date.now() + ".sh";
  writeFileSync(tmpFile, script, { mode: 0o755 });
  console.log("[editor] Script: " + tmpFile);
  console.log("[editor] Content: " + script.replace(/\n/g, " | "));

  Bun.spawn(["bash", tmpFile], { stdout: "ignore", stderr: "ignore" });

  setTimeout(function () {
    try { unlinkSync(tmpFile); } catch {}
  }, 5000);
});
