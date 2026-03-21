var URL_SCHEMES: Record<string, (path: string, line?: number) => string> = {
  vscode: function (path, line) {
    return "vscode://file" + path + (line ? ":" + line : "");
  },
  "vscode-insiders": function (path, line) {
    return "vscode-insiders://file" + path + (line ? ":" + line : "");
  },
  cursor: function (path, line) {
    return "cursor://file" + path + (line ? ":" + line : "");
  },
  webstorm: function (path, line) {
    return "jetbrains://webstorm/navigate/reference?path=" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
  intellij: function (path, line) {
    return "jetbrains://idea/navigate/reference?path=" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
  pycharm: function (path, line) {
    return "jetbrains://pycharm/navigate/reference?path=" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
  goland: function (path, line) {
    return "jetbrains://goland/navigate/reference?path=" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
  "notepad++": function (path, line) {
    return "notepad++://open?path=" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
  sublime: function (path, line) {
    return "subl://open?url=file://" + encodeURIComponent(path) + (line ? "&line=" + line : "");
  },
};

export function getEditorUrl(editorType: string, projectPath: string, filePath: string, line?: number): string | null {
  var generator = URL_SCHEMES[editorType];
  if (!generator) return null;

  var fullPath = filePath === "." ? projectPath : projectPath + "/" + filePath;
  return generator(fullPath, line);
}
