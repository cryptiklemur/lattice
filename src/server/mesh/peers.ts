import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PeerInfo } from "#shared";
import { getLatticeHome } from "../config";

function getPeersPath(): string {
  return join(getLatticeHome(), "peers.json");
}

export function loadPeers(): PeerInfo[] {
  const path = getPeersPath();
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as PeerInfo[];
}

export function savePeers(peers: PeerInfo[]): void {
  const path = getPeersPath();
  writeFileSync(path, JSON.stringify(peers, null, 2), "utf-8");
}

export function addPeer(peer: PeerInfo): void {
  const peers = loadPeers();
  const idx = peers.findIndex(function (p) { return p.id === peer.id; });
  if (idx >= 0) {
    peers[idx] = peer;
  } else {
    const addrSet = new Set(peer.addresses);
    const dupeIdx = peers.findIndex(function (p) {
      return p.addresses.some(function (a) { return addrSet.has(a); });
    });
    if (dupeIdx >= 0) {
      peers[dupeIdx] = peer;
    } else {
      peers.push(peer);
    }
  }
  savePeers(peers);
}

export function removePeer(nodeId: string): boolean {
  const peers = loadPeers();
  const next = peers.filter(function (p) { return p.id !== nodeId; });
  if (next.length === peers.length) {
    return false;
  }
  savePeers(next);
  return true;
}

export function getPeer(nodeId: string): PeerInfo | undefined {
  const peers = loadPeers();
  return peers.find(function (p) { return p.id === nodeId; });
}

export function isPaired(nodeId: string): boolean {
  return getPeer(nodeId) !== undefined;
}
