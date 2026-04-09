import type { ClientMessage, MeshPairMessage, MeshUnpairMessage, NodeInfo } from "#shared";
import { log } from "../logger";
import { handleProxyRequest, handleProxyResponse } from "../mesh/proxy";
import type { MeshProxyRequestMessage, MeshProxyResponseMessage } from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { loadConfig } from "../config";
import { loadOrCreateIdentity } from "../identity";
import { generateInviteCode, parseInviteCode, validatePairingToken, consumePairingToken } from "../mesh/pairing";
import { addPeer, removePeer, loadPeers, getPeer } from "../mesh/peers";
import { getConnectedPeerIds, connectToPeer, reconnectPeer, getPeerConnection, disconnectPeer, getConnectedPeerProjects, registerInboundPeer, getPeerHealth } from "../mesh/connector";
import { getClientWebSocket, registerVirtualClient, removeVirtualClient } from "../ws/broadcast";
import type { PeerInfo } from "#shared";
import { networkInterfaces } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function getLocalAddress(): string {
  const all = getAllAddresses();
  return all.length > 0 ? all[0].address : "localhost";
}

function getAllAddresses(): Array<{ name: string; address: string }> {
  const interfaces = networkInterfaces();
  const keys = Object.keys(interfaces);
  const results: Array<{ name: string; address: string }> = [];
  for (let i = 0; i < keys.length; i++) {
    const addrs = interfaces[keys[i]];
    if (!addrs) continue;
    for (let j = 0; j < addrs.length; j++) {
      if (!addrs[j].internal && addrs[j].family === "IPv4") {
        results.push({ name: keys[i], address: addrs[j].address });
      }
    }
  }

  if (isWSL()) {
    const windowsAddrs = getWindowsHostAddresses();
    for (let w = 0; w < windowsAddrs.length; w++) {
      const exists = results.some(function (r) { return r.address === windowsAddrs[w].address; });
      if (!exists) {
        results.push(windowsAddrs[w]);
      }
    }
  }

  return results;
}

function isWSL(): boolean {
  try {
    if (existsSync("/proc/version")) {
      const version = readFileSync("/proc/version", "utf-8");
      return version.toLowerCase().includes("microsoft");
    }
  } catch {}
  return false;
}

function getWindowsHostAddresses(): Array<{ name: string; address: string }> {
  const results: Array<{ name: string; address: string }> = [];
  try {
    const output = execSync(
      "powershell.exe -NoProfile -Command \"Get-NetIPAddress -AddressFamily IPv4 | ForEach-Object { \\$_.IPAddress + '|' + \\$_.InterfaceAlias }\"",
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const lines = output.trim().split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].trim().split("|");
      const ip = parts[0];
      const iface = parts[1] || "windows";
      if (!ip || ip === "127.0.0.1") continue;
      if (ip.startsWith("169.254.")) continue;
      if (iface.includes("WSL")) continue;
      results.push({ name: iface.toLowerCase().replace(/\s+/g, "-"), address: ip });
    }
  } catch {}
  return results;
}

function getLocalProjectsList(): Array<{ slug: string; title: string }> {
  const config = loadConfig();
  return config.projects.map(function (p: typeof config.projects[number]) {
    return { slug: p.slug, title: p.title };
  });
}

export function buildNodesMessage(): NodeInfo[] {
  const peers = loadPeers();
  const config = loadConfig();
  const identity = loadOrCreateIdentity();
  const connectedIds = new Set(getConnectedPeerIds());
  const localAddrs = getAllAddresses().map(function (a) { return a.address + ":" + config.port; });

  const local: NodeInfo = {
    id: identity.id,
    name: config.name,
    address: localAddrs[0] ?? "localhost:" + config.port,
    addresses: localAddrs.length > 0 ? localAddrs : ["localhost:" + config.port],
    port: config.port,
    online: true,
    isLocal: true,
    projects: config.projects.map(function (p: typeof config.projects[number]) {
      return { slug: p.slug, path: p.path, title: p.title, nodeId: identity.id };
    }),
  };

  const remotes: NodeInfo[] = peers.map(function (peer) {
    const peerProjects = getConnectedPeerProjects(peer.id);
    const health = getPeerHealth(peer.id);
    return {
      id: peer.id,
      name: peer.name,
      address: peer.addresses[0] ?? "",
      addresses: peer.addresses,
      port: 0,
      online: connectedIds.has(peer.id),
      isLocal: false,
      projects: peerProjects.map(function (p) {
        return { slug: p.slug, path: "", title: p.title, nodeId: peer.id };
      }),
      latencyMs: health?.latencyMs,
      healthy: health?.healthy,
    };
  });

  return [local, ...remotes];
}

registerHandler("mesh", function (clientId: string, message: ClientMessage) {
  log.meshHello("mesh message: %s from %s", (message as any).type, clientId.slice(0, 8));

  if (message.type === "mesh:generate_invite") {
    const genMsg = message as any as { type: "mesh:generate_invite"; address?: string };
    const config = loadConfig();
    const address = genMsg.address || getLocalAddress();
    generateInviteCode(address, config.port).then(function (result) {
      sendTo(clientId, {
        type: "mesh:invite_code",
        code: result.code,
        qrDataUrl: result.qrDataUrl,
      });
    }).catch(function (err) {
      console.error("[lattice] Failed to generate invite code:", err);
    });
    return;
  }

  if ((message as any).type === "mesh:addresses") {
    const addresses = getAllAddresses();
    sendTo(clientId, { type: "mesh:addresses_result" as any, addresses: addresses });
    return;
  }

  if (message.type === "mesh:pair") {
    const pairMsg = message as MeshPairMessage;
    const parsed = parseInviteCode(pairMsg.code);
    if (!parsed) {
      sendTo(clientId, { type: "mesh:pair_failed", message: "Invalid invite code format" });
      return;
    }

    const wsUrl = "ws://" + parsed.address + ":" + parsed.port + "/ws";
    const pairWs = new WebSocket(wsUrl);
    const pairTimeout = setTimeout(function () {
      pairWs.close();
      sendTo(clientId, { type: "mesh:pair_failed", message: "Connection timed out" });
    }, 15000);

    pairWs.addEventListener("open", function () {
      const identity = loadOrCreateIdentity();
      const pairConfig = loadConfig();
      pairWs.send(JSON.stringify({
        type: "mesh:hello",
        nodeId: identity.id,
        name: pairConfig.name,
        publicKey: identity.publicKey,
        token: parsed!.token,
        port: pairConfig.port,
        addresses: getAllAddresses().map(function (a) { return a.address + ":" + pairConfig.port; }),
        projects: getLocalProjectsList(),
      }));
    });

    pairWs.addEventListener("message", function (event: MessageEvent) {
      try {
        const data = JSON.parse(event.data as string) as { type: string; nodeId?: string; name?: string; publicKey?: string; error?: string };

        if (data.type === "mesh:hello_rejected") {
          clearTimeout(pairTimeout);
          pairWs.close();
          sendTo(clientId, { type: "mesh:pair_failed", message: data.error ?? "Pairing rejected by remote node" });
          return;
        }

        if (data.type === "mesh:hello" && data.nodeId && data.name) {
          clearTimeout(pairTimeout);
          const peerAddr = parsed!.address + ":" + parsed!.port;
          const peer: PeerInfo = {
            id: data.nodeId,
            name: data.name,
            addresses: [peerAddr],
            publicKey: data.publicKey ?? "",
            pairedAt: Date.now(),
          };
          addPeer(peer);
          pairWs.close();

          connectToPeer(peer.id, peerAddr);

          const remoteProjectsList = (data as any).projects ?? [];
          const nodeInfo: NodeInfo = {
            id: peer.id,
            name: peer.name,
            address: peerAddr,
            addresses: [peerAddr],
            port: parsed!.port,
            online: true,
            isLocal: false,
            projects: remoteProjectsList.map(function (rp: { slug: string; title: string }) {
              return { slug: rp.slug, path: "", title: rp.title, nodeId: peer.id };
            }),
          };
          sendTo(clientId, { type: "mesh:paired", node: nodeInfo });
          broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
        }
      } catch {
        console.error("[lattice] mesh:pair — invalid handshake response");
      }
    });

    pairWs.addEventListener("error", function () {
      clearTimeout(pairTimeout);
      sendTo(clientId, { type: "mesh:pair_failed", message: "Failed to connect to " + parsed!.address + ":" + parsed!.port });
    });
    return;
  }

  if ((message as any).type === "mesh:hello") {
    const hello = message as any as { type: "mesh:hello"; nodeId: string; name: string; publicKey?: string; token?: string; port?: number; addresses?: string[]; projects: Array<{ slug: string; title: string }> };

    const knownPeer = hello.nodeId ? getPeer(hello.nodeId) : undefined;
    log.meshHello("mesh:hello from nodeId=%s name=%s known=%s", hello.nodeId?.slice(0, 8), hello.name, !!knownPeer);

    if (knownPeer) {
      if (knownPeer.publicKey && hello.publicKey && knownPeer.publicKey !== hello.publicKey) {
        log.meshHello("  ✗ public key mismatch for %s", hello.name);
        sendTo(clientId, { type: "mesh:hello_rejected" as any, error: "Public key mismatch — possible impersonation" });
        return;
      }

      const inboundWs = getClientWebSocket(clientId);
      log.meshHello("  registering inbound connection for %s (ws=%s, projects=%d)", hello.name, !!inboundWs, hello.projects?.length ?? 0);
      if (inboundWs) {
        registerInboundPeer(hello.nodeId, inboundWs as any, hello.projects ?? []);
      }

      const identity = loadOrCreateIdentity();
      sendTo(clientId, {
        type: "mesh:hello" as any,
        nodeId: identity.id,
        name: loadConfig().name,
        publicKey: identity.publicKey,
        projects: getLocalProjectsList(),
      });
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
      return;
    }

    if (!hello.token || !validatePairingToken(hello.token)) {
      sendTo(clientId, { type: "mesh:hello_rejected" as any, error: "Invalid or expired invite code" });
      return;
    }
    consumePairingToken(hello.token);

    const peerAddresses = hello.addresses ?? [];

    const peer: PeerInfo = {
      id: hello.nodeId,
      name: hello.name,
      addresses: peerAddresses,
      publicKey: hello.publicKey ?? "",
      pairedAt: Date.now(),
    };
    addPeer(peer);

    if (peerAddresses.length > 0) {
      connectToPeer(peer.id, peerAddresses[0]);
    }

    const identity2 = loadOrCreateIdentity();
    sendTo(clientId, {
      type: "mesh:hello" as any,
      nodeId: identity2.id,
      name: loadConfig().name,
      publicKey: identity2.publicKey,
      projects: [],
    });

    broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    return;
  }

  if ((message as any).type === "mesh:proxy_request") {
    const proxyReq = message as unknown as MeshProxyRequestMessage;
    log.meshProxy("received proxy_request via handler from %s: %s for %s", clientId.slice(0, 8), (proxyReq.payload as any).type, proxyReq.projectSlug);

    registerVirtualClient("mesh-proxy:" + clientId + ":" + proxyReq.requestId, function (response: object) {
      log.meshProxy("  → sending proxy_response %s back to client %s", (response as any).type, clientId.slice(0, 8));
      sendTo(clientId, {
        type: "mesh:proxy_response",
        projectSlug: proxyReq.projectSlug,
        requestId: proxyReq.requestId,
        payload: response,
      } as any);
      removeVirtualClient("mesh-proxy:" + clientId + ":" + proxyReq.requestId);
    });

    import("../ws/router").then(function (mod) {
      mod.routeMessage("mesh-proxy:" + clientId + ":" + proxyReq.requestId, proxyReq.payload);
    });
    return;
  }

  if ((message as any).type === "mesh:proxy_response") {
    const proxyRes = message as unknown as MeshProxyResponseMessage;
    log.meshProxy("received proxy_response via handler: %s", (proxyRes.payload as any).type);
    handleProxyResponse(proxyRes);
    return;
  }

  if (message.type === "mesh:reconnect") {
    const reconnectMsg = message as { type: "mesh:reconnect"; nodeId: string };
    reconnectPeer(reconnectMsg.nodeId);
    setTimeout(function () {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }, 2000);
    return;
  }

  if (message.type === "mesh:unpair") {
    const unpairMsg = message as MeshUnpairMessage;
    const identity = loadOrCreateIdentity();
    const peerWs = getPeerConnection(unpairMsg.nodeId);
    if (peerWs) {
      peerWs.send(JSON.stringify({ type: "mesh:unpaired", nodeId: identity.id }));
    }
    disconnectPeer(unpairMsg.nodeId);
    const removed = removePeer(unpairMsg.nodeId);
    if (removed) {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }
    return;
  }

  if ((message as any).type === "mesh:unpaired") {
    const unpaired = message as any as { type: "mesh:unpaired"; nodeId: string };
    disconnectPeer(unpaired.nodeId);
    const wasRemoved = removePeer(unpaired.nodeId);
    if (wasRemoved) {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }
    return;
  }
});
