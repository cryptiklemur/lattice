import { existsSync, mkdirSync, readFileSync, appendFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MeshSessionSyncMessage, MeshSessionRequestMessage } from "#shared";
import { getConnectedPeerIds, getPeerConnection } from "./connector";
import { getLatticeHome } from "../config";

const syncOffsets = new Map<string, number>();

function getSyncKey(nodeId: string, sessionId: string): string {
  return nodeId + ":" + sessionId;
}

function getRemoteSessionsDir(nodeId: string, projectSlug: string): string {
  const dir = join(getLatticeHome(), "remote-sessions", nodeId, projectSlug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionFilePath(projectPath: string, sessionId: string): string {
  const hash = projectPath.replace(/\//g, "-");
  return join(homedir(), ".claude", "projects", hash, sessionId + ".jsonl");
}

export function syncSessionToPeers(projectPath: string, projectSlug: string, sessionId: string): void {
  const filePath = getSessionFilePath(projectPath, sessionId);
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  const peerIds = getConnectedPeerIds();

  for (let i = 0; i < peerIds.length; i++) {
    const nodeId = peerIds[i];
    const key = getSyncKey(nodeId, sessionId);
    const lastOffset = syncOffsets.get(key) || 0;

    if (content.length <= lastOffset) {
      continue;
    }

    const newContent = content.slice(lastOffset);
    const newLines = newContent.split("\n").filter(function (l) { return l.trim().length > 0; });

    if (newLines.length === 0) {
      continue;
    }

    const ws = getPeerConnection(nodeId);
    if (!ws) {
      continue;
    }

    const msg: MeshSessionSyncMessage = {
      type: "mesh:session_sync",
      projectSlug,
      sessionId,
      lines: newLines,
      offset: lastOffset,
    };

    ws.send(JSON.stringify(msg));
    syncOffsets.set(key, content.length);
  }
}

export function handleSessionSync(nodeId: string, msg: MeshSessionSyncMessage): void {
  const dir = getRemoteSessionsDir(nodeId, msg.projectSlug);
  const filePath = join(dir, msg.sessionId + ".jsonl");

  for (let i = 0; i < msg.lines.length; i++) {
    appendFileSync(filePath, msg.lines[i] + "\n", "utf-8");
  }
}

export function handleSessionRequest(nodeId: string, msg: MeshSessionRequestMessage, projectPath: string): void {
  const filePath = getSessionFilePath(projectPath, msg.sessionId);
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf-8");
  const newContent = content.slice(msg.fromOffset);
  const lines = newContent.split("\n").filter(function (l) { return l.trim().length > 0; });

  if (lines.length === 0) {
    return;
  }

  const ws = getPeerConnection(nodeId);
  if (!ws) {
    return;
  }

  const syncMsg: MeshSessionSyncMessage = {
    type: "mesh:session_sync",
    projectSlug: msg.projectSlug,
    sessionId: msg.sessionId,
    lines,
    offset: msg.fromOffset,
  };

  ws.send(JSON.stringify(syncMsg));
}
