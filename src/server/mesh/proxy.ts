import { randomUUID } from "node:crypto";
import type { ClientMessage, MeshProxyRequestMessage, MeshProxyResponseMessage, ServerMessage } from "#shared";
import { getPeerConnection } from "./connector";
import { sendTo, broadcast, registerVirtualClient, removeVirtualClient } from "../ws/broadcast";
import { routeMessage } from "../ws/router";
import { log } from "../logger";

const pendingRequests = new Map<string, string>();

export function proxyToRemoteNode(nodeId: string, projectSlug: string, clientId: string, message: ClientMessage): void {
  log.meshProxy("→ proxy %s to node %s for project %s", (message as any).type, nodeId.slice(0, 8), projectSlug);
  const ws = getPeerConnection(nodeId);
  if (!ws) {
    log.meshProxy("  ✗ no connection to node %s", nodeId.slice(0, 8));
    sendTo(clientId, { type: "chat:error", message: "Remote node is not connected" });
    return;
  }

  const requestId = randomUUID();
  pendingRequests.set(requestId, clientId);
  log.meshProxy("  envelope requestId=%s", requestId.slice(0, 8));

  const envelope: MeshProxyRequestMessage = {
    type: "mesh:proxy_request",
    projectSlug: projectSlug,
    requestId: requestId,
    payload: message,
  };

  ws.send(JSON.stringify(envelope));
}

export function handleProxyRequest(sourceNodeId: string, msg: MeshProxyRequestMessage): void {
  const proxyClientId = "mesh-proxy:" + sourceNodeId + ":" + msg.requestId;
  log.meshProxy("← proxy_request from %s: %s for %s (reqId=%s)", sourceNodeId.slice(0, 8), (msg.payload as any).type, msg.projectSlug, msg.requestId.slice(0, 8));

  registerVirtualClient(proxyClientId, function (response: object) {
    log.meshProxy("  → proxy_response %s back to %s", (response as any).type, sourceNodeId.slice(0, 8));
    const ws = getPeerConnection(sourceNodeId);
    if (!ws) {
      console.warn("[mesh/proxy] Cannot send response, no connection to: " + sourceNodeId);
      removeVirtualClient(proxyClientId);
      return;
    }

    const envelope: MeshProxyResponseMessage = {
      type: "mesh:proxy_response",
      projectSlug: msg.projectSlug,
      requestId: msg.requestId,
      payload: response as ServerMessage,
    };

    ws.send(JSON.stringify(envelope));
    removeVirtualClient(proxyClientId);
  });

  routeMessage(proxyClientId, msg.payload);
}

export function handleProxyResponse(msg: MeshProxyResponseMessage): void {
  log.meshProxy("← proxy_response %s (reqId=%s)", (msg.payload as any).type, msg.requestId.slice(0, 8));
  const clientId = pendingRequests.get(msg.requestId);
  if (!clientId) {
    log.meshProxy("  ✗ no pending request for %s", msg.requestId.slice(0, 8));
    return;
  }

  pendingRequests.delete(msg.requestId);
  sendTo(clientId, msg.payload);
}

type SendToFn = (clientId: string, message: object) => void;

const proxyHandlers = new Map<string, (clientId: string, message: ClientMessage, sendToFn: SendToFn) => void>();

export function registerProxyAwareHandler(prefix: string, handler: (clientId: string, message: ClientMessage, sendToFn: SendToFn) => void): void {
  proxyHandlers.set(prefix, handler);
}

function proxyRouteMessage(clientId: string, message: ClientMessage, sendToFn: SendToFn): void {
  const prefix = message.type.split(":")[0];
  const proxyHandler = proxyHandlers.get(prefix);
  if (proxyHandler) {
    proxyHandler(clientId, message, sendToFn);
    return;
  }
  routeMessage(clientId, message);
}

export function getProxySendTo(requestId: string, sourceNodeId: string): ((msg: ServerMessage) => void) | undefined {
  const clientId = pendingRequests.get(requestId);
  if (clientId !== undefined) {
    const resolvedClientId = clientId;
    return function (msg: ServerMessage) {
      sendTo(resolvedClientId, msg);
    };
  }

  return function (msg: ServerMessage) {
    const ws = getPeerConnection(sourceNodeId);
    if (!ws) {
      return;
    }
    ws.send(JSON.stringify(msg));
  };
}
