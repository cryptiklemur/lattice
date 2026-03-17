import type { ClientMessage, MeshPairMessage, MeshUnpairMessage, NodeInfo } from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { loadConfig } from "../config";
import { loadOrCreateIdentity } from "../identity";
import { generateInviteCode, parseInviteCode, validatePairingToken, consumePairingToken } from "../mesh/pairing";
import { addPeer, removePeer, loadPeers } from "../mesh/peers";
import type { PeerInfo } from "@lattice/shared";

function buildNodesMessage(): NodeInfo[] {
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
    projects: config.projects.map(function (p) {
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
    var config = loadConfig();
    generateInviteCode("localhost", config.port).then(function (result) {
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

  if (message.type === "mesh:pair") {
    var pairMsg = message as MeshPairMessage;
    var parsed = parseInviteCode(pairMsg.code);
    if (!parsed) {
      console.warn("[lattice] mesh:pair — invalid invite code");
      return;
    }
    if (!validatePairingToken(parsed.token)) {
      console.warn("[lattice] mesh:pair — invalid or expired token");
      return;
    }
    consumePairingToken(parsed.token);

    var wsUrl = "ws://" + parsed.address + ":" + parsed.port + "/ws";
    var ws = new WebSocket(wsUrl);
    ws.addEventListener("open", function () {
      var identity = loadOrCreateIdentity();
      ws.send(JSON.stringify({
        type: "mesh:hello",
        nodeId: identity.id,
        name: loadConfig().name,
        projects: [],
      }));
    });
    ws.addEventListener("message", function (event: MessageEvent) {
      try {
        var data = JSON.parse(event.data as string) as { type: string; nodeId?: string; name?: string };
        if (data.type === "mesh:hello" && data.nodeId && data.name) {
          var peer: PeerInfo = {
            id: data.nodeId,
            name: data.name,
            addresses: [parsed!.address],
            publicKey: "",
            pairedAt: Date.now(),
          };
          addPeer(peer);
          ws.close();

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
    ws.addEventListener("error", function () {
      console.error("[lattice] mesh:pair — failed to connect to", wsUrl);
    });
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
