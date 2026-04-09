export const JETBRAINS_IDS: Record<string, string> = {
  webstorm: "web-storm",
  intellij: "idea",
  pycharm: "py-charm",
  goland: "go-land",
};

function toWindowsPath(linuxPath: string, wslDistro: string): string {
  return "\\\\" + "wsl.localhost\\" + wslDistro + linuxPath.replace(/\//g, "\\");
}

function buildJetBrainsUrl(ideId: string, relativePath: string, line?: number, projectName?: string): string {
  const url = "jetbrains://" + ideId + "/navigate/reference?";
  const params: string[] = [];
  if (projectName) {
    params.push("project=" + encodeURIComponent(projectName));
  }
  if (relativePath) {
    params.push("path=" + encodeURIComponent(relativePath));
  }
  if (line) {
    params.push("line=" + String(line));
  }
  return url + params.join("&");
}

export function isJetBrainsEditor(editorType: string): boolean {
  return editorType in JETBRAINS_IDS;
}

export function getEditorUrl(editorType: string, projectPath: string, filePath: string, line?: number, wslDistro?: string, ideProjectName?: string): string | null {
  const fullPath = filePath === "." ? projectPath : projectPath + "/" + filePath;
  const resolvedPath = wslDistro ? toWindowsPath(fullPath, wslDistro) : fullPath;

  const jetbrainsId = JETBRAINS_IDS[editorType];
  if (jetbrainsId) {
    const jbRelativePath = filePath === "." ? "" : filePath;
    return buildJetBrainsUrl(jetbrainsId, jbRelativePath, line, ideProjectName || undefined);
  }

  if (editorType === "vscode" || editorType === "vscode-insiders" || editorType === "cursor") {
    const scheme = editorType;
    const isFile = filePath !== ".";
    const lineSuffix = isFile ? ":" + (line || 1) : "";
    if (wslDistro) {
      return scheme + "://vscode-remote/wsl+" + wslDistro + fullPath + lineSuffix;
    }
    return scheme + "://file/" + resolvedPath + lineSuffix;
  }
  if (editorType === "sublime") {
    return "subl://open?url=file://" + encodeURIComponent(resolvedPath) + (line ? "&line=" + line : "");
  }

  return null;
}
