var JETBRAINS_IDS: Record<string, string> = {
  webstorm: "web-storm",
  intellij: "idea",
  pycharm: "py-charm",
  goland: "go-land",
};

function toWindowsPath(linuxPath: string, wslDistro: string): string {
  return "\\\\" + "wsl.localhost\\" + wslDistro + linuxPath.replace(/\//g, "\\");
}

function buildJetBrainsUrl(ideId: string, relativePath: string, line?: number, projectName?: string, projectRoot?: string): string {
  var url = "jetbrains://" + ideId + "/navigate/reference?";
  var params: string[] = [];
  if (projectName) {
    params.push("project=" + encodeURIComponent(projectName));
  } else if (projectRoot) {
    params.push("origin=" + encodeURIComponent(projectRoot));
  }
  if (relativePath) {
    params.push("path=" + encodeURIComponent(relativePath));
  }
  if (line) {
    params.push("line=" + String(line));
  }
  return url + params.join("&");
}

export interface EditorUrlOptions {
  editorType: string;
  projectPath: string;
  filePath: string;
  line?: number;
  wslDistro?: string;
  ideProjectName?: string;
}

export function getEditorUrl(editorType: string, projectPath: string, filePath: string, line?: number, wslDistro?: string, ideProjectName?: string): string | null {
  var fullPath = filePath === "." ? projectPath : projectPath + "/" + filePath;
  var resolvedPath = wslDistro ? toWindowsPath(fullPath, wslDistro) : fullPath;

  var jetbrainsId = JETBRAINS_IDS[editorType];
  if (jetbrainsId) {
    var jbRelativePath = filePath === "." ? "" : filePath;
    var jbProjectRoot = wslDistro ? toWindowsPath(projectPath, wslDistro) : projectPath;
    return buildJetBrainsUrl(jetbrainsId, jbRelativePath, line, ideProjectName || undefined, ideProjectName ? undefined : jbProjectRoot);
  }

  if (editorType === "vscode" || editorType === "vscode-insiders" || editorType === "cursor") {
    var scheme = editorType;
    var isFile = filePath !== ".";
    var lineSuffix = isFile ? ":" + (line || 1) : "";
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
