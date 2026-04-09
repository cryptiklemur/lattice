import { Store } from "@tanstack/react-store";
import type { NodeInfo } from "#shared";

export interface MeshState {
  nodes: NodeInfo[];
  selectedNodeId: string | null;
  inviteCode: string | null;
  inviteQr: string | null;
}

const meshStore = new Store<MeshState>({
  nodes: [],
  selectedNodeId: null,
  inviteCode: null,
  inviteQr: null,
});

export function getMeshStore(): Store<MeshState> {
  return meshStore;
}

export function setNodes(nodes: NodeInfo[]): void {
  meshStore.setState(function (state) {
    return { ...state, nodes };
  });
}

export function setNodeOnline(nodeId: string): void {
  meshStore.setState(function (state) {
    const nodes = state.nodes.map(function (n) {
      if (n.id === nodeId) {
        return { ...n, online: true };
      }
      return n;
    });
    return { ...state, nodes };
  });
}

export function setNodeOffline(nodeId: string): void {
  meshStore.setState(function (state) {
    const nodes = state.nodes.map(function (n) {
      if (n.id === nodeId) {
        return { ...n, online: false };
      }
      return n;
    });
    return { ...state, nodes };
  });
}

export function addOrUpdateNode(node: NodeInfo): void {
  meshStore.setState(function (state) {
    const exists = state.nodes.some(function (n) { return n.id === node.id; });
    const nodes = exists
      ? state.nodes.map(function (n) { return n.id === node.id ? node : n; })
      : [...state.nodes, node];
    return { ...state, nodes };
  });
}

export function setSelectedNodeId(nodeId: string | null): void {
  meshStore.setState(function (state) {
    return { ...state, selectedNodeId: nodeId };
  });
}

export function setInvite(code: string, qr: string): void {
  meshStore.setState(function (state) {
    return { ...state, inviteCode: code, inviteQr: qr };
  });
}

export function clearInvite(): void {
  meshStore.setState(function (state) {
    return { ...state, inviteCode: null, inviteQr: null };
  });
}
