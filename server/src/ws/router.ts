import type { ClientMessage } from "@lattice/shared";
import { sendTo } from "./broadcast";
import { log } from "../logger";

var _registry: typeof import("../project/registry") | null = null;
var _connector: typeof import("../mesh/connector") | null = null;
var _proxy: typeof import("../mesh/proxy") | null = null;

function getRegistry(): typeof import("../project/registry") {
  if (!_registry) {
    _registry = require("../project/registry") as typeof import("../project/registry");
  }
  return _registry;
}

function getConnector(): typeof import("../mesh/connector") {
  if (!_connector) {
    _connector = require("../mesh/connector") as typeof import("../mesh/connector");
  }
  return _connector;
}

function getProxy(): typeof import("../mesh/proxy") {
  if (!_proxy) {
    _proxy = require("../mesh/proxy") as typeof import("../mesh/proxy");
  }
  return _proxy;
}

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

    var msgSlug = (message as any).projectSlug as string | undefined;

    if (msgSlug) {
      var localProject = getLocalProject(msgSlug);
      if (!localProject) {
        var remoteEntry = getRemoteNodeForProject(msgSlug);
        if (remoteEntry) {
          setClientRemoteNode(clientId, remoteEntry.nodeId, msgSlug);
          proxyMessage(clientId, remoteEntry.nodeId, msgSlug, message);
          return;
        }
      } else if (message.type === "session:activate" || message.type === "session:list_request") {
        clearClientRemoteNode(clientId);
      }
    } else if (remote) {
      proxyMessage(clientId, remote.nodeId, remote.projectSlug, message);
      return;
    }
  }

  var handler = handlers.get(prefix);
  if (handler) {
    try {
      var result = handler(clientId, message);
      if (result && typeof result.then === "function") {
        result.then(undefined, function (err: unknown) {
          var stack = err instanceof Error ? err.stack : String(err);
          log.ws("Async handler error for %s: %s", message.type, stack);
          sendTo(clientId, { type: "chat:error", message: "Internal server error processing " + message.type });
        });
      }
    } catch (err) {
      var stack = err instanceof Error ? (err as Error).stack : String(err);
      log.ws("Handler error for %s: %s", message.type, stack);
      sendTo(clientId, { type: "chat:error", message: "Internal server error processing " + message.type });
    }
    return;
  }
  log.ws("No handler for message type: %s", message.type);
  sendTo(clientId, { type: "error", message: `Unknown message type: ${message.type}` });
}

function getLocalProject(slug: string): boolean {
  return getRegistry().getProjectBySlug(slug) !== undefined;
}

function getRemoteNodeForProject(slug: string): { nodeId: string } | undefined {
  var nodeId = getConnector().findNodeForProject(slug);
  if (nodeId) {
    return { nodeId: nodeId };
  }
  return undefined;
}

function proxyMessage(clientId: string, nodeId: string, projectSlug: string, message: ClientMessage): void {
  try {
    getProxy().proxyToRemoteNode(nodeId, projectSlug, clientId, message);
  } catch (err) {
    log.ws("Failed to proxy message: %O", err);
    sendTo(clientId, { type: "chat:error", message: "Failed to proxy message to remote node" });
  }
}
