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
      online: node ? node.online : false,
      path: p.path,
    };
    if (existing) {
      existing.nodes.push(nodeEntry);
    } else {
      groups.set(p.slug, { slug: p.slug, title: p.title, nodes: [nodeEntry] });
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
            ? "rounded-xl bg-primary text-primary-content"
            : hovered
            ? "rounded-xl bg-base-200 text-base-content/60"
            : "rounded-full bg-base-200 text-base-content/60")
        }
      >
        {initials}
      </button>

      <div className="absolute bottom-0 right-0 flex gap-[2px] pointer-events-none">
        {props.group.nodes.map(function (n) {
          return (
            <div
              key={n.nodeId}
              className={
                "w-[11px] h-[11px] rounded-full border-[1.5px] border-base-100 " +
                (n.online ? "bg-success" : "bg-error")
              }
            />
          );
        })}
      </div>

      {hovered && (
        <div
          className="pointer-events-none z-[9000] bg-base-300 border border-base-content/20 rounded px-2 py-1 text-xs text-base-content whitespace-nowrap shadow-xl"
          style={{
            position: "fixed",
            left: "calc(64px + 8px)",
            top: tooltipTop + "px",
            transform: "translateY(-50%)",
          }}
        >
          {props.group.title}
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
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, slug: slug });
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
            "w-[42px] h-[42px] flex items-center justify-center cursor-pointer transition-all duration-[120ms] flex-shrink-0 " +
            (props.isDashboardActive
              ? "rounded-xl bg-primary text-primary-content"
              : "rounded-full bg-base-200 text-base-content/60 hover:rounded-xl hover:bg-primary/20 hover:text-primary")
          }
          title="Lattice Dashboard"
        >
          <LatticeLogomark size={22} />
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
