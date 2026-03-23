export function formatSessionTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  if (title.startsWith("<skill-name>")) {
    var endTag = title.indexOf("</skill-name>");
    if (endTag !== -1) {
      return "/" + title.slice(12, endTag);
    }
  }
  var firstNewline = title.search(/\r?\n/);
  if (firstNewline !== -1) {
    var firstLine = title.slice(0, firstNewline).trim();
    if (firstLine.indexOf(":") !== -1 && /\n---[\r\n]/.test(title)) {
      return "/" + firstLine;
    }
  }
  return title;
}
