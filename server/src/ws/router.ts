import type { ClientMessage } from "@lattice/shared";
import { sendTo } from "./broadcast";

type Handler = (clientId: string, message: ClientMessage) => void | Promise<void>;

var handlers = new Map<string, Handler>();
var clientRemoteNode = new Map<string, { nodeId: string; projectSlug: string }>();

var PROXIED_PREFIXES = new Set(["session", "chat", "fs", "terminal"]);

export function registerHandler(prefix: string, handler: Handler): void {
  handlers.set(prefix, handler);
}

export function setClientRemoteNode(clientId: string, nodeId: string, projectSlug: string): void {
  clientRemoteNode.set(clientId, { nodeId, projectSlug });
}

export function clearClientRemoteNode(clientId: string): void {
  clientRemoteNode.delete(clientId);
}

export function getClientRemoteNode(clientId: string): { nodeId: string; projectSlug: string } | undefined {
  return clientRemoteNode.get(clientId);
}

export function routeMessage(clientId: string, message: ClientMessage): void {
  var prefix = message.type.split(":")[0];

  if (PROXIED_PREFIXES.has(prefix)) {
    var remote = clientRemoteNode.get(clientId);

    if (message.type === "session:activate") {
      var activateMsg = message as { type: string; projectSlug: string; sessionId: string };
      var localProject = getLocalProject(activateMsg.projectSlug);
      if (!localProject) {
        var remoteEntry = getRemoteNodeForProject(activateMsg.projectSlug);
        if (remoteEntry) {
          setClientRemoteNode(clientId, remoteEntry.nodeId, activateMsg.projectSlug);
          proxyMessage(clientId, remoteEntry.nodeId, activateMsg.projectSlug, message);
          return;
        }
      } else {
        clearClientRemoteNode(clientId);
      }
    } else if (remote) {
      proxyMessage(clientId, remote.nodeId, remote.projectSlug, message);
      return;
    }
  }

  var handler = handlers.get(prefix);
  if (handler) {
    handler(clientId, message);
    return;
  }
  console.warn(`[lattice] No handler for message type: ${message.type}`);
  sendTo(clientId, { type: "error", message: `Unknown message type: ${message.type}` });
}

function getLocalProject(slug: string): boolean {
  try {
    var { getProjectBySlug } = require("../project/registry") as typeof import("../project/registry");
    return getProjectBySlug(slug) !== undefined;
  } catch {
    return false;
  }
}

function getRemoteNodeForProject(slug: string): { nodeId: string } | undefined {
  try {
    var { findNodeForProject } = require("../mesh/connector") as typeof import("../mesh/connector");
    var nodeId = findNodeForProject(slug);
    if (nodeId) {
      return { nodeId: nodeId };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function proxyMessage(clientId: string, nodeId: string, projectSlug: string, message: ClientMessage): void {
  try {
    var { proxyToRemoteNode } = require("../mesh/proxy") as typeof import("../mesh/proxy");
    proxyToRemoteNode(nodeId, projectSlug, clientId, message);
  } catch (err) {
    console.error("[router] Failed to proxy message:", err);
    sendTo(clientId, { type: "chat:error", message: "Failed to proxy message to remote node" });
  }
}
