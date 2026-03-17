import { useState } from "react";
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-tertiary)",
        marginBottom: "8px",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: props.node.online ? "var(--green)" : "var(--text-muted)",
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.node.name}
          {props.node.isLocal && (
            <span
              style={{
                marginLeft: "6px",
                fontSize: "10px",
                fontWeight: 600,
                color: "var(--accent)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              local
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.node.address}:{props.node.port}
          {!props.node.online && (
            <span style={{ marginLeft: "8px", color: "var(--text-muted)", fontStyle: "italic" }}>
              offline
            </span>
          )}
        </div>
      </div>

      {!props.node.isLocal && (
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {confirming ? (
            <>
              <button
                onClick={handleUnpair}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--red)",
                  background: "var(--red)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
              <button
                onClick={function () { setConfirming(false); }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleUnpair}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                transition: "color var(--transition-fast), border-color var(--transition-fast)",
              }}
              onMouseEnter={function (e) {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--red)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)";
              }}
              onMouseLeave={function (e) {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
              }}
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
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Mesh
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "8px",
            letterSpacing: "0.04em",
          }}
        >
          This Node
        </div>
        {localNode ? (
          <NodeRow node={localNode} onUnpair={handleUnpair} />
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
            Waiting for node info...
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            Paired Nodes
          </div>
          <button
            onClick={function () { setPairingOpen(true); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--accent)",
              background: "transparent",
              color: "var(--accent)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--accent-fg, #fff)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Pair New Node
          </button>
        </div>

        {remoteNodes.length === 0 ? (
          <div
            style={{
              padding: "16px",
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--border-subtle)",
              textAlign: "center",
              fontSize: "12px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
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
