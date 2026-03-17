import { useState } from "react";
import type { NodeInfo } from "@lattice/shared";

interface NodeButtonProps {
  node: NodeInfo;
  isActive: boolean;
  onClick: () => void;
}

function getInitials(name: string): string {
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function NodeButton(props: NodeButtonProps) {
  var [hovered, setHovered] = useState(false);
  var initials = getInitials(props.node.name);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={props.onClick}
        title={props.node.name}
        onMouseEnter={function () { setHovered(true); }}
        onMouseLeave={function () { setHovered(false); }}
        style={{
          width: "36px",
          height: "36px",
          borderRadius: props.isActive ? "10px" : "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          fontFamily: "var(--font-ui)",
          background: props.isActive
            ? "var(--accent)"
            : props.node.isLocal
            ? "var(--bg-overlay)"
            : "var(--bg-tertiary)",
          color: props.isActive
            ? "var(--accent-fg, #fff)"
            : "var(--text-secondary)",
          border: props.node.isLocal && !props.isActive
            ? "1px solid var(--border-default)"
            : "1px solid transparent",
          transition: "border-radius var(--transition-fast), background var(--transition-fast)",
          cursor: "pointer",
          position: "relative",
        }}
        onFocus={function (e) {
          (e.currentTarget as HTMLButtonElement).style.outline = "2px solid var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.outlineOffset = "2px";
        }}
        onBlur={function (e) {
          (e.currentTarget as HTMLButtonElement).style.outline = "none";
        }}
      >
        {initials}
      </button>

      <div
        style={{
          position: "absolute",
          bottom: "1px",
          right: "1px",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: props.node.online ? "var(--green)" : "var(--text-muted)",
          border: "1.5px solid var(--bg-secondary)",
          pointerEvents: "none",
        }}
      />

      {hovered && (
        <div
          style={{
            position: "fixed",
            left: "calc(var(--node-rail-width, 52px) + 8px)",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            zIndex: 9000,
            background: "var(--bg-tooltip, var(--bg-overlay))",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            fontSize: "12px",
            color: "var(--text-primary)",
            fontFamily: "var(--font-ui)",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {props.node.name}
          {props.node.isLocal && (
            <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
              (this machine)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface AllButtonProps {
  isActive: boolean;
  onClick: () => void;
}

function AllButton(props: AllButtonProps) {
  return (
    <button
      onClick={props.onClick}
      title="All nodes"
      style={{
        width: "36px",
        height: "36px",
        borderRadius: props.isActive ? "10px" : "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: "var(--font-ui)",
        background: props.isActive ? "var(--accent)" : "var(--bg-overlay)",
        color: props.isActive ? "var(--accent-fg, #fff)" : "var(--text-muted)",
        border: "1px solid var(--border-subtle)",
        transition: "border-radius var(--transition-fast), background var(--transition-fast)",
        cursor: "pointer",
      }}
    >
      ALL
    </button>
  );
}

interface NodeRailProps {
  nodes: NodeInfo[];
  activeNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

export function NodeRail(props: NodeRailProps) {
  var localNode = props.nodes.find(function (n) { return n.isLocal; });
  var remoteNodes = props.nodes.filter(function (n) { return !n.isLocal; });

  return (
    <div
      style={{
        width: "52px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "10px",
        paddingBottom: "10px",
        gap: "6px",
        background: "var(--bg-primary)",
        borderRight: "1px solid var(--border-subtle)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {localNode && (
        <NodeButton
          node={localNode}
          isActive={props.activeNodeId === localNode.id}
          onClick={function () {
            props.onSelectNode(
              props.activeNodeId === localNode.id ? null : localNode.id
            );
          }}
        />
      )}

      {remoteNodes.length > 0 && (
        <div
          style={{
            width: "20px",
            height: "1px",
            background: "var(--border-subtle)",
            margin: "2px 0",
          }}
        />
      )}

      {remoteNodes.map(function (node) {
        return (
          <NodeButton
            key={node.id}
            node={node}
            isActive={props.activeNodeId === node.id}
            onClick={function () {
              props.onSelectNode(
                props.activeNodeId === node.id ? null : node.id
              );
            }}
          />
        );
      })}

      {props.nodes.length > 1 && (
        <>
          <div
            style={{
              width: "20px",
              height: "1px",
              background: "var(--border-subtle)",
              margin: "2px 0",
            }}
          />
          <AllButton
            isActive={props.activeNodeId === null}
            onClick={function () { props.onSelectNode(null); }}
          />
        </>
      )}
    </div>
  );
}
