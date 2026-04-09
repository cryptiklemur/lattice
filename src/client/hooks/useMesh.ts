import { useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import type { ServerMessage, NodeInfo } from "#shared";
import { useWebSocket } from "./useWebSocket";
import {
  getMeshStore,
  setNodes,
  setNodeOnline,
  setNodeOffline,
  addOrUpdateNode,
  setSelectedNodeId,
  setInvite,
} from "../stores/mesh";

export interface UseMeshResult {
  nodes: NodeInfo[];
  activeNodeId: string | null;
  setActiveNodeId: (id: string | null) => void;
  generateInvite: () => void;
  inviteCode: string | null;
  inviteQr: string | null;
}

export function useMesh(): UseMeshResult {
  const ws = useWebSocket();
  const store = getMeshStore();

  const nodes = useStore(store, function (s) { return s.nodes; });
  const activeNodeId = useStore(store, function (s) { return s.selectedNodeId; });
  const inviteCode = useStore(store, function (s) { return s.inviteCode; });
  const inviteQr = useStore(store, function (s) { return s.inviteQr; });

  const handleRef = useRef<(msg: ServerMessage) => void>(function () {});

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "mesh:nodes") {
        setNodes(msg.nodes);
      } else if (msg.type === "mesh:node_online") {
        setNodeOnline(msg.nodeId);
      } else if (msg.type === "mesh:node_offline") {
        setNodeOffline(msg.nodeId);
      } else if (msg.type === "mesh:paired") {
        addOrUpdateNode(msg.node);
      } else if (msg.type === "mesh:invite_code") {
        setInvite(msg.code, msg.qrDataUrl);
      }
    };
  });

  useEffect(function () {
    function handler(msg: ServerMessage) {
      handleRef.current(msg);
    }

    ws.subscribe("mesh:nodes", handler);
    ws.subscribe("mesh:node_online", handler);
    ws.subscribe("mesh:node_offline", handler);
    ws.subscribe("mesh:paired", handler);
    ws.subscribe("mesh:invite_code", handler);

    return function () {
      ws.unsubscribe("mesh:nodes", handler);
      ws.unsubscribe("mesh:node_online", handler);
      ws.unsubscribe("mesh:node_offline", handler);
      ws.unsubscribe("mesh:paired", handler);
      ws.unsubscribe("mesh:invite_code", handler);
    };
  }, [ws]);

  useEffect(function () {
    if (ws.status === "connected") {
      ws.send({ type: "settings:get" });
    }
  }, [ws.status, ws]);

  function generateInvite() {
    ws.send({ type: "mesh:generate_invite" });
  }

  return {
    nodes,
    activeNodeId,
    setActiveNodeId: setSelectedNodeId,
    generateInvite,
    inviteCode,
    inviteQr,
  };
}
