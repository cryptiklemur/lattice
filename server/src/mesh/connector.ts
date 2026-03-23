import type { MeshMessage, MeshHelloMessage, MeshSessionSyncMessage, MeshSessionRequestMessage } from "@lattice/shared";
import { loadPeers } from "./peers";
import { loadOrCreateIdentity } from "../identity";
import { loadConfig } from "../config";
import { listProjects } from "../project/registry";
import { getProjectBySlug } from "../project/registry";
import { handleSessionSync, handleSessionRequest } from "./session-sync";

interface PeerConnection {
  nodeId: string;
  ws: WebSocket;
  backoffMs: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  dead: boolean;
  projects: Array<{ slug: string; title: string }>;
}

var connections = new Map<string, PeerConnection>();
var connectedCallbacks: Array<(nodeId: string) => void> = [];
var disconnectedCallbacks: Array<(nodeId: string) => void> = [];
var messageCallbacks: Array<(nodeId: string, msg: MeshMessage) => void> = [];

var MIN_BACKOFF_MS = 1000;
var MAX_BACKOFF_MS = 30000;
var CONNECTION_TIMEOUT_MS = 10000;
var CIRCUIT_BREAKER_THRESHOLD = 5;
var CIRCUIT_BREAKER_COOLDOWN = 60000;

interface CircuitState {
  failures: number;
  openUntil: number;
  halfOpen: boolean;
}

var circuitBreakers = new Map<string, CircuitState>();

export function startMeshConnections(): void {
  var peers = loadPeers();
  for (var i = 0; i < peers.length; i++) {
    connectToPeer(peers[i].id, peers[i].addresses[0]);
  }
}

export function stopMeshConnections(): void {
  for (var [, conn] of connections) {
    conn.dead = true;
    if (conn.retryTimer !== null) {
      clearTimeout(conn.retryTimer);
      conn.retryTimer = null;
    }
    conn.ws.close();
  }
  connections.clear();
}

export function connectToPeer(nodeId: string, address: string): void {
  if (connections.has(nodeId)) {
    return;
  }

  var peers = loadPeers();
  var peer = peers.find(function (p) { return p.id === nodeId; });
  if (!peer) {
    return;
  }

  var config = loadConfig();
  var port = config.port;
  var protocol = config.tls ? "wss" : "ws";
  var url = protocol + "://" + address + ":" + port + "/ws";

  var conn: PeerConnection = {
    nodeId: nodeId,
    ws: null as unknown as WebSocket,
    backoffMs: MIN_BACKOFF_MS,
    retryTimer: null,
    dead: false,
    projects: [],
  };

  connections.set(nodeId, conn);
  openConnection(conn, url);
}

function openConnection(conn: PeerConnection, url: string): void {
  var circuit = circuitBreakers.get(conn.nodeId);
  if (circuit && circuit.failures >= CIRCUIT_BREAKER_THRESHOLD && !circuit.halfOpen) {
    if (Date.now() < circuit.openUntil) {
      conn.retryTimer = setTimeout(function () {
        if (conn.dead) return;
        conn.retryTimer = null;
        circuit!.halfOpen = true;
        openConnection(conn, url);
      }, circuit.openUntil - Date.now());
      return;
    }
    circuit.halfOpen = true;
  }

  var ws = new WebSocket(url);
  conn.ws = ws;

  var connectionTimer = setTimeout(function () {
    if (ws.readyState !== WebSocket.OPEN) {
      console.error("[mesh] Connection timeout for peer: " + conn.nodeId);
      ws.close();
    }
  }, CONNECTION_TIMEOUT_MS);

  ws.addEventListener("open", function () {
    clearTimeout(connectionTimer);
    if (conn.dead) {
      ws.close();
      return;
    }

    circuitBreakers.delete(conn.nodeId);
    conn.backoffMs = MIN_BACKOFF_MS;

    var identity = loadOrCreateIdentity();
    var config = loadConfig();
    var projects = listProjects(identity.id);

    var hello: MeshHelloMessage = {
      type: "mesh:hello",
      nodeId: identity.id,
      name: config.name,
      projects: projects.map(function (p) {
        return { slug: p.slug, title: p.title };
      }),
    };

    ws.send(JSON.stringify(hello));

    console.log("[mesh] Connected to peer: " + conn.nodeId);

    for (var i = 0; i < connectedCallbacks.length; i++) {
      connectedCallbacks[i](conn.nodeId);
    }
  });

  ws.addEventListener("message", function (event: MessageEvent) {
    if (conn.dead) {
      return;
    }

    try {
      var msg = JSON.parse(event.data as string) as MeshMessage;

      if (msg.type === "mesh:hello") {
        conn.projects = msg.projects;
      } else if (msg.type === "mesh:session_sync") {
        handleSessionSync(conn.nodeId, msg as MeshSessionSyncMessage);
      } else if (msg.type === "mesh:session_request") {
        var reqMsg = msg as MeshSessionRequestMessage;
        var reqProject = getProjectBySlug(reqMsg.projectSlug);
        if (reqProject) {
          handleSessionRequest(conn.nodeId, reqMsg, reqProject.path);
        }
      }

      for (var i = 0; i < messageCallbacks.length; i++) {
        messageCallbacks[i](conn.nodeId, msg);
      }
    } catch {
      console.error("[mesh] Invalid message from peer: " + conn.nodeId);
    }
  });

  ws.addEventListener("close", function () {
    clearTimeout(connectionTimer);
    if (conn.dead) {
      return;
    }

    var circuit = circuitBreakers.get(conn.nodeId);
    if (!circuit) {
      circuit = { failures: 0, openUntil: 0, halfOpen: false };
      circuitBreakers.set(conn.nodeId, circuit);
    }
    circuit.failures++;

    if (circuit.halfOpen) {
      circuit.halfOpen = false;
      circuit.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      console.log("[mesh] Circuit breaker open for peer: " + conn.nodeId + " (half-open attempt failed)");
    } else if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuit.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      console.log("[mesh] Circuit breaker open for peer: " + conn.nodeId + " after " + circuit.failures + " consecutive failures");
    }

    for (var i = 0; i < disconnectedCallbacks.length; i++) {
      disconnectedCallbacks[i](conn.nodeId);
    }

    var delay = conn.backoffMs;
    conn.backoffMs = Math.min(conn.backoffMs * 2, MAX_BACKOFF_MS);

    conn.retryTimer = setTimeout(function () {
      if (conn.dead) {
        return;
      }
      conn.retryTimer = null;
      openConnection(conn, url);
    }, delay);
  });

  ws.addEventListener("error", function () {
    console.error("[mesh] WebSocket error for peer: " + conn.nodeId);
  });
}

export function getPeerConnection(nodeId: string): WebSocket | undefined {
  var conn = connections.get(nodeId);
  if (!conn) {
    return undefined;
  }
  if (conn.ws.readyState !== WebSocket.OPEN) {
    return undefined;
  }
  return conn.ws;
}

export function getConnectedPeerIds(): string[] {
  var ids: string[] = [];
  for (var [nodeId, conn] of connections) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      ids.push(nodeId);
    }
  }
  return ids;
}

export function onPeerConnected(callback: (nodeId: string) => void): void {
  connectedCallbacks.push(callback);
}

export function onPeerDisconnected(callback: (nodeId: string) => void): void {
  disconnectedCallbacks.push(callback);
}

export function onPeerMessage(callback: (nodeId: string, msg: MeshMessage) => void): void {
  messageCallbacks.push(callback);
}

export function findNodeForProject(projectSlug: string): string | undefined {
  for (var [nodeId, conn] of connections) {
    if (conn.ws.readyState !== WebSocket.OPEN) {
      continue;
    }
    for (var i = 0; i < conn.projects.length; i++) {
      if (conn.projects[i].slug === projectSlug) {
        return nodeId;
      }
    }
  }
  return undefined;
}
