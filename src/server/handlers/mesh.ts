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
import { getConnectedPeerIds, connectToPeer, reconnectPeer, getPeerConnection, disconnectPeer, getConnectedPeerProjects, registerInboundPeer } from "../mesh/connector";
import { getClientWebSocket, registerVirtualClient, removeVirtualClient } from "../ws/broadcast";
import type { PeerInfo } from "#shared";
import { networkInterfaces } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function getLocalAddress(): string {
  var all = getAllAddresses();
  return all.length > 0 ? all[0].address : "localhost";
}

function getAllAddresses(): Array<{ name: string; address: string }> {
  var interfaces = networkInterfaces();
  var keys = Object.keys(interfaces);
  var results: Array<{ name: string; address: string }> = [];
  for (var i = 0; i < keys.length; i++) {
    var addrs = interfaces[keys[i]];
    if (!addrs) continue;
    for (var j = 0; j < addrs.length; j++) {
      if (!addrs[j].internal && addrs[j].family === "IPv4") {
        results.push({ name: keys[i], address: addrs[j].address });
      }
    }
  }

  if (isWSL()) {
    var windowsAddrs = getWindowsHostAddresses();
    for (var w = 0; w < windowsAddrs.length; w++) {
      var exists = results.some(function (r) { return r.address === windowsAddrs[w].address; });
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
      var version = readFileSync("/proc/version", "utf-8");
      return version.toLowerCase().includes("microsoft");
    }
  } catch {}
  return false;
}

function getWindowsHostAddresses(): Array<{ name: string; address: string }> {
  var results: Array<{ name: string; address: string }> = [];
  try {
    var output = execSync(
      "powershell.exe -NoProfile -Command \"Get-NetIPAddress -AddressFamily IPv4 | ForEach-Object { \\$_.IPAddress + '|' + \\$_.InterfaceAlias }\"",
      { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    );
    var lines = output.trim().split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].trim().split("|");
      var ip = parts[0];
      var iface = parts[1] || "windows";
      if (!ip || ip === "127.0.0.1") continue;
      if (ip.startsWith("169.254.")) continue;
      if (iface.includes("WSL")) continue;
      results.push({ name: iface.toLowerCase().replace(/\s+/g, "-"), address: ip });
    }
  } catch {}
  return results;
}

function getLocalProjectsList(): Array<{ slug: string; title: string }> {
  var config = loadConfig();
  return config.projects.map(function (p: typeof config.projects[number]) {
    return { slug: p.slug, title: p.title };
  });
}

export function buildNodesMessage(): NodeInfo[] {
  var peers = loadPeers();
  var config = loadConfig();
  var identity = loadOrCreateIdentity();
  var connectedIds = new Set(getConnectedPeerIds());
  var localAddrs = getAllAddresses().map(function (a) { return a.address + ":" + config.port; });

  var local: NodeInfo = {
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

  var remotes: NodeInfo[] = peers.map(function (peer) {
    var peerProjects = getConnectedPeerProjects(peer.id);
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
    };
  });

  return [local, ...remotes];
}

registerHandler("mesh", function (clientId: string, message: ClientMessage) {
  log.meshHello("mesh message: %s from %s", (message as any).type, clientId.slice(0, 8));

  if (message.type === "mesh:generate_invite") {
    var genMsg = message as any as { type: "mesh:generate_invite"; address?: string };
    var config = loadConfig();
    var address = genMsg.address || getLocalAddress();
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
    var addresses = getAllAddresses();
    sendTo(clientId, { type: "mesh:addresses_result" as any, addresses: addresses });
    return;
  }

  if (message.type === "mesh:pair") {
    var pairMsg = message as MeshPairMessage;
    var parsed = parseInviteCode(pairMsg.code);
    if (!parsed) {
      sendTo(clientId, { type: "mesh:pair_failed", message: "Invalid invite code format" });
      return;
    }

    var wsUrl = "ws://" + parsed.address + ":" + parsed.port + "/ws";
    var pairWs = new WebSocket(wsUrl);
    var pairTimeout = setTimeout(function () {
      pairWs.close();
      sendTo(clientId, { type: "mesh:pair_failed", message: "Connection timed out" });
    }, 15000);

    pairWs.addEventListener("open", function () {
      var identity = loadOrCreateIdentity();
      var pairConfig = loadConfig();
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
        var data = JSON.parse(event.data as string) as { type: string; nodeId?: string; name?: string; publicKey?: string; error?: string };

        if (data.type === "mesh:hello_rejected") {
          clearTimeout(pairTimeout);
          pairWs.close();
          sendTo(clientId, { type: "mesh:pair_failed", message: data.error ?? "Pairing rejected by remote node" });
          return;
        }

        if (data.type === "mesh:hello" && data.nodeId && data.name) {
          clearTimeout(pairTimeout);
          var peerAddr = parsed!.address + ":" + parsed!.port;
          var peer: PeerInfo = {
            id: data.nodeId,
            name: data.name,
            addresses: [peerAddr],
            publicKey: data.publicKey ?? "",
            pairedAt: Date.now(),
          };
          addPeer(peer);
          pairWs.close();

          connectToPeer(peer.id, peerAddr);

          var remoteProjectsList = (data as any).projects ?? [];
          var nodeInfo: NodeInfo = {
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
    var hello = message as any as { type: "mesh:hello"; nodeId: string; name: string; publicKey?: string; token?: string; port?: number; addresses?: string[]; projects: Array<{ slug: string; title: string }> };

    var knownPeer = hello.nodeId ? getPeer(hello.nodeId) : undefined;
    log.meshHello("mesh:hello from nodeId=%s name=%s known=%s", hello.nodeId?.slice(0, 8), hello.name, !!knownPeer);

    if (knownPeer) {
      if (knownPeer.publicKey && hello.publicKey && knownPeer.publicKey !== hello.publicKey) {
        log.meshHello("  ✗ public key mismatch for %s", hello.name);
        sendTo(clientId, { type: "mesh:hello_rejected" as any, error: "Public key mismatch — possible impersonation" });
        return;
      }

      var inboundWs = getClientWebSocket(clientId);
      log.meshHello("  registering inbound connection for %s (ws=%s, projects=%d)", hello.name, !!inboundWs, hello.projects?.length ?? 0);
      if (inboundWs) {
        registerInboundPeer(hello.nodeId, inboundWs as any, hello.projects ?? []);
      }

      var identity = loadOrCreateIdentity();
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

    var peerAddresses = hello.addresses ?? [];

    var peer: PeerInfo = {
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

    var identity2 = loadOrCreateIdentity();
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
    var proxyReq = message as unknown as MeshProxyRequestMessage;
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
    var proxyRes = message as unknown as MeshProxyResponseMessage;
    log.meshProxy("received proxy_response via handler: %s", (proxyRes.payload as any).type);
    handleProxyResponse(proxyRes);
    return;
  }

  if (message.type === "mesh:reconnect") {
    var reconnectMsg = message as { type: "mesh:reconnect"; nodeId: string };
    reconnectPeer(reconnectMsg.nodeId);
    setTimeout(function () {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }, 2000);
    return;
  }

  if (message.type === "mesh:unpair") {
    var unpairMsg = message as MeshUnpairMessage;
    var identity = loadOrCreateIdentity();
    var peerWs = getPeerConnection(unpairMsg.nodeId);
    if (peerWs) {
      peerWs.send(JSON.stringify({ type: "mesh:unpaired", nodeId: identity.id }));
    }
    disconnectPeer(unpairMsg.nodeId);
    var removed = removePeer(unpairMsg.nodeId);
    if (removed) {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }
    return;
  }

  if ((message as any).type === "mesh:unpaired") {
    var unpaired = message as any as { type: "mesh:unpaired"; nodeId: string };
    disconnectPeer(unpaired.nodeId);
    var wasRemoved = removePeer(unpaired.nodeId);
    if (wasRemoved) {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }
    return;
  }
});
