export function formatSessionTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  if (title.startsWith("<skill-name>")) {
    const endTag = title.indexOf("</skill-name>");
    if (endTag !== -1) {
      return "/" + title.slice(12, endTag);
    }
  }
  const firstNewline = title.search(/\r?\n/);
  if (firstNewline !== -1) {
    const firstLine = title.slice(0, firstNewline).trim();
    if (firstLine.indexOf(":") !== -1 && /\n---[\r\n]/.test(title)) {
      return "/" + firstLine;
    }
  }
  return title;
}
