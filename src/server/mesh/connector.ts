import type { MeshMessage, MeshHelloMessage, MeshSessionSyncMessage, MeshSessionRequestMessage, MeshPingMessage, MeshPongMessage } from "#shared";
import * as peersModule from "./peers";
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
var lastKnownProjects = new Map<string, Array<{ slug: string; title: string }>>();
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
var HEALTH_CHECK_INTERVAL_MS = 30000;
var HEALTH_MISS_THRESHOLD = 3;

interface HealthState {
  lastPongAt: number;
  latencyMs: number;
  missedPongs: number;
  healthy: boolean;
  pingTimer: ReturnType<typeof setInterval> | null;
}

var healthStates = new Map<string, HealthState>();

export function getPeerHealth(nodeId: string): { latencyMs: number; healthy: boolean } | undefined {
  var state = healthStates.get(nodeId);
  if (!state) return undefined;
  return { latencyMs: state.latencyMs, healthy: state.healthy };
}

export function getAllPeerHealth(): Map<string, { latencyMs: number; healthy: boolean }> {
  var result = new Map<string, { latencyMs: number; healthy: boolean }>();
  for (var [nodeId, state] of healthStates) {
    result.set(nodeId, { latencyMs: state.latencyMs, healthy: state.healthy });
  }
  return result;
}

function startHealthCheck(conn: PeerConnection): void {
  var state = healthStates.get(conn.nodeId);
  if (state && state.pingTimer) return;

  var healthState: HealthState = {
    lastPongAt: Date.now(),
    latencyMs: 0,
    missedPongs: 0,
    healthy: true,
    pingTimer: null,
  };
  healthStates.set(conn.nodeId, healthState);

  var lastPingSentAt = 0;

  healthState.pingTimer = setInterval(function () {
    if (conn.dead || !isWebSocketOpen(conn.ws)) {
      stopHealthCheck(conn.nodeId);
      return;
    }
    if (lastPingSentAt > 0 && healthState.lastPongAt < lastPingSentAt) {
      healthState.missedPongs++;
      if (healthState.missedPongs >= HEALTH_MISS_THRESHOLD && healthState.healthy) {
        healthState.healthy = false;
        log.mesh("Health check: peer %s marked unhealthy (%d missed pongs)", conn.nodeId.slice(0, 8), healthState.missedPongs);
      }
    }
    lastPingSentAt = Date.now();
    try {
      conn.ws.send(JSON.stringify({ type: "mesh:ping", timestamp: lastPingSentAt }));
    } catch {
      healthState.missedPongs++;
    }
  }, HEALTH_CHECK_INTERVAL_MS);
  (healthState.pingTimer as ReturnType<typeof setInterval>).unref?.();
}

function stopHealthCheck(nodeId: string): void {
  var state = healthStates.get(nodeId);
  if (state && state.pingTimer) {
    clearInterval(state.pingTimer);
    state.pingTimer = null;
  }
  healthStates.delete(nodeId);
}

function handlePong(nodeId: string, timestamp: number): void {
  var state = healthStates.get(nodeId);
  if (!state) return;
  state.lastPongAt = Date.now();
  state.latencyMs = Date.now() - timestamp;
  state.missedPongs = 0;
  if (!state.healthy) {
    state.healthy = true;
    log.mesh("Health check: peer %s recovered (latency: %dms)", nodeId.slice(0, 8), state.latencyMs);
  }
}

export function startMeshConnections(): void {
  reconcilePeers();
  setInterval(reconcilePeers, RECONNECT_INTERVAL_MS);
}

function reconcilePeers(): void {
  var peers = loadPeers();
  for (var i = 0; i < peers.length; i++) {
    var peer = peers[i];
    if (!peer.addresses || peer.addresses.length === 0) {
      log.meshConnect("skip %s — no addresses", peer.name);
      continue;
    }
    var existing = connections.get(peer.id);
    if (existing && !existing.dead && isWebSocketOpen(existing.ws)) continue;
    if (existing && !existing.dead && existing.retryTimer !== null) {
      log.meshConnect("skip %s — retry pending", peer.name);
      continue;
    }
    if (!existing || existing.dead) {
      log.meshConnect("connecting to %s at %s", peer.name, peer.addresses[0]);
      connections.delete(peer.id);
      connectToPeer(peer.id, peer.addresses[0]);
    }
  }
}

export function stopMeshConnections(): void {
  for (var [nodeId, conn] of connections) {
    conn.dead = true;
    if (conn.retryTimer !== null) {
      clearTimeout(conn.retryTimer);
      conn.retryTimer = null;
    }
    stopHealthCheck(nodeId);
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
      log.meshConnect("circuit breaker open for %s, retry in %dms", conn.nodeId.slice(0, 8), circuit.openUntil - Date.now());
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

  log.meshConnect("opening WebSocket to %s", url);
  var ws = new WebSocket(url);
  conn.ws = ws;

  var connectionTimer = setTimeout(function () {
    if (!isWebSocketOpen(ws)) {
      log.meshConnect("connection timeout for %s at %s", conn.nodeId.slice(0, 8), url);
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
        if (msg.projects.length > 0) {
          lastKnownProjects.set(conn.nodeId, msg.projects);
        }
        startHealthCheck(conn);
      } else if (msg.type === "mesh:ping") {
        var pingMsg = msg as MeshPingMessage;
        conn.ws.send(JSON.stringify({ type: "mesh:pong", timestamp: pingMsg.timestamp }));
        return;
      } else if (msg.type === "mesh:pong") {
        var pongMsg = msg as MeshPongMessage;
        handlePong(conn.nodeId, pongMsg.timestamp);
        return;
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
  if (!isWebSocketOpen(conn.ws)) {
    return undefined;
  }
  return conn.ws;
}

export function registerInboundPeer(nodeId: string, ws: { send: (data: string) => void; readyState: number }, peerProjects?: Array<{ slug: string; title: string }>): void {
  var existing = connections.get(nodeId);
  if (existing && !existing.dead && isWebSocketOpen(existing.ws)) {
    log.meshConnect("inbound peer %s already connected, skipping", nodeId.slice(0, 8));
    return;
  }
  log.meshConnect("registering inbound peer %s", nodeId.slice(0, 8));

  if (existing) {
    existing.dead = true;
    if (existing.retryTimer !== null) {
      clearTimeout(existing.retryTimer);
    }
  }

  circuitBreakers.delete(nodeId);

  var incomingProjects = peerProjects ?? [];
  var conn: PeerConnection = {
    nodeId: nodeId,
    ws: ws as WebSocket,
    backoffMs: 1000,
    retryTimer: null,
    dead: false,
    projects: incomingProjects,
  };

  if (incomingProjects.length > 0) {
    lastKnownProjects.set(nodeId, incomingProjects);
  }

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
  stopHealthCheck(nodeId);
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
    if (isWebSocketOpen(conn.ws)) {
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

function isWebSocketOpen(ws: { readyState: number }): boolean {
  return ws.readyState === WebSocket.OPEN || ws.readyState === 0;
}

export function getConnectedPeerProjects(nodeId: string): Array<{ slug: string; title: string }> {
  var conn = connections.get(nodeId);
  if (!conn || !isWebSocketOpen(conn.ws)) return [];
  return conn.projects;
}

export function getAllRemoteProjects(localNodeId: string): Array<{ slug: string; path: string; title: string; nodeId: string; nodeName: string; isRemote: boolean; online: boolean }> {
  var allPeers = peersModule.loadPeers();
  var connectedIds = new Set(getConnectedPeerIds());
  var results: Array<{ slug: string; path: string; title: string; nodeId: string; nodeName: string; isRemote: boolean; online: boolean }> = [];

  for (var p = 0; p < allPeers.length; p++) {
    var peer = allPeers[p];
    var isOnline = connectedIds.has(peer.id);
    var projects: Array<{ slug: string; title: string }> = [];

    var conn = connections.get(peer.id);
    if (conn && conn.projects.length > 0) {
      projects = conn.projects;
    } else if (lastKnownProjects.has(peer.id)) {
      projects = lastKnownProjects.get(peer.id)!;
    }

    for (var i = 0; i < projects.length; i++) {
      results.push({
        slug: projects[i].slug,
        path: "",
        title: projects[i].title,
        nodeId: peer.id,
        nodeName: peer.name,
        isRemote: true,
        online: isOnline,
      });
    }
  }
  return results;
}

export function findNodeForProject(projectSlug: string): string | undefined {
  for (var [nodeId, conn] of connections) {
    if (!isWebSocketOpen(conn.ws)) {
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
