import type { ClientMessage, MeshPairMessage, MeshUnpairMessage, NodeInfo } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { loadConfig } from "../config";
import { loadOrCreateIdentity } from "../identity";
import { generateInviteCode, parseInviteCode, validatePairingToken, consumePairingToken } from "../mesh/pairing";
import { addPeer, removePeer, loadPeers } from "../mesh/peers";
import type { PeerInfo } from "@lattice/shared";
import { networkInterfaces } from "node:os";

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
  return results;
}

export function buildNodesMessage(): NodeInfo[] {
  var peers = loadPeers();
  var config = loadConfig();
  var identity = loadOrCreateIdentity();

  var local: NodeInfo = {
    id: identity.id,
    name: config.name,
    address: "localhost",
    port: config.port,
    online: true,
    isLocal: true,
    projects: config.projects.map(function (p: typeof config.projects[number]) {
      return { slug: p.slug, path: p.path, title: p.title, nodeId: identity.id };
    }),
  };

  var remotes: NodeInfo[] = peers.map(function (peer) {
    return {
      id: peer.id,
      name: peer.name,
      address: peer.addresses[0] ?? "",
      port: 0,
      online: false,
      isLocal: false,
      projects: [],
    };
  });

  return [local, ...remotes];
}

registerHandler("mesh", function (clientId: string, message: ClientMessage) {
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
      pairWs.send(JSON.stringify({
        type: "mesh:hello",
        nodeId: identity.id,
        name: loadConfig().name,
        token: parsed!.token,
        projects: [],
      }));
    });

    pairWs.addEventListener("message", function (event: MessageEvent) {
      try {
        var data = JSON.parse(event.data as string) as { type: string; nodeId?: string; name?: string; error?: string };

        if (data.type === "mesh:hello_rejected") {
          clearTimeout(pairTimeout);
          pairWs.close();
          sendTo(clientId, { type: "mesh:pair_failed", message: data.error ?? "Pairing rejected by remote node" });
          return;
        }

        if (data.type === "mesh:hello" && data.nodeId && data.name) {
          clearTimeout(pairTimeout);
          var peer: PeerInfo = {
            id: data.nodeId,
            name: data.name,
            addresses: [parsed!.address],
            publicKey: "",
            pairedAt: Date.now(),
          };
          addPeer(peer);
          pairWs.close();

          var nodeInfo: NodeInfo = {
            id: peer.id,
            name: peer.name,
            address: parsed!.address,
            port: parsed!.port,
            online: true,
            isLocal: false,
            projects: [],
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
    var hello = message as any as { type: "mesh:hello"; nodeId: string; name: string; token?: string; projects: Array<{ slug: string; title: string }> };

    if (!hello.token || !validatePairingToken(hello.token)) {
      sendTo(clientId, { type: "mesh:hello_rejected" as any, error: "Invalid or expired invite code" });
      return;
    }
    consumePairingToken(hello.token);

    var peer: PeerInfo = {
      id: hello.nodeId,
      name: hello.name,
      addresses: [],
      publicKey: "",
      pairedAt: Date.now(),
    };
    addPeer(peer);

    var identity = loadOrCreateIdentity();
    sendTo(clientId, {
      type: "mesh:hello" as any,
      nodeId: identity.id,
      name: loadConfig().name,
      projects: [],
    });

    broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    return;
  }

  if (message.type === "mesh:unpair") {
    var unpairMsg = message as MeshUnpairMessage;
    var removed = removePeer(unpairMsg.nodeId);
    if (removed) {
      broadcast({ type: "mesh:nodes", nodes: buildNodesMessage() });
    }
    return;
  }
});
