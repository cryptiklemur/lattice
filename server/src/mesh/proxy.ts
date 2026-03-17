import { randomUUID } from "node:crypto";
import type { ClientMessage, MeshProxyRequestMessage, MeshProxyResponseMessage, ServerMessage } from "@lattice/shared";
import { getPeerConnection } from "./connector";
import { sendTo, broadcast } from "../ws/broadcast";
import { routeMessage } from "../ws/router";

var pendingRequests = new Map<string, string>();

export function proxyToRemoteNode(nodeId: string, projectSlug: string, clientId: string, message: ClientMessage): void {
  var ws = getPeerConnection(nodeId);
  if (!ws) {
    console.warn("[mesh/proxy] No connection to peer: " + nodeId);
    sendTo(clientId, { type: "chat:error", message: "Remote node " + nodeId + " is not connected" });
    return;
  }

  var requestId = randomUUID();
  pendingRequests.set(requestId, clientId);

  var envelope: MeshProxyRequestMessage = {
    type: "mesh:proxy_request",
    projectSlug: projectSlug,
    requestId: requestId,
    payload: message,
  };

  ws.send(JSON.stringify(envelope));
}

export function handleProxyRequest(sourceNodeId: string, msg: MeshProxyRequestMessage): void {
  var proxyClientId = "mesh-proxy:" + sourceNodeId + ":" + msg.requestId;

  var originalBroadcast = broadcast;
  void originalBroadcast;

  var interceptedSendTo = function (targetId: string, response: object): void {
    if (targetId === proxyClientId) {
      var ws = getPeerConnection(sourceNodeId);
      if (!ws) {
        console.warn("[mesh/proxy] Cannot send response, no connection to: " + sourceNodeId);
        return;
      }

      var envelope: MeshProxyResponseMessage = {
        type: "mesh:proxy_response",
        projectSlug: msg.projectSlug,
        requestId: msg.requestId,
        payload: response as ServerMessage,
      };

      ws.send(JSON.stringify(envelope));
    }
  };

  proxyRouteMessage(proxyClientId, msg.payload, interceptedSendTo);
}

export function handleProxyResponse(msg: MeshProxyResponseMessage): void {
  var clientId = pendingRequests.get(msg.requestId);
  if (!clientId) {
    console.warn("[mesh/proxy] No pending request for id: " + msg.requestId);
    return;
  }

  pendingRequests.delete(msg.requestId);
  sendTo(clientId, msg.payload);
}

type SendToFn = (clientId: string, message: object) => void;

var proxyHandlers = new Map<string, (clientId: string, message: ClientMessage, sendToFn: SendToFn) => void>();

export function registerProxyAwareHandler(prefix: string, handler: (clientId: string, message: ClientMessage, sendToFn: SendToFn) => void): void {
  proxyHandlers.set(prefix, handler);
}

function proxyRouteMessage(clientId: string, message: ClientMessage, sendToFn: SendToFn): void {
  var prefix = message.type.split(":")[0];
  var proxyHandler = proxyHandlers.get(prefix);
  if (proxyHandler) {
    proxyHandler(clientId, message, sendToFn);
    return;
  }
  routeMessage(clientId, message);
}

export function getProxySendTo(requestId: string, sourceNodeId: string): ((msg: ServerMessage) => void) | undefined {
  var clientId = pendingRequests.get(requestId);
  if (clientId !== undefined) {
    var resolvedClientId = clientId;
    return function (msg: ServerMessage) {
      sendTo(resolvedClientId, msg);
    };
  }

  return function (msg: ServerMessage) {
    var ws = getPeerConnection(sourceNodeId);
    if (!ws) {
      return;
    }
    ws.send(JSON.stringify(msg));
  };
}
