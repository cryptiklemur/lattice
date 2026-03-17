import type {
  Attachment,
  FileEntry,
  HistoryMessage,
  LatticeConfig,
  NodeInfo,
  ProjectInfo,
  SessionSummary,
} from "./models.js";

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

export interface ChatSendMessage {
  type: "chat:send";
  text: string;
  attachments?: Attachment[];
}

export interface ChatPermissionResponseMessage {
  type: "chat:permission_response";
  requestId: string;
  allow: boolean;
}

export interface ChatRewindMessage {
  type: "chat:rewind";
  messageUuid: string;
}

export interface ChatCancelMessage {
  type: "chat:cancel";
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

export type ClientMessage =
  | SessionCreateMessage
  | SessionActivateMessage
  | SessionRenameMessage
  | SessionDeleteMessage
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
  | MeshUnpairMessage;

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
  messages: HistoryMessage[];
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
  | SettingsDataMessage;

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

export type MeshMessage =
  | MeshHelloMessage
  | MeshProxyRequestMessage
  | MeshProxyResponseMessage;
