var JETBRAINS_IDS: Record<string, string> = {
  webstorm: "webstorm",
  intellij: "idea",
  pycharm: "pycharm",
  goland: "goland",
};

function toWindowsPath(linuxPath: string, wslDistro: string): string {
  return "\\\\" + "wsl.localhost\\" + wslDistro + linuxPath.replace(/\//g, "\\");
}

function buildJetBrainsUrl(ideId: string, filePath: string, line?: number, projectName?: string): string {
  var url = "jetbrains://" + ideId + "/navigate/reference?";
  if (projectName) {
    url += "project=" + encodeURIComponent(projectName);
  }
  if (filePath) {
    url += (projectName ? "&" : "") + "path=" + encodeURIComponent(filePath);
    if (line) {
      url += "&line=" + line;
    }
  }
  return url;
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
    if (ideProjectName) {
      var jbPath = filePath === "." ? "" : filePath;
      return buildJetBrainsUrl(jetbrainsId, jbPath, line, ideProjectName);
    }
    return buildJetBrainsUrl(jetbrainsId, resolvedPath, line);
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
