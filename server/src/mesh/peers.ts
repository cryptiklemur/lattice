import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PeerInfo } from "@lattice/shared";
import { getLatticeHome } from "../config";

function getPeersPath(): string {
  return join(getLatticeHome(), "peers.json");
}

export function loadPeers(): PeerInfo[] {
  var path = getPeersPath();
  if (!existsSync(path)) {
    return [];
  }
  var raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as PeerInfo[];
}

export function savePeers(peers: PeerInfo[]): void {
  var path = getPeersPath();
  writeFileSync(path, JSON.stringify(peers, null, 2), "utf-8");
}

export function addPeer(peer: PeerInfo): void {
  var peers = loadPeers();
  var idx = peers.findIndex(function (p) { return p.id === peer.id; });
  if (idx >= 0) {
    peers[idx] = peer;
  } else {
    peers.push(peer);
  }
  savePeers(peers);
}

export function removePeer(nodeId: string): boolean {
  var peers = loadPeers();
  var next = peers.filter(function (p) { return p.id !== nodeId; });
  if (next.length === peers.length) {
    return false;
  }
  savePeers(next);
  return true;
}

export function getPeer(nodeId: string): PeerInfo | undefined {
  var peers = loadPeers();
  return peers.find(function (p) { return p.id === nodeId; });
}

export function isPaired(nodeId: string): boolean {
  return getPeer(nodeId) !== undefined;
}
