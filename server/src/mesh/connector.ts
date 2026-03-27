import type { MeshMessage, MeshHelloMessage, MeshSessionSyncMessage, MeshSessionRequestMessage } from "@lattice/shared";
import { loadPeers } from "./peers";
import { loadOrCreateIdentity } from "../identity";
import { loadConfig } from "../config";
import { listProjects } from "../project/registry";
import { getProjectBySlug } from "../project/registry";
import { handleSessionSync, handleSessionRequest } from "./session-sync";
import { log } from "../logger";

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

var RECONNECT_INTERVAL_MS = 15000;

export function startMeshConnections(): void {
  reconcilePeers();
  setInterval(reconcilePeers, RECONNECT_INTERVAL_MS);
}

function reconcilePeers(): void {
  var peers = loadPeers();
  for (var i = 0; i < peers.length; i++) {
    var peer = peers[i];
    if (!peer.addresses || peer.addresses.length === 0) continue;
    var existing = connections.get(peer.id);
    if (existing && !existing.dead && existing.ws.readyState === WebSocket.OPEN) continue;
    if (existing && !existing.dead && existing.retryTimer !== null) continue;
    if (!existing || existing.dead) {
      connections.delete(peer.id);
      connectToPeer(peer.id, peer.addresses[0]);
    }
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
  var protocol = config.tls ? "wss" : "ws";
  var url = address.includes(":")
    ? protocol + "://" + address + "/ws"
    : protocol + "://" + address + ":" + config.port + "/ws";

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
      log.mesh("Connection timeout for peer: %s", conn.nodeId);
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

    var hello: MeshHelloMessage & { publicKey?: string } = {
      type: "mesh:hello",
      nodeId: identity.id,
      name: config.name,
      publicKey: identity.publicKey,
      projects: projects.map(function (p) {
        return { slug: p.slug, title: p.title };
      }),
    };

    ws.send(JSON.stringify(hello));

    log.mesh("Connected to peer: %s", conn.nodeId);

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
      log.mesh("Invalid message from peer: %s", conn.nodeId);
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
      log.mesh("Circuit breaker open for peer: %s (half-open attempt failed)", conn.nodeId);
    } else if (circuit.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuit.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      log.mesh("Circuit breaker open for peer: %s after %d consecutive failures", conn.nodeId, circuit.failures);
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
    log.mesh("WebSocket error for peer: %s", conn.nodeId);
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

export function registerInboundPeer(nodeId: string, ws: { send: (data: string) => void; readyState: number }): void {
  var existing = connections.get(nodeId);
  if (existing && !existing.dead && existing.ws.readyState === WebSocket.OPEN) {
    return;
  }

  if (existing) {
    existing.dead = true;
    if (existing.retryTimer !== null) {
      clearTimeout(existing.retryTimer);
    }
  }

  circuitBreakers.delete(nodeId);

  var conn: PeerConnection = {
    nodeId: nodeId,
    ws: ws as WebSocket,
    backoffMs: 1000,
    retryTimer: null,
    dead: false,
    projects: [],
  };

  connections.set(nodeId, conn);

  var peers = loadPeers();
  var peer = peers.find(function (p) { return p.id === nodeId; });
  if (peer) {
    var identity = loadOrCreateIdentity();
    var config = loadConfig();
    var projects = config.projects || [];
    conn.projects = [];

    ws.send(JSON.stringify({
      type: "mesh:hello",
      nodeId: identity.id,
      name: config.name,
      publicKey: identity.publicKey,
      projects: projects.map(function (p: { slug: string; title: string }) {
        return { slug: p.slug, title: p.title };
      }),
    }));
  }
}

export function disconnectPeer(nodeId: string): void {
  var existing = connections.get(nodeId);
  if (existing) {
    existing.dead = true;
    if (existing.retryTimer !== null) {
      clearTimeout(existing.retryTimer);
      existing.retryTimer = null;
    }
    existing.ws.close();
    connections.delete(nodeId);
  }
  circuitBreakers.delete(nodeId);
}

export function reconnectPeer(nodeId: string): void {
  var existing = connections.get(nodeId);
  if (existing) {
    existing.dead = true;
    if (existing.retryTimer !== null) {
      clearTimeout(existing.retryTimer);
      existing.retryTimer = null;
    }
    existing.ws.close();
    connections.delete(nodeId);
  }
  circuitBreakers.delete(nodeId);

  var peers = loadPeers();
  var peer = peers.find(function (p) { return p.id === nodeId; });
  if (peer && peer.addresses && peer.addresses.length > 0) {
    connectToPeer(nodeId, peer.addresses[0]);
  }
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

export function getConnectedPeerProjects(nodeId: string): Array<{ slug: string; title: string }> {
  var conn = connections.get(nodeId);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return [];
  return conn.projects;
}

export function getAllRemoteProjects(localNodeId: string): Array<{ slug: string; path: string; title: string; nodeId: string; nodeName: string; isRemote: boolean }> {
  var results: Array<{ slug: string; path: string; title: string; nodeId: string; nodeName: string; isRemote: boolean }> = [];
  for (var [nodeId, conn] of connections) {
    if (conn.ws.readyState !== WebSocket.OPEN) continue;
    var peers = require("./peers") as typeof import("./peers");
    var peer = peers.getPeer(nodeId);
    var peerName = peer ? peer.name : nodeId;
    for (var i = 0; i < conn.projects.length; i++) {
      results.push({
        slug: conn.projects[i].slug,
        path: "",
        title: conn.projects[i].title,
        nodeId: nodeId,
        nodeName: peerName,
        isRemote: true,
      });
    }
  }
  return results;
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
