export function formatToolSummary(name: string, argsStr: string): string {
  try {
    const args = JSON.parse(argsStr);
    if (name === "Read" && args.file_path) return args.file_path;
    if (name === "Write" && args.file_path) return args.file_path;
    if (name === "Edit" && args.file_path) return args.file_path;
    if (name === "MultiEdit" && args.file_path) return args.file_path;
    if (name === "Grep" && args.pattern) return args.pattern + (args.path ? " in " + args.path : "");
    if (name === "Glob" && args.pattern) return args.pattern + (args.path ? " in " + args.path : "");
    if (name === "Bash" && (args.command || args.description)) {
      const cmd = args.description || args.command;
      return cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
    }
    if (name === "LS" && args.path) return args.path;
    if (name === "Agent" && args.description) return args.description;
    if (name === "Skill" && args.skill) return args.skill;
    if (name === "NotebookEdit" && args.file_path) return args.file_path;
    if (name === "WebSearch" && args.query) return args.query;
    if (name === "WebFetch" && args.url) return args.url.length > 60 ? args.url.slice(0, 57) + "..." : args.url;
    if (name === "TodoWrite" || name === "TaskCreate" || name === "TaskUpdate") {
      if (args.description) return args.description.length > 50 ? args.description.slice(0, 47) + "..." : args.description;
    }
    if (name.startsWith("mcp__playwright__")) {
      const short = name.replace("mcp__playwright__browser_", "");
      if (args.url) return short + " " + args.url;
      if (args.element) return short + " " + args.element;
      if (args.filename) return short + " → " + args.filename;
      return short;
    }
    if (name.startsWith("mcp__")) {
      const parts = name.split("__");
      return parts.length >= 3 ? parts.slice(2).join(".") : name;
    }
    if (args.file_path) return args.file_path;
    if (args.path) return args.path;
    if (args.query) return args.query;
    return "";
  } catch {
    return "";
  }
}
