import type { ProjectIcon } from "./project-settings.js";

export interface NodeInfo {
  id: string;
  name: string;
  address: string;
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
}

export interface SessionSummary {
  id: string;
  projectSlug: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount?: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number;
}

export interface Attachment {
  type: "file" | "image";
  name: string;
  content: string;
}

export interface HistoryMessage {
  type: string;
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

