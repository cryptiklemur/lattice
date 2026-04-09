export type CommandHandler = "client" | "passthrough";

export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: string;
  category: "command" | "skill";
  handler: CommandHandler;
}

export const builtinCommands: SlashCommand[] = [
  { name: "clear", description: "Clear conversation, start new session", aliases: ["reset", "new"], category: "command", handler: "client" },
  { name: "compact", description: "Compact conversation context", args: "[instructions]", category: "command", handler: "passthrough" },
  { name: "cost", description: "Show token usage and estimated cost", category: "command", handler: "client" },
  { name: "model", description: "Switch Claude model", args: "[model]", category: "command", handler: "client" },
  { name: "effort", description: "Set effort level", args: "[low|medium|high|max]", category: "command", handler: "client" },
  { name: "help", description: "Show available commands", category: "command", handler: "client" },
  { name: "fast", description: "Toggle fast mode", args: "[on|off]", category: "command", handler: "client" },
  { name: "copy", description: "Copy last assistant response", category: "command", handler: "client" },
  { name: "export", description: "Export conversation as text file", category: "command", handler: "client" },
  { name: "rename", description: "Rename current session", args: "[name]", category: "command", handler: "client" },
  { name: "context", description: "Show context breakdown", category: "command", handler: "client" },
  { name: "theme", description: "Open appearance settings", category: "command", handler: "client" },
  { name: "config", description: "Open settings", aliases: ["settings"], category: "command", handler: "client" },
  { name: "permissions", description: "Open permissions settings", aliases: ["allowed-tools"], category: "command", handler: "client" },
  { name: "memory", description: "Open memory settings", category: "command", handler: "client" },
  { name: "skills", description: "Open skills settings", category: "command", handler: "client" },
  { name: "plan", description: "Enter plan mode", category: "command", handler: "client" },
  { name: "diff", description: "Show last git diff", category: "command", handler: "passthrough" },
  { name: "init", description: "Generate CLAUDE.md", category: "command", handler: "passthrough" },
  { name: "review", description: "Review code", category: "command", handler: "passthrough" },
  { name: "pr-comments", description: "Fetch PR comments", args: "[PR]", category: "command", handler: "passthrough" },
  { name: "security-review", description: "Security review of recent changes", category: "command", handler: "passthrough" },
  { name: "btw", description: "Ask a side question", args: "<question>", category: "command", handler: "passthrough" },
];
