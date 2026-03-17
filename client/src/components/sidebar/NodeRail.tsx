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
    <div className="relative">
      <button
        onClick={props.onClick}
        title={props.node.name}
        onMouseEnter={function () { setHovered(true); }}
        onMouseLeave={function () { setHovered(false); }}
        className={
          "w-9 h-9 flex items-center justify-center text-[11px] font-bold tracking-[0.02em] cursor-pointer transition-all duration-[120ms] " +
          (props.isActive
            ? "rounded-[10px] bg-primary text-primary-content border border-transparent"
            : props.node.isLocal
            ? "rounded-full bg-base-300 text-base-content/60 border border-base-content/20"
            : "rounded-full bg-base-200 text-base-content/60 border border-transparent")
        }
      >
        {initials}
      </button>

      <div
        className={
          "absolute bottom-[1px] right-[1px] w-2 h-2 rounded-full border-[1.5px] border-base-200 pointer-events-none " +
          (props.node.online ? "bg-success" : "bg-base-content/30")
        }
      />

      {hovered && (
        <div
          className="fixed pointer-events-none z-[9000] bg-base-300 border border-base-content/20 rounded px-2 py-1 text-xs text-base-content whitespace-nowrap shadow-xl"
          style={{
            left: "calc(var(--node-rail-width, 52px) + 8px)",
            transform: "translateY(-50%)",
          }}
        >
          {props.node.name}
          {props.node.isLocal && (
            <span className="text-base-content/40 ml-1.5">(this machine)</span>
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
      className={
        "w-9 h-9 flex items-center justify-center text-[10px] font-bold tracking-[0.02em] cursor-pointer transition-all duration-[120ms] border " +
        (props.isActive
          ? "rounded-[10px] bg-primary text-primary-content border-transparent"
          : "rounded-full bg-base-300 text-base-content/40 border-base-content/20")
      }
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
    <div className="w-[52px] flex-shrink-0 flex flex-col items-center pt-2.5 pb-2.5 gap-1.5 bg-base-100 border-r border-base-300 overflow-y-auto overflow-x-hidden">
      {localNode && (
        <NodeButton
          node={localNode}
          isActive={props.activeNodeId === localNode.id}
          onClick={(function (n) {
            return function () {
              props.onSelectNode(
                props.activeNodeId === n.id ? null : n.id
              );
            };
          })(localNode)}
        />
      )}

      {remoteNodes.length > 0 && (
        <div className="w-5 h-px bg-base-300 my-0.5" />
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
          <div className="w-5 h-px bg-base-300 my-0.5" />
          <AllButton
            isActive={props.activeNodeId === null}
            onClick={function () { props.onSelectNode(null); }}
          />
        </>
      )}
    </div>
  );
}
