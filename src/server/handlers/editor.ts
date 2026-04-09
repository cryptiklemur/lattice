import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ClientMessage, EditorDetectMessage, EditorEnsureProjectMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { loadConfig } from "../config";
import { loadOrCreateIdentity } from "../identity";
import { broadcast } from "../ws/broadcast";
import { detectIdeProjectName } from "./settings";

const binaryNames: Record<string, string[]> = {
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
  const names = binaryNames[editorType];
  if (!names) return null;

  for (let i = 0; i < names.length; i++) {
    try {
      const result = execSync("which " + names[i], { encoding: "utf-8", timeout: 3000 }).trim();
      if (result) return result;
    } catch {
      // not found
    }
  }
  return null;
}

function ensureIdeaProject(projectPath: string, projectTitle: string): string {
  const ideaDir = join(projectPath, ".idea");
  if (!existsSync(ideaDir)) {
    mkdirSync(ideaDir, { recursive: true });
  }
  const nameFile = join(ideaDir, ".name");
  if (!existsSync(nameFile)) {
    writeFileSync(nameFile, projectTitle, "utf-8");
  }
  return projectTitle;
}

registerHandler("editor", function (clientId: string, message: ClientMessage) {
  if (message.type === "editor:detect") {
    const detectMsg = message as EditorDetectMessage;
    const detectedPath = detectEditorPath(detectMsg.editorType);
    sendTo(clientId, { type: "editor:detect_result", editorType: detectMsg.editorType, path: detectedPath });
    return;
  }

  if (message.type === "editor:ensure-project") {
    const ensureMsg = message as EditorEnsureProjectMessage;
    const config = loadConfig();
    const project = config.projects.find(function (p: typeof config.projects[number]) { return p.slug === ensureMsg.projectSlug; });
    if (project) {
      const name = ensureIdeaProject(project.path, project.title);
      sendTo(clientId, { type: "editor:ensure-project_result", projectSlug: ensureMsg.projectSlug, ideProjectName: name });
      const identity = loadOrCreateIdentity();
      broadcast({
        type: "projects:list",
        projects: config.projects.map(function (p: typeof config.projects[number]) {
          return { slug: p.slug, path: p.path, title: p.title, nodeId: identity.id, nodeName: config.name, isRemote: false, ideProjectName: detectIdeProjectName(p.path) };
        }),
      });
    }
    return;
  }
});
