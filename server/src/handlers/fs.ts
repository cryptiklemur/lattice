import type { ClientMessage, FsListMessage, FsReadMessage, FsWriteMessage } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { getProjectBySlug } from "../project/registry";
import { listDirectory, readFile, writeFile } from "../project/file-browser";

var activeProjectByClient = new Map<string, string>();

export function setActiveProject(clientId: string, projectSlug: string): void {
  activeProjectByClient.set(clientId, projectSlug);
}

export function clearActiveProject(clientId: string): void {
  activeProjectByClient.delete(clientId);
}

registerHandler("fs", function (clientId: string, message: ClientMessage) {
  if (message.type === "fs:list") {
    var listMsg = message as FsListMessage;
    var projectSlug = activeProjectByClient.get(clientId);
    if (!projectSlug) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:list" });
      return;
    }

    var project = getProjectBySlug(projectSlug);
    if (!project) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlug });
      return;
    }

    var entries = listDirectory(project.path, listMsg.path);
    sendTo(clientId, { type: "fs:list_result", path: listMsg.path, entries });
    return;
  }

  if (message.type === "fs:read") {
    var readMsg = message as FsReadMessage;
    var projectSlugRead = activeProjectByClient.get(clientId);
    if (!projectSlugRead) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:read" });
      return;
    }

    var projectRead = getProjectBySlug(projectSlugRead);
    if (!projectRead) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlugRead });
      return;
    }

    var content = readFile(projectRead.path, readMsg.path);
    if (content === null) {
      sendTo(clientId, { type: "chat:error", message: "Cannot read file: " + readMsg.path });
      return;
    }

    sendTo(clientId, { type: "fs:read_result", path: readMsg.path, content });
    return;
  }

  if (message.type === "fs:write") {
    var writeMsg = message as FsWriteMessage;
    var projectSlugWrite = activeProjectByClient.get(clientId);
    if (!projectSlugWrite) {
      sendTo(clientId, { type: "chat:error", message: "No active project for fs:write" });
      return;
    }

    var projectWrite = getProjectBySlug(projectSlugWrite);
    if (!projectWrite) {
      sendTo(clientId, { type: "chat:error", message: "Project not found: " + projectSlugWrite });
      return;
    }

    var ok = writeFile(projectWrite.path, writeMsg.path, writeMsg.content);
    if (!ok) {
      sendTo(clientId, { type: "chat:error", message: "Cannot write file: " + writeMsg.path });
      return;
    }

    broadcast({ type: "fs:changed", path: writeMsg.path });
    return;
  }
});
