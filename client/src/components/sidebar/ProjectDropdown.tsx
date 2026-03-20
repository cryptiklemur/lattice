import React, { useEffect, useRef, useState, useMemo } from "react";
import { Search, Settings, Check, Plus, FolderOpen, Wifi, WifiOff } from "lucide-react";
import { useProjects } from "../../hooks/useProjects";
import { useSidebar } from "../../hooks/useSidebar";
import { useOnline } from "../../hooks/useOnline";
import type { ProjectInfo } from "@lattice/shared";

interface ProjectDropdownProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function ProjectDropdown(props: ProjectDropdownProps) {
  var menuRef = useRef<HTMLDivElement>(null);
  var searchRef = useRef<HTMLInputElement>(null);
  var { projects, activeProject } = useProjects();
  var sidebar = useSidebar();
  var online = useOnline();
  var [search, setSearch] = useState("");
  var [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        props.anchorRef.current &&
        !props.anchorRef.current.contains(e.target as Node)
      ) {
        props.onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        props.onClose();
      }
    }
    function handleScroll() {
      props.onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return function () {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [props.onClose, props.anchorRef]);

  useEffect(function () {
    if (projects.length > 5 && searchRef.current) {
      searchRef.current.focus();
    }
  }, [projects.length]);

  var filtered = useMemo(function () {
    if (!search.trim()) return projects;
    var q = search.toLowerCase();
    return projects.filter(function (p) {
      return p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
    });
  }, [projects, search]);

  var grouped = useMemo(function () {
    var nodeNames = new Set<string>();
    for (var i = 0; i < filtered.length; i++) {
      nodeNames.add(filtered[i].nodeName);
    }
    if (nodeNames.size <= 1) return null;
    var groups: Record<string, ProjectInfo[]> = {};
    for (var j = 0; j < filtered.length; j++) {
      var p = filtered[j];
      if (!groups[p.nodeName]) groups[p.nodeName] = [];
      groups[p.nodeName].push(p);
    }
    return groups;
  }, [filtered]);

  var style: React.CSSProperties = {};
  if (props.anchorRef.current) {
    var rect = props.anchorRef.current.getBoundingClientRect();
    style.top = rect.bottom + 4 + "px";
    style.left = rect.left + "px";
    style.width = rect.width + "px";
  }

  function handleSelect(project: ProjectInfo) {
    sidebar.setActiveProjectSlug(project.slug);
    props.onClose();
  }

  function handleSettings(e: React.MouseEvent, project: ProjectInfo) {
    e.stopPropagation();
    sidebar.setActiveProjectSlug(project.slug);
    sidebar.openProjectSettings("general");
    props.onClose();
  }

  function handleAddProject() {
    sidebar.openAddProject();
    props.onClose();
  }

  function renderProject(project: ProjectInfo) {
    var isActive = activeProject?.slug === project.slug;
    var isHovered = hoveredSlug === project.slug;
    var isOnline = online;

    return (
      <div
        key={project.slug}
        role="menuitem"
        tabIndex={0}
        onClick={function () { handleSelect(project); }}
        onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(project); } }}
        onMouseEnter={function () { setHoveredSlug(project.slug); }}
        onMouseLeave={function () { setHoveredSlug(null); }}
        className={
          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-[120ms] group " +
          (isActive
            ? "bg-primary/10 border border-primary/20"
            : "border border-transparent hover:bg-base-content/5")
        }
      >
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {isActive ? (
            <Check size={13} className="text-primary" />
          ) : (
            <FolderOpen size={13} className="text-base-content/25" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={
              "text-[12px] font-mono font-semibold truncate " +
              (isActive ? "text-base-content" : "text-base-content/70")
            }>
              {project.title}
            </span>
            <span className="flex-shrink-0">
              {isOnline ? (
                <Wifi size={9} className="text-success/50" />
              ) : (
                <WifiOff size={9} className="text-error/40" />
              )}
            </span>
          </div>
          <div className="text-[10px] text-base-content/30 truncate font-sans">
            {project.path}
          </div>
        </div>

        <div className={
          "flex-shrink-0 transition-opacity duration-[120ms] " +
          (isHovered ? "opacity-100" : "opacity-0")
        }>
          <button
            onClick={function (e) { handleSettings(e, project); }}
            className="p-1 rounded hover:bg-base-content/10 text-base-content/30 hover:text-base-content/60 transition-colors"
            aria-label={"Settings for " + project.title}
          >
            <Settings size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Project selector"
      className="fixed z-[9999] bg-base-300 border border-base-content/15 rounded-xl shadow-2xl overflow-hidden"
      style={style}
    >
      {projects.length > 5 && (
        <div className="px-2.5 pt-2.5 pb-1">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/25" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={function (e) { setSearch(e.target.value); }}
              placeholder="Filter projects..."
              className="w-full h-7 pl-7 pr-2.5 bg-base-200 border border-base-content/10 rounded-lg text-[11px] text-base-content placeholder:text-base-content/25 focus:border-primary/40 focus-visible:outline-none transition-colors duration-[120ms]"
            />
          </div>
        </div>
      )}

      <div className="px-1.5 py-1.5 max-h-[60vh] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="py-4 text-center text-[11px] text-base-content/30">
            No projects match your search.
          </div>
        )}

        {grouped ? (
          Object.keys(grouped).map(function (nodeName) {
            return (
              <div key={nodeName}>
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-base-content/25">
                  {nodeName}
                </div>
                {grouped[nodeName].map(function (project) {
                  return renderProject(project);
                })}
              </div>
            );
          })
        ) : (
          filtered.map(function (project) {
            return renderProject(project);
          })
        )}
      </div>

      <div className="border-t border-base-content/10 px-1.5 py-1.5">
        <button
          onClick={handleAddProject}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5 transition-colors duration-[120ms] cursor-pointer"
        >
          <Plus size={12} />
          Add Project
        </button>
      </div>
    </div>
  );
}
