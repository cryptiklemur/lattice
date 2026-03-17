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
  messageCount: number;
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
  }>;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  variant: "dark" | "light";
  colors: Record<string, string>;
}

export interface StickyNote {
  id: string;
  content: string;
  createdAt: number;
  updatedAt: number;
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

export interface LoopRun {
  startedAt: number;
  finishedAt: number;
  result: string;
  iterations: number;
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

export interface ImportableSession {
  id: string;
  title: string;
  context: string;
  createdAt: number;
  messageCount: number;
  alreadyImported: boolean;
}
