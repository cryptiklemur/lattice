import type { ProjectIcon } from "./project-settings.js";

export interface NodeInfo {
  id: string;
  name: string;
  address: string;
  addresses: string[];
  port: number;
  online: boolean;
  isLocal: boolean;
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  slug: string;
  path: string;
  title: string;
  nodeId: string;
}

export interface ProjectInfo extends ProjectSummary {
  nodeName: string;
  isRemote: boolean;
  online?: boolean;
  ideProjectName?: string;
}

export interface SessionSummary {
  id: string;
  projectSlug: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface SessionPreview {
  sessionId: string;
  cost: number;
  durationMs: number;
  messageCount: number;
  model: string;
  lastMessage: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
}

export interface Attachment {
  type: "file" | "image" | "paste";
  name: string;
  content: string;
  mimeType?: string;
  size: number;
  lineCount?: number;
}

export type HistoryMessageType = "user" | "assistant" | "tool_start" | "tool_result" | "permission_request" | "prompt_question" | "todo_update";

export interface HistoryMessage {
  type: HistoryMessageType;
  uuid?: string;
  text?: string;
  toolId?: string;
  name?: string;
  args?: string;
  content?: string;
  timestamp: number;
  title?: string;
  decisionReason?: string;
  permissionStatus?: "pending" | "allowed" | "denied" | "always_allowed";
  permissionRule?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  costEstimate?: number;
  duration?: number;
  promptQuestions?: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string; preview?: string }>;
    multiSelect: boolean;
  }>;
  promptAnswers?: Record<string, string>;
  promptStatus?: "pending" | "answered" | "timed_out";
  todos?: Array<{
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed";
    priority: "high" | "medium" | "low";
  }>;
}

export interface PeerInfo {
  id: string;
  name: string;
  addresses: string[];
  publicKey: string;
  pairedAt: number;
}

export interface LatticeConfig {
  port: number;
  name: string;
  passphraseHash?: string;
  tls: boolean;
  debug: boolean;
  globalEnv: Record<string, string>;
  projects: Array<{
    path: string;
    slug: string;
    title: string;
    env: Record<string, string>;
    icon?: ProjectIcon;
  }>;
  editor?: {
    type: "vscode" | "vscode-insiders" | "cursor" | "webstorm" | "intellij" | "pycharm" | "goland" | "notepad++" | "sublime" | "custom";
    paths?: Record<string, string>;
    customCommand?: string;
  };
  setupComplete?: boolean;
  wsl?: boolean | "auto";
  costBudget?: {
    dailyLimit: number;
    enforcement: "warning" | "soft-block" | "hard-block";
  };
}

export interface StickyNote {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  projectSlug?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  projectSlug: string;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
}

export interface MarketplaceSkill {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
}

export interface MessageBookmark {
  id: string;
  sessionId: string;
  projectSlug: string;
  messageUuid: string;
  messageText: string;
  messageType: "user" | "assistant";
  createdAt: number;
}

export interface LoopStatus {
  id: string;
  projectSlug: string;
  status: "idle" | "running" | "done" | "stopped" | "error";
  iteration: number;
  maxIterations: number;
  judgeReason: string | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface PluginInfo {
  name: string;
  marketplace: string;
  key: string;
  version: string;
  scope: string;
  installPath: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha: string;
  description: string;
  skillCount: number;
  hookCount: number;
  ruleCount: number;
  installs?: number;
}

export interface PluginMarketplaceInfo {
  name: string;
  source: { source: string; repo: string };
  installLocation: string;
  lastUpdated: string;
}

export interface PluginDetails {
  name: string;
  marketplace: string;
  version: string;
  description: string;
  author?: { name: string; email?: string };
  homepage?: string;
  license?: string;
  keywords?: string[];
  skills: Array<{ name: string; description: string }>;
  hooks: Record<string, unknown>;
  rules: string[];
  installPath: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha: string;
}

export interface PluginError {
  key: string;
  name: string;
  marketplace: string;
  errors: string[];
}

export interface MarketplacePluginEntry {
  name: string;
  marketplace: string;
  description: string;
  author?: { name: string; email?: string };
  installed: boolean;
  installedVersion?: string;
  installs?: number;
}

