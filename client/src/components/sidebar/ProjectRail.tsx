import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { ProjectInfo, NodeInfo } from "@lattice/shared";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";

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

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  slug: string | null;
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

      {hovered && (
        <div
          className="pointer-events-none z-[9000] bg-base-300 border border-base-content/20 rounded-lg px-2.5 py-1.5 shadow-xl"
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
        </div>
      )}
    </div>
  );
}

function NodeIndicator({ node }: { node: NodeInfo }) {
  var [hovered, setHovered] = useState(false);
  var [tooltipTop, setTooltipTop] = useState(0);
  var sidebar = useSidebar();
  var initial = node.name.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-center">
      <button
        onClick={function () { sidebar.openSettings("nodes"); }}
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
      {hovered && (
        <div
          className="pointer-events-none z-[9000] bg-base-300 border border-base-content/20 rounded-lg px-2.5 py-1.5 shadow-xl"
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
        </div>
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
  var remoteNodes = props.nodes.filter(function (n) { return !n.isLocal; });
  var [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    slug: null,
  });
  var menuRef = useRef<HTMLDivElement>(null);

  useEffect(
    function () {
      if (!contextMenu.visible) return;

      function handleClick() {
        setContextMenu(function (prev) { return { ...prev, visible: false }; });
      }

      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          setContextMenu(function (prev) { return { ...prev, visible: false }; });
        }
      }

      function handleScroll() {
        setContextMenu(function (prev) { return { ...prev, visible: false }; });
      }

      window.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("scroll", handleScroll, true);

      return function () {
        window.removeEventListener("click", handleClick);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("scroll", handleScroll, true);
      };
    },
    [contextMenu.visible]
  );

  function handleContextMenu(e: React.MouseEvent, slug: string) {
    var menuWidth = 160;
    var menuHeight = 100;
    var cx = e.clientX;
    var cy = e.clientY;
    if (cx + menuWidth > window.innerWidth - 8) cx = window.innerWidth - menuWidth - 8;
    if (cy + menuHeight > window.innerHeight - 8) cy = window.innerHeight - menuHeight - 8;
    if (cx < 8) cx = 8;
    if (cy < 8) cy = 8;
    setContextMenu({ visible: true, x: cx, y: cy, slug: slug });
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


      {groups.length > 0 && remoteNodes.length > 0 && (
        <div className="w-6 h-px bg-base-300 my-0.5 flex-shrink-0" />
      )}

      {remoteNodes.map(function (node) {
        return (
          <NodeIndicator key={node.id} node={node} />
        );
      })}

      <div className="w-6 h-px bg-base-300 my-0.5 flex-shrink-0" />

      <button
        onClick={function () { sidebar.openAddProject(); }}
        className="w-[42px] h-[42px] flex items-center justify-center rounded-full border-2 border-dashed border-base-content/25 text-base-content/20 hover:border-base-content/40 hover:text-base-content/40 transition-colors duration-[120ms] flex-shrink-0 cursor-pointer"
        title="Add project"
      >
        <Plus size={18} />
      </button>

      <div className="flex-1" />

      {contextMenu.visible && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Project actions"
          onClick={function (e) { e.stopPropagation(); }}
          className="fixed z-[9999] bg-base-300 border border-base-content/20 rounded-lg shadow-2xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x + "px", top: contextMenu.y + "px" }}
        >
          <button
            role="menuitem"
            className="w-full text-left px-3 py-1.5 text-sm text-base-content hover:bg-base-content/10 transition-colors"
            onClick={function () {
              if (contextMenu.slug) {
                sidebar.setActiveProjectSlug(contextMenu.slug);
                sidebar.openProjectSettings("general");
              }
              setContextMenu(function (prev) { return { ...prev, visible: false }; });
            }}
          >
            Project Settings
          </button>
          <button
            role="menuitem"
            className="w-full text-left px-3 py-1.5 text-sm text-base-content hover:bg-base-content/10 transition-colors"
            onClick={function () {
              if (contextMenu.slug) {
                ws.send({ type: "session:create", projectSlug: contextMenu.slug });
              }
              setContextMenu(function (prev) { return { ...prev, visible: false }; });
            }}
          >
            New Session
          </button>
          <div className="my-1 h-px bg-base-content/10" />
          <button
            role="menuitem"
            className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors"
            onClick={function () {
              var slug = contextMenu.slug;
              setContextMenu(function (prev) { return { ...prev, visible: false }; });
              if (slug) {
                sidebar.openConfirmRemove(slug);
              }
            }}
          >
            Remove Project
          </button>
        </div>
      )}

    </div>
  );
}
