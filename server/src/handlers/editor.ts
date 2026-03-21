import { execSync } from "node:child_process";
import type { ClientMessage, EditorDetectMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";

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
});
