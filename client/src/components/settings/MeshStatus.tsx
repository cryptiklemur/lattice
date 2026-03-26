import { useState, useCallback, memo } from "react";
import { Plus, CircleDot, Circle, RefreshCw } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMesh } from "../../hooks/useMesh";
import { PairingDialog } from "../mesh/PairingDialog";
import type { NodeInfo } from "@lattice/shared";

interface NodeRowProps {
  node: NodeInfo;
  onUnpair: (nodeId: string) => void;
  onReconnect: (nodeId: string) => void;
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
    <div className="flex items-center gap-3 p-3 sm:p-2.5 px-3.5 rounded-lg border border-base-content/15 bg-base-300 mb-2">
      {props.node.online ? (
        <CircleDot size={10} className="text-success flex-shrink-0" aria-label="Online" />
      ) : (
        <Circle size={10} className="text-base-content/30 flex-shrink-0" aria-label="Offline" />
      )}

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-base-content truncate">
          {props.node.name}
          {props.node.isLocal && (
            <span className="ml-1.5 text-[10px] font-semibold text-primary uppercase tracking-[0.06em]">
              local
            </span>
          )}
        </div>
        <div className="text-[11px] text-base-content/40">
          {(props.node.addresses && props.node.addresses.length > 0
            ? props.node.addresses
            : [props.node.address + (props.node.port ? ":" + props.node.port : "")]
          ).map(function (addr, i) {
            return (
              <span key={addr} className="mr-2">
                {i > 0 && <span className="text-base-content/20 mr-2">/</span>}
                {addr}
              </span>
            );
          })}
        </div>
      </div>

      {!props.node.isLocal && (
        <div className="flex gap-1.5 flex-shrink-0">
          {!props.node.online && (
            <button
              onClick={function () { props.onReconnect(props.node.id); }}
              className="btn btn-ghost btn-xs border border-base-content/20 hover:btn-info hover:border-info gap-1"
              title="Attempt to reconnect"
            >
              <RefreshCw size={10} />
              Reconnect
            </button>
          )}
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

  var handleClosePairing = useCallback(function () { setPairingOpen(false); }, []);

  function handleUnpair(nodeId: string) {
    ws.send({ type: "mesh:unpair", nodeId });
  }

  function handleReconnect(nodeId: string) {
    ws.send({ type: "mesh:reconnect", nodeId } as any);
  }

  var localNode = nodes.find(function (n) { return n.isLocal; });
  var remoteNodes = nodes.filter(function (n) { return !n.isLocal; });

  return (
    <div className="py-2">
      <div className="mb-5">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2 tracking-[0.06em]">
          This Node
        </div>
        {localNode ? (
          <NodeRow node={localNode} onUnpair={handleUnpair} onReconnect={handleReconnect} />
        ) : (
          <div className="text-[12px] text-base-content/40 italic">
            Waiting for node info...
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-semibold text-base-content/40 tracking-[0.06em]">
            Paired Nodes
          </div>
          <button
            onClick={function () { setPairingOpen(true); }}
            className="btn btn-primary btn-sm sm:btn-xs gap-1"
          >
            <Plus size={10} />
            Pair New Node
          </button>
        </div>

        {remoteNodes.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-base-content/15 text-center text-[12px] text-base-content/40 italic">
            No paired nodes yet.
          </div>
        ) : (
          remoteNodes.map(function (node) {
            return (
              <NodeRow
                key={node.id}
                node={node}
                onUnpair={handleUnpair}
                onReconnect={handleReconnect}
              />
            );
          })
        )}
      </div>

      <PairingDialog
        isOpen={pairingOpen}
        onClose={handleClosePairing}
      />
    </div>
  );
}
