import { useState, useRef, useEffect } from "react";
import type { NodeInfo } from "@lattice/shared";
import { LatticeLogomark } from "../ui/LatticeLogomark";

interface NodeButtonProps {
  node: NodeInfo;
  isActive: boolean;
  onClick: () => void;
  buttonRef?: React.RefCallback<HTMLButtonElement>;
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
  var [tooltipTop, setTooltipTop] = useState(0);
  var initials = getInitials(props.node.name);

  return (
    <div className="relative">
      <button
        ref={props.buttonRef}
        onClick={props.onClick}
        title={props.node.name}
        onMouseEnter={function (e) {
          var rect = e.currentTarget.getBoundingClientRect();
          setTooltipTop(rect.top + rect.height / 2);
          setHovered(true);
        }}
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
          className="pointer-events-none z-[9000] bg-base-300 border border-base-content/20 rounded px-2 py-1 text-xs text-base-content whitespace-nowrap shadow-xl"
          style={{
            position: "fixed",
            left: "calc(var(--node-rail-width, 52px) + 8px)",
            top: tooltipTop + "px",
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
      <span className={props.isActive ? "text-primary-content" : "text-base-content/40"}>
        <LatticeLogomark size={18} />
      </span>
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

  var allNodes = localNode
    ? [localNode, ...remoteNodes]
    : [...remoteNodes];

  var buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  var containerRef = useRef<HTMLDivElement>(null);
  var [lineSegments, setLineSegments] = useState<{ y1: number; y2: number; active: boolean }[]>([]);

  useEffect(function () {
    if (!containerRef.current) return;
    var containerRect = containerRef.current.getBoundingClientRect();
    var onlineRefs: { y: number; index: number }[] = [];

    allNodes.forEach(function (node, i) {
      var el = buttonRefs.current[i];
      if (!el || !node.online) return;
      var rect = el.getBoundingClientRect();
      onlineRefs.push({ y: rect.top + rect.height / 2 - containerRect.top, index: i });
    });

    var segments: { y1: number; y2: number; active: boolean }[] = [];
    for (var s = 0; s < onlineRefs.length - 1; s++) {
      var a = onlineRefs[s];
      var b = onlineRefs[s + 1];
      var nodeA = allNodes[a.index];
      var nodeB = allNodes[b.index];
      var bothActive =
        (props.activeNodeId === nodeA.id || props.activeNodeId === null) &&
        (props.activeNodeId === nodeB.id || props.activeNodeId === null);
      segments.push({ y1: a.y, y2: b.y, active: bothActive });
    }
    setLineSegments(segments);
  });

  return (
    <div
      ref={containerRef}
      className="relative w-[52px] flex-shrink-0 flex flex-col items-center pt-2.5 pb-2.5 gap-1.5 bg-base-100 border-r border-base-300 overflow-y-auto overflow-x-hidden"
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        {lineSegments.map(function (seg, i) {
          return (
            <line
              key={i}
              x1="26"
              y1={seg.y1}
              x2="26"
              y2={seg.y2}
              stroke={seg.active ? "oklch(var(--p))" : "oklch(var(--bc) / 0.15)"}
              strokeWidth="1"
            />
          );
        })}
      </svg>

      {localNode && (
        <div className="relative z-10">
          <NodeButton
            node={localNode}
            isActive={props.activeNodeId === localNode.id}
            buttonRef={function (el) { buttonRefs.current[0] = el; }}
            onClick={(function (n) {
              return function () {
                props.onSelectNode(
                  props.activeNodeId === n.id ? null : n.id
                );
              };
            })(localNode)}
          />
        </div>
      )}

      {remoteNodes.length > 0 && (
        <div className="relative z-10 w-5 h-px bg-base-300 my-0.5" />
      )}

      {remoteNodes.map(function (node, i) {
        var refIndex = localNode ? i + 1 : i;
        return (
          <div key={node.id} className="relative z-10">
            <NodeButton
              node={node}
              isActive={props.activeNodeId === node.id}
              buttonRef={function (el) { buttonRefs.current[refIndex] = el; }}
              onClick={function () {
                props.onSelectNode(
                  props.activeNodeId === node.id ? null : node.id
                );
              }}
            />
          </div>
        );
      })}

      {props.nodes.length > 1 && (
        <>
          <div className="relative z-10 w-5 h-px bg-base-300 my-0.5" />
          <div className="relative z-10">
            <AllButton
              isActive={props.activeNodeId === null}
              onClick={function () { props.onSelectNode(null); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
