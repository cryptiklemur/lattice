import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Settings, PlusCircle, Trash2, Unplug, RefreshCw } from "lucide-react";
import type { ProjectInfo, NodeInfo } from "#shared";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { ContextMenu, useContextMenu } from "../ui/ContextMenu";
import type { ContextMenuEntry } from "../ui/ContextMenu";

function getProjectInitials(title: string): string {
  var words = title.trim().split(/[\s\-_]+/);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.slice(0, 3).toUpperCase();
}

interface ProjectGroup {
  slug: string;
  title: string;
  activeSessions: number;
  nodes: Array<{ nodeId: string; nodeName: string; online: boolean; path: string }>;
}

function groupProjectsBySlug(projects: ProjectInfo[], nodes: NodeInfo[]): ProjectGroup[] {
  var groups = new Map<string, ProjectGroup>();
  for (var i = 0; i < projects.length; i++) {
    var p = projects[i];
    var existing = groups.get(p.slug);
    var node = nodes.find(function (n) { return n.id === p.nodeId; });
    var nodeEntry = {
      nodeId: p.nodeId,
      nodeName: p.nodeName,
      online: node ? node.online : (p.online ?? !p.isRemote),
      path: p.path,
    };
    if (existing) {
      existing.nodes.push(nodeEntry);
      existing.activeSessions += p.activeSessions ?? 0;
    } else {
      groups.set(p.slug, { slug: p.slug, title: p.title, activeSessions: p.activeSessions ?? 0, nodes: [nodeEntry] });
    }
  }
  return Array.from(groups.values());
}

interface ProjectButtonProps {
  group: ProjectGroup;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent, slug: string) => void;
}

function ProjectButton(props: ProjectButtonProps) {
  var [hovered, setHovered] = useState(false);
  var [tooltipTop, setTooltipTop] = useState(0);
  var initials = getProjectInitials(props.group.title);

  return (
    <div className="relative flex items-center">
      {props.isActive && (
        <div
          className="absolute -left-3 w-[3px] bg-base-content rounded-r-full pointer-events-none"
          style={{ height: "32px", top: "50%", transform: "translateY(-50%)" }}
        />
      )}

      <button
        onClick={props.onClick}
        onContextMenu={function (e) {
          e.preventDefault();
          props.onContextMenu(e, props.group.slug);
        }}
        onMouseEnter={function (e) {
          var rect = e.currentTarget.getBoundingClientRect();
          setTooltipTop(rect.top + rect.height / 2);
          setHovered(true);
        }}
        onMouseLeave={function () { setHovered(false); }}
        className={
          "w-[42px] h-[42px] flex items-center justify-center text-[11px] font-bold tracking-[0.03em] cursor-pointer transition-all duration-[120ms] flex-shrink-0 " +
          (props.isActive
            ? "rounded-xl bg-base-content/10 text-base-content ring-1 ring-base-content/20"
            : hovered
            ? "rounded-xl bg-base-200 text-base-content/60"
            : "rounded-full bg-base-200 text-base-content/40")
        }
      >
        {initials}
      </button>

      {props.group.activeSessions > 0 && (
        <div className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-success/80 text-success-content text-[8px] font-bold flex items-center justify-center pointer-events-none px-0.5">
          {props.group.activeSessions}
        </div>
      )}

      <div className="absolute bottom-0 right-0 flex gap-[2px] pointer-events-none">
        {props.group.nodes.map(function (n) {
          return (
            <div
              key={n.nodeId}
              className={
                "w-[8px] h-[8px] rounded-full border border-base-100 " +
                (n.online ? "bg-success/70" : "bg-base-content/20")
              }
            />
          );
        })}
      </div>

      {hovered && createPortal(
        <div
          className="pointer-events-none z-[99999] bg-base-300 border border-base-content/20 rounded-lg px-2.5 py-1.5 shadow-xl"
          style={{
            position: "fixed",
            left: "calc(64px + 8px)",
            top: tooltipTop + "px",
            transform: "translateY(-50%)",
          }}
        >
          <div className="text-[12px] font-bold text-base-content whitespace-nowrap">{props.group.title}</div>
          {props.group.nodes.map(function (n) {
            return (
              <div key={n.nodeId} className="flex items-center gap-1.5 mt-0.5">
                <div className={"w-[6px] h-[6px] rounded-full flex-shrink-0 " + (n.online ? "bg-success" : "bg-error")} />
                <span className="text-[10px] text-base-content/50 whitespace-nowrap">
                  {n.nodeName}
                  {n.path ? " \u00B7 " + n.path : ""}
                </span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function NodeIndicator({ node, onContextMenu }: { node: NodeInfo; onContextMenu: (e: React.MouseEvent, node: NodeInfo) => void }) {
  var [hovered, setHovered] = useState(false);
  var [tooltipTop, setTooltipTop] = useState(0);
  var sidebar = useSidebar();
  var initial = node.name.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center">
      <button
        onClick={function () { sidebar.openSettings("nodes"); }}
        onContextMenu={function (e) { e.preventDefault(); onContextMenu(e, node); }}
        onMouseEnter={function (e) {
          var rect = e.currentTarget.getBoundingClientRect();
          setTooltipTop(rect.top + rect.height / 2);
          setHovered(true);
        }}
        onMouseLeave={function () { setHovered(false); }}
        className={
          "w-[26px] h-[26px] flex items-center justify-center text-[9px] font-semibold rounded-full cursor-pointer transition-all duration-[120ms] flex-shrink-0 border " +
          (node.online
            ? "border-success/30 bg-base-200/60 text-base-content/40 hover:bg-base-200"
            : "border-base-content/10 bg-base-200/30 text-base-content/20 hover:bg-base-200/40")
        }
      >
        {initial}
      </button>
      {hovered && createPortal(
        <div
          className="pointer-events-none z-[99999] bg-base-300 border border-base-content/20 rounded-lg px-2.5 py-1.5 shadow-xl"
          style={{
            position: "fixed",
            left: "calc(64px + 8px)",
            top: tooltipTop + "px",
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className={"w-[6px] h-[6px] rounded-full flex-shrink-0 " + (node.online ? "bg-success" : "bg-error")} />
            <span className="text-[12px] font-bold text-base-content whitespace-nowrap">{node.name}</span>
          </div>
          {node.addresses && node.addresses.length > 0 && (
            <div className="text-[10px] text-base-content/40 mt-0.5 whitespace-nowrap">
              {node.addresses[0]}
            </div>
          )}
          <div className="text-[10px] text-base-content/30 mt-0.5">
            {node.projects.length} project{node.projects.length !== 1 ? "s" : ""}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface ProjectRailProps {
  projects: ProjectInfo[];
  nodes: NodeInfo[];
  activeProjectSlug: string | null;
  onSelectProject: (slug: string) => void;
  onDashboardClick: () => void;
  isDashboardActive: boolean;
  dimmed?: boolean;
}

export function ProjectRail(props: ProjectRailProps) {
  var ws = useWebSocket();
  var sidebar = useSidebar();
  var groups = groupProjectsBySlug(props.projects, props.nodes);
  var localNode = props.nodes.find(function (n) { return n.isLocal; });
  var remoteNodes = props.nodes.filter(function (n) { return !n.isLocal; });
  var allMeshNodes = localNode ? [localNode].concat(remoteNodes) : remoteNodes;
  var projectCtx = useContextMenu<string>();
  var nodeCtx = useContextMenu<NodeInfo>();

  function handleNodeContextMenu(e: React.MouseEvent, node: NodeInfo) {
    nodeCtx.open(e, node);
  }

  function handleContextMenu(e: React.MouseEvent, slug: string) {
    projectCtx.open(e, slug);
  }

  return (
    <div
      className={
        "w-16 flex-shrink-0 flex flex-col items-center pt-3 pb-16 gap-2 bg-base-100 border-r border-base-300 overflow-y-auto overflow-x-hidden scrollbar-hidden " +
        (props.dimmed ? "opacity-60" : "")
      }
    >
      <div className="relative flex items-center">
        {props.isDashboardActive && (
          <div
            className="absolute -left-3 w-[3px] bg-base-content rounded-r-full pointer-events-none"
            style={{ height: "32px", top: "50%", transform: "translateY(-50%)" }}
          />
        )}
        <button
          onClick={props.onDashboardClick}
          className={
            "relative w-[42px] h-[42px] flex items-center justify-center cursor-pointer transition-all duration-[120ms] flex-shrink-0 " +
            (props.isDashboardActive
              ? "rounded-xl bg-base-content/10 text-base-content ring-1 ring-base-content/20"
              : "rounded-full bg-base-200 text-base-content/40 hover:rounded-xl hover:bg-base-200 hover:text-base-content/60")
          }
          title="Lattice Dashboard"
        >
          <LatticeLogomark size={22} />
          <div
            className={
              "absolute bottom-0 right-0 w-2 h-2 rounded-full border-[1.5px] border-base-100 pointer-events-none " +
              (ws.status === "connected"
                ? "bg-success"
                : ws.status === "connecting"
                ? "bg-warning animate-pulse"
                : "bg-error")
            }
          />
        </button>
      </div>

      <div className="w-6 h-px bg-base-300 my-0.5 flex-shrink-0" />

      {groups.map(function (group) {
        return (
          <ProjectButton
            key={group.slug}
            group={group}
            isActive={props.activeProjectSlug === group.slug}
            onClick={function () { props.onSelectProject(group.slug); }}
            onContextMenu={handleContextMenu}
          />
        );
      })}


      {groups.length > 0 && (
        <div className="w-6 h-px bg-base-300 my-0.5 flex-shrink-0" />
      )}

      <button
        onClick={function () { sidebar.openAddProject(); }}
        className="w-[42px] h-[42px] flex items-center justify-center rounded-full border-2 border-dashed border-base-content/25 text-base-content/20 hover:border-base-content/40 hover:text-base-content/40 transition-colors duration-[120ms] flex-shrink-0 cursor-pointer"
        title="Add project"
      >
        <Plus size={18} />
      </button>

      {allMeshNodes.length > 0 && (
        <div className="w-6 h-px bg-base-300 my-0.5 flex-shrink-0" />
      )}

      {allMeshNodes.map(function (node) {
        return (
          <NodeIndicator key={node.id} node={node} onContextMenu={handleNodeContextMenu} />
        );
      })}

      <button
        onClick={function () { sidebar.openSettings("nodes"); }}
        className="w-[26px] h-[26px] flex items-center justify-center rounded-full border border-dashed border-base-content/15 text-base-content/15 hover:border-base-content/30 hover:text-base-content/30 transition-colors duration-[120ms] flex-shrink-0 cursor-pointer"
        title="Pair a node"
      >
        <Plus size={12} />
      </button>

      <div className="flex-1" />

      {projectCtx.state !== null && (
        <ContextMenu
          x={projectCtx.state.x}
          y={projectCtx.state.y}
          items={[
            { label: "Project Settings", icon: <Settings size={14} />, onClick: function () { sidebar.setActiveProjectSlug(projectCtx.state!.data); sidebar.openProjectSettings("general"); } },
            { label: "New Session", icon: <PlusCircle size={14} />, onClick: function () { ws.send({ type: "session:create", projectSlug: projectCtx.state!.data }); } },
            { type: "divider" },
            { label: "Remove Project", icon: <Trash2 size={14} />, danger: true, onClick: function () { sidebar.openConfirmRemove(projectCtx.state!.data); } },
          ] as ContextMenuEntry[]}
          onClose={projectCtx.close}
          label="Project actions"
        />
      )}

      {nodeCtx.state !== null && (function () {
        var node = nodeCtx.state!.data;
        var items: ContextMenuEntry[] = [
          { label: "Node Settings", icon: <Settings size={14} />, onClick: function () { sidebar.openSettings("nodes"); } },
        ];
        if (!node.isLocal) {
          if (!node.online) {
            items.push({ label: "Reconnect", icon: <RefreshCw size={14} />, onClick: function () { ws.send({ type: "mesh:reconnect", nodeId: node.id } as any); } });
          }
          items.push({ type: "divider" });
          items.push({ label: "Unpair", icon: <Unplug size={14} />, danger: true, onClick: function () { ws.send({ type: "mesh:unpair", nodeId: node.id }); } });
        }
        return (
          <ContextMenu
            x={nodeCtx.state!.x}
            y={nodeCtx.state!.y}
            items={items}
            onClose={nodeCtx.close}
            label="Node actions"
          />
        );
      })()}

    </div>
  );
}
