export type ProjectIcon =
  | { type: "lucide"; name: string }
  | { type: "emoji"; value: string }
  | { type: "text"; value: string; color?: string }
  | { type: "image"; path: string };

export type ThinkingConfig =
  | { type: "adaptive" }
  | { type: "enabled"; budgetTokens?: number }
  | { type: "disabled" };

export type McpServerConfig =
  | { type?: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> };

export type ProjectSettingsSection =
  | "general" | "claude" | "environment" | "mcp" | "skills" | "rules" | "permissions" | "memory" | "notifications";

export interface ProjectSettings {
  title: string;
  path: string;
  icon?: ProjectIcon;
  claudeMd: string;
  defaultModel?: string;
  defaultEffort?: string;
  thinking?: ThinkingConfig;
  permissionMode?: string;
  permissions: { allow: string[]; deny: string[] };
  env: Record<string, string>;
  mcpServers: Record<string, McpServerConfig>;
  rules: Array<{ filename: string; content: string }>;
  skills: Array<{ name: string; description: string; path: string }>;
  global: {
    claudeMd: string;
    defaultModel: string;
    defaultEffort: string;
    thinking?: ThinkingConfig;
    env: Record<string, string>;
    permissions: { allow: string[]; deny: string[] };
    rules: Array<{ filename: string; content: string }>;
    mcpServers: Record<string, McpServerConfig>;
    skills: Array<{ name: string; description: string; path: string }>;
  };
}
