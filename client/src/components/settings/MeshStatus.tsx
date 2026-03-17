import { useState } from "react";
import { Plus } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMesh } from "../../hooks/useMesh";
import { PairingDialog } from "../mesh/PairingDialog";
import type { NodeInfo } from "@lattice/shared";

interface NodeRowProps {
  node: NodeInfo;
  onUnpair: (nodeId: string) => void;
}

function NodeRow(props: NodeRowProps) {
  var [confirming, setConfirming] = useState(false);

  function handleUnpair() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    props.onUnpair(props.node.id);
    setConfirming(false);
  }

  return (
    <div className="flex items-center gap-3 p-2.5 px-3.5 rounded border border-base-300 bg-base-300 mb-2">
      <div
        className={
          "w-2 h-2 rounded-full flex-shrink-0 " +
          (props.node.online ? "bg-success" : "bg-base-content/30")
        }
      />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-base-content truncate">
          {props.node.name}
          {props.node.isLocal && (
            <span className="ml-1.5 text-[10px] font-semibold text-primary uppercase tracking-[0.06em]">
              local
            </span>
          )}
        </div>
        <div className="text-[11px] text-base-content/40 truncate">
          {props.node.address}:{props.node.port}
          {!props.node.online && (
            <span className="ml-2 text-base-content/30 italic">offline</span>
          )}
        </div>
      </div>

      {!props.node.isLocal && (
        <div className="flex gap-1.5 flex-shrink-0">
          {confirming ? (
            <>
              <button
                onClick={handleUnpair}
                className="btn btn-error btn-xs"
              >
                Confirm
              </button>
              <button
                onClick={function () { setConfirming(false); }}
                className="btn btn-ghost btn-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleUnpair}
              className="btn btn-ghost btn-xs border border-base-content/20 hover:btn-error hover:border-error"
            >
              Unpair
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MeshStatus() {
  var ws = useWebSocket();
  var { nodes } = useMesh();
  var [pairingOpen, setPairingOpen] = useState(false);

  function handleUnpair(nodeId: string) {
    ws.send({ type: "mesh:unpair", nodeId });
  }

  var localNode = nodes.find(function (n) { return n.isLocal; });
  var remoteNodes = nodes.filter(function (n) { return !n.isLocal; });

  return (
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Mesh
      </div>

      <div className="mb-5">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2 tracking-[0.04em]">
          This Node
        </div>
        {localNode ? (
          <NodeRow node={localNode} onUnpair={handleUnpair} />
        ) : (
          <div className="text-[12px] text-base-content/40 italic">
            Waiting for node info...
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-semibold text-base-content/40 tracking-[0.04em]">
            Paired Nodes
          </div>
          <button
            onClick={function () { setPairingOpen(true); }}
            className="btn btn-primary btn-xs gap-1"
          >
            <Plus size={10} />
            Pair New Node
          </button>
        </div>

        {remoteNodes.length === 0 ? (
          <div className="p-4 rounded border border-dashed border-base-300 text-center text-[12px] text-base-content/40 italic">
            No paired nodes yet.
          </div>
        ) : (
          remoteNodes.map(function (node) {
            return (
              <NodeRow
                key={node.id}
                node={node}
                onUnpair={handleUnpair}
              />
            );
          })
        )}
      </div>

      <PairingDialog
        isOpen={pairingOpen}
        onClose={function () { setPairingOpen(false); }}
      />
    </div>
  );
}
