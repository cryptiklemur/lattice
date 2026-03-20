import type {
  Attachment,
  FileEntry,
  HistoryMessage,
  LatticeConfig,
  LoopStatus,
  MarketplaceSkill,
  NodeInfo,
  ProjectInfo,
  ScheduledTask,
  SessionSummary,
  SkillInfo,
  StickyNote,
} from "./models.js";
import type { McpServerConfig, ProjectSettings } from "./project-settings.js";

export interface SessionCreateMessage {
  type: "session:create";
  projectSlug: string;
}

export interface SessionActivateMessage {
  type: "session:activate";
  projectSlug: string;
  sessionId: string;
}

export interface SessionRenameMessage {
  type: "session:rename";
  sessionId: string;
  title: string;
}

export interface SessionDeleteMessage {
  type: "session:delete";
  sessionId: string;
}

export interface SessionListRequestMessage {
  type: "session:list_request";
  projectSlug: string;
}

export interface ChatSendMessage {
  type: "chat:send";
  text: string;
  attachments?: Attachment[];
  model?: string;
  effort?: string;
}

export interface ChatPermissionResponseMessage {
  type: "chat:permission_response";
  requestId: string;
  allow: boolean;
  alwaysAllow?: boolean;
  alwaysAllowScope?: "session" | "project";
}

export interface ChatRewindMessage {
  type: "chat:rewind";
  messageUuid: string;
}

export interface ChatCancelMessage {
  type: "chat:cancel";
}

export interface ChatSetPermissionModeMessage {
  type: "chat:set_permission_mode";
  mode: "default" | "acceptEdits" | "plan" | "dontAsk";
}

export interface FsListMessage {
  type: "fs:list";
  path: string;
}

export interface FsReadMessage {
  type: "fs:read";
  path: string;
}

export interface FsWriteMessage {
  type: "fs:write";
  path: string;
  content: string;
}

export interface TerminalCreateMessage {
  type: "terminal:create";
}

export interface TerminalInputMessage {
  type: "terminal:input";
  termId: string;
  data: string;
}

export interface TerminalResizeMessage {
  type: "terminal:resize";
  termId: string;
  cols: number;
  rows: number;
}

export interface SettingsGetMessage {
  type: "settings:get";
}

export interface SettingsUpdateMessage {
  type: "settings:update";
  settings: Partial<LatticeConfig>;
}

export interface SettingsRestartMessage {
  type: "settings:restart";
}

export interface MeshPairMessage {
  type: "mesh:pair";
  code: string;
}

export interface MeshGenerateInviteMessage {
  type: "mesh:generate_invite";
}

export interface MeshUnpairMessage {
  type: "mesh:unpair";
  nodeId: string;
}

export interface LoopStartMessage {
  type: "loop:start";
  projectSlug: string;
}

export interface LoopStopMessage {
  type: "loop:stop";
  loopId: string;
}

export interface LoopStatusRequestMessage {
  type: "loop:status";
  loopId: string;
}

export interface SchedulerListMessage {
  type: "scheduler:list";
}

export interface SchedulerCreateMessage {
  type: "scheduler:create";
  name: string;
  prompt: string;
  cron: string;
  projectSlug: string;
}

export interface SchedulerDeleteMessage {
  type: "scheduler:delete";
  taskId: string;
}

export interface SchedulerToggleMessage {
  type: "scheduler:toggle";
  taskId: string;
}

export interface NotesListMessage {
  type: "notes:list";
}

export interface NotesCreateMessage {
  type: "notes:create";
  content: string;
}

export interface NotesUpdateMessage {
  type: "notes:update";
  id: string;
  content: string;
}

export interface NotesDeleteMessage {
  type: "notes:delete";
  id: string;
}

export interface SkillsListRequestMessage {
  type: "skills:list_request";
}

export interface SessionListAllRequestMessage {
  type: "session:list_all_request";
}

export interface SkillsSearchMessage {
  type: "skills:search";
  query: string;
}

export interface SkillsInstallMessage {
  type: "skills:install";
  source: string;
  scope: "global" | "project";
  projectSlug?: string;
}

export interface SkillsViewMessage {
  type: "skills:view";
  path: string;
}

export interface SkillsDeleteMessage {
  type: "skills:delete";
  path: string;
}

export interface SkillsUpdateMessage {
  type: "skills:update";
  source: string;
}

export interface BrowseListMessage {
  type: "browse:list";
  path: string;
}

export interface ProjectSettingsGetMessage {
  type: "project-settings:get";
  projectSlug: string;
}

export interface ProjectSettingsUpdateMessage {
  type: "project-settings:update";
  projectSlug: string;
  section: string;
  settings: Record<string, unknown>;
}

export interface ProjectSettingsDataMessage {
  type: "project-settings:data";
  projectSlug: string;
  settings: ProjectSettings;
}

export interface ProjectSettingsErrorMessage {
  type: "project-settings:error";
  projectSlug: string;
  message: string;
}

export type ClientMessage =
  | SessionCreateMessage
  | SessionActivateMessage
  | SessionRenameMessage
  | SessionDeleteMessage
  | SessionListRequestMessage
  | ChatSendMessage
  | ChatPermissionResponseMessage
  | ChatRewindMessage
  | ChatCancelMessage
  | FsListMessage
  | FsReadMessage
  | FsWriteMessage
  | TerminalCreateMessage
  | TerminalInputMessage
  | TerminalResizeMessage
  | SettingsGetMessage
  | SettingsUpdateMessage
  | SettingsRestartMessage
  | MeshPairMessage
  | MeshGenerateInviteMessage
  | MeshUnpairMessage
  | LoopStartMessage
  | LoopStopMessage
  | LoopStatusRequestMessage
  | SchedulerListMessage
  | SchedulerCreateMessage
  | SchedulerDeleteMessage
  | SchedulerToggleMessage
  | NotesListMessage
  | NotesCreateMessage
  | NotesUpdateMessage
  | NotesDeleteMessage
  | SkillsListRequestMessage
  | ChatSetPermissionModeMessage
  | ProjectSettingsGetMessage
  | ProjectSettingsUpdateMessage
  | SessionListAllRequestMessage
  | SkillsSearchMessage
  | SkillsInstallMessage
  | SkillsViewMessage
  | SkillsDeleteMessage
  | SkillsUpdateMessage
  | BrowseListMessage;

export interface SessionListMessage {
  type: "session:list";
  projectSlug: string;
  sessions: SessionSummary[];
}

export interface SessionCreatedMessage {
  type: "session:created";
  session: SessionSummary;
}

export interface SessionHistoryMessage {
  type: "session:history";
  projectSlug: string;
  sessionId: string;
  messages: HistoryMessage[];
  title?: string;
  interrupted?: boolean;
}

export interface ChatUserMessage {
  type: "chat:user_message";
  text: string;
  uuid: string;
}

export interface ChatDeltaMessage {
  type: "chat:delta";
  text: string;
}

export interface ChatToolStartMessage {
  type: "chat:tool_start";
  toolId: string;
  name: string;
  args: string;
}

export interface ChatToolResultMessage {
  type: "chat:tool_result";
  toolId: string;
  content: string;
}

export interface ChatDoneMessage {
  type: "chat:done";
  cost: number;
  duration: number;
}

export interface ChatErrorMessage {
  type: "chat:error";
  message: string;
}

export interface ChatPermissionRequestMessage {
  type: "chat:permission_request";
  requestId: string;
  tool: string;
  args: string;
  title?: string;
  decisionReason?: string;
  permissionRule?: string;
}

export interface ChatPermissionResolvedMessage {
  type: "chat:permission_resolved";
  requestId: string;
  status: "allowed" | "denied" | "always_allowed";
}

export interface ChatStatusMessage {
  type: "chat:status";
  phase: "thinking" | "tool_call" | "tool_result";
  toolName?: string;
  elapsed?: number;
  summary?: string;
}

export interface ChatContextUsageMessage {
  type: "chat:context_usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  contextWindow: number;
}

export interface ContextBreakdownSegment {
  label: string;
  tokens: number;
  id: string;
  estimated: boolean;
}

export interface ChatContextBreakdownMessage {
  type: "chat:context_breakdown";
  segments: ContextBreakdownSegment[];
  contextWindow: number;
  autocompactAt: number;
}

export interface FsListResultMessage {
  type: "fs:list_result";
  path: string;
  entries: FileEntry[];
}

export interface FsReadResultMessage {
  type: "fs:read_result";
  path: string;
  content: string;
}

export interface FsChangedMessage {
  type: "fs:changed";
  path: string;
}

export interface TerminalCreatedMessage {
  type: "terminal:created";
  termId: string;
}

export interface TerminalOutputMessage {
  type: "terminal:output";
  termId: string;
  data: string;
}

export interface TerminalExitedMessage {
  type: "terminal:exited";
  termId: string;
  code: number;
}

export interface MeshNodesMessage {
  type: "mesh:nodes";
  nodes: NodeInfo[];
}

export interface MeshInviteCodeMessage {
  type: "mesh:invite_code";
  code: string;
  qrDataUrl: string;
}

export interface MeshPairedMessage {
  type: "mesh:paired";
  node: NodeInfo;
}

export interface MeshNodeOnlineMessage {
  type: "mesh:node_online";
  nodeId: string;
}

export interface MeshNodeOfflineMessage {
  type: "mesh:node_offline";
  nodeId: string;
}

export interface ProjectsListMessage {
  type: "projects:list";
  projects: ProjectInfo[];
}

export interface SettingsDataMessage {
  type: "settings:data";
  config: LatticeConfig;
  mcpServers?: Record<string, McpServerConfig>;
  globalSkills?: SkillInfo[];
}

export interface LoopStatusMessage {
  type: "loop:status_update";
  loop: LoopStatus;
}

export interface LoopStartedMessage {
  type: "loop:started";
  loop: LoopStatus;
}

export interface LoopDeltaMessage {
  type: "loop:delta";
  loopId: string;
  iteration: number;
  text: string;
}

export interface SchedulerTasksMessage {
  type: "scheduler:tasks";
  tasks: ScheduledTask[];
}

export interface SchedulerTaskCreatedMessage {
  type: "scheduler:task_created";
  task: ScheduledTask;
}

export interface NotesListResultMessage {
  type: "notes:list_result";
  notes: StickyNote[];
}

export interface NoteCreatedMessage {
  type: "notes:created";
  note: StickyNote;
}

export interface NoteUpdatedMessage {
  type: "notes:updated";
  note: StickyNote;
}

export interface NoteDeletedMessage {
  type: "notes:deleted";
  id: string;
}

export interface SkillsListMessage {
  type: "skills:list";
  skills: SkillInfo[];
}

export interface SessionListAllMessage {
  type: "session:list_all";
  sessions: SessionSummary[];
}

export interface SkillsSearchResultsMessage {
  type: "skills:search_results";
  query: string;
  skills: MarketplaceSkill[];
  count: number;
  error?: string;
}

export interface SkillsInstallResultMessage {
  type: "skills:install_result";
  success: boolean;
  message?: string;
}

export interface SkillsViewResultMessage {
  type: "skills:view_result";
  path: string;
  content: string;
}

export interface SkillsDeleteResultMessage {
  type: "skills:delete_result";
  success: boolean;
  message?: string;
}

export interface BrowseListResultMessage {
  type: "browse:list_result";
  path: string;
  homedir: string;
  entries: Array<{
    name: string;
    path: string;
    hasClaudeMd: boolean;
    projectName: string | null;
  }>;
}

export type ServerMessage =
  | SessionListMessage
  | SessionCreatedMessage
  | SessionHistoryMessage
  | ChatUserMessage
  | ChatDeltaMessage
  | ChatToolStartMessage
  | ChatToolResultMessage
  | ChatDoneMessage
  | ChatErrorMessage
  | ChatPermissionRequestMessage
  | ChatStatusMessage
  | ChatContextUsageMessage
  | ChatContextBreakdownMessage
  | FsListResultMessage
  | FsReadResultMessage
  | FsChangedMessage
  | TerminalCreatedMessage
  | TerminalOutputMessage
  | TerminalExitedMessage
  | MeshNodesMessage
  | MeshInviteCodeMessage
  | MeshPairedMessage
  | MeshNodeOnlineMessage
  | MeshNodeOfflineMessage
  | ProjectsListMessage
  | SettingsDataMessage
  | LoopStatusMessage
  | LoopStartedMessage
  | LoopDeltaMessage
  | SchedulerTasksMessage
  | SchedulerTaskCreatedMessage
  | NotesListResultMessage
  | NoteCreatedMessage
  | NoteUpdatedMessage
  | NoteDeletedMessage
  | SkillsListMessage
  | ChatPermissionResolvedMessage
  | ProjectSettingsDataMessage
  | ProjectSettingsErrorMessage
  | SessionListAllMessage
  | SkillsSearchResultsMessage
  | SkillsInstallResultMessage
  | SkillsViewResultMessage
  | SkillsDeleteResultMessage
  | BrowseListResultMessage;

export interface MeshHelloMessage {
  type: "mesh:hello";
  nodeId: string;
  name: string;
  projects: Array<{ slug: string; title: string }>;
}

export interface MeshProxyRequestMessage {
  type: "mesh:proxy_request";
  projectSlug: string;
  requestId: string;
  payload: ClientMessage;
}

export interface MeshProxyResponseMessage {
  type: "mesh:proxy_response";
  projectSlug: string;
  requestId: string;
  payload: ServerMessage;
}

export interface MeshSessionSyncMessage {
  type: "mesh:session_sync";
  projectSlug: string;
  sessionId: string;
  lines: string[];
  offset: number;
}

export interface MeshSessionRequestMessage {
  type: "mesh:session_request";
  projectSlug: string;
  sessionId: string;
  fromOffset: number;
}

export type MeshMessage =
  | MeshHelloMessage
  | MeshProxyRequestMessage
  | MeshProxyResponseMessage
  | MeshSessionSyncMessage
  | MeshSessionRequestMessage;
