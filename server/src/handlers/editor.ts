import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ClientMessage, EditorOpenMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { getProjectBySlug } from "../project/registry";
import { loadConfig } from "../config";
import { getActiveSession } from "./chat";

registerHandler("editor", function (clientId: string, message: ClientMessage) {
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

  var commands: Record<string, string[]> = {
    "vscode": ["code", "-g"],
    "vscode-insiders": ["code-insiders", "-g"],
    "cursor": ["cursor", "-g"],
    "webstorm": ["webstorm", "--line"],
    "intellij": ["idea", "--line"],
    "pycharm": ["pycharm", "--line"],
    "goland": ["goland", "--line"],
    "notepad++": ["notepad++", "-n"],
    "sublime": ["subl"],
  };

  var lineArg = msg.line ? ":" + msg.line : "";
  var cmdParts = commands[editorType];

  if (editorType === "custom" && editorConfig?.customCommand) {
    var expanded = editorConfig.customCommand
      .replace("{file}", fullPath)
      .replace("{line}", String(msg.line || 1));
    var parts = expanded.split(/\s+/);
    spawn(parts[0], parts.slice(1), { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (!cmdParts) return;
  var args = [...cmdParts.slice(1), fullPath + lineArg];
  spawn(cmdParts[0], args, { detached: true, stdio: "ignore" }).unref();
});
