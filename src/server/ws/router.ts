import type { ClientMessage } from "#shared";
import { sendTo } from "./broadcast";
import { log } from "../logger";

var _registry: typeof import("../project/registry") | null = null;
var _connector: typeof import("../mesh/connector") | null = null;
var _proxy: typeof import("../mesh/proxy") | null = null;

async function getRegistry(): Promise<typeof import("../project/registry")> {
  if (!_registry) {
    _registry = await import("../project/registry");
  }
  return _registry;
}

async function getConnector(): Promise<typeof import("../mesh/connector")> {
  if (!_connector) {
    _connector = await import("../mesh/connector");
  }
  return _connector;
}

async function getProxy(): Promise<typeof import("../mesh/proxy")> {
  if (!_proxy) {
    _proxy = await import("../mesh/proxy");
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

export async function routeMessage(clientId: string, message: ClientMessage): Promise<void> {
  var prefix = message.type.split(":")[0];

  log.router("→ %s from client %s (prefix=%s)", message.type, clientId.slice(0, 8), prefix);

  if (PROXIED_PREFIXES.has(prefix)) {
    var remote = clientRemoteNode.get(clientId);

    var msgSlug = (message as any).projectSlug as string | undefined;

    if (msgSlug) {
      var localProject = await getLocalProject(msgSlug);
      log.router("  slug=%s local=%s", msgSlug, localProject);
      if (!localProject) {
        var remoteEntry = await getRemoteNodeForProject(msgSlug);
        if (remoteEntry) {
          log.router("  → proxying to remote node %s for project %s", remoteEntry.nodeId.slice(0, 8), msgSlug);
          setClientRemoteNode(clientId, remoteEntry.nodeId, msgSlug);
          await proxyMessage(clientId, remoteEntry.nodeId, msgSlug, message);
          return;
        }
        log.router("  ✗ no remote node found for slug %s", msgSlug);
      } else if (message.type === "session:activate" || message.type === "session:list_request") {
        clearClientRemoteNode(clientId);
      }
    } else if (remote) {
      log.router("  → proxying via cached remote node %s", remote.nodeId.slice(0, 8));
      await proxyMessage(clientId, remote.nodeId, remote.projectSlug, message);
      return;
    }
  }

  var handler = handlers.get(prefix);
  if (handler) {
    log.router("  → dispatching to %s handler", prefix);
    try {
      await handler(clientId, message);
    } catch (err) {
      var stack = err instanceof Error ? (err as Error).stack : String(err);
      log.ws("Handler error for %s: %s", message.type, stack);
      sendTo(clientId, { type: "chat:error", message: "Internal server error processing " + message.type });
    }
    return;
  }
  log.router("  ✗ no handler for %s", message.type);
  sendTo(clientId, { type: "error", message: `Unknown message type: ${message.type}` });
}

async function getLocalProject(slug: string): Promise<boolean> {
  var registry = await getRegistry();
  return registry.getProjectBySlug(slug) !== undefined;
}

async function getRemoteNodeForProject(slug: string): Promise<{ nodeId: string } | undefined> {
  var connector = await getConnector();
  var nodeId = connector.findNodeForProject(slug);
  if (nodeId) {
    return { nodeId: nodeId };
  }
  return undefined;
}

async function proxyMessage(clientId: string, nodeId: string, projectSlug: string, message: ClientMessage): Promise<void> {
  try {
    var proxy = await getProxy();
    proxy.proxyToRemoteNode(nodeId, projectSlug, clientId, message);
  } catch (err) {
    log.ws("Failed to proxy message: %O", err);
    sendTo(clientId, { type: "chat:error", message: "Failed to proxy message to remote node" });
  }
}
