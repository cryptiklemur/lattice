import React, { useEffect, useRef } from "react";
import {
  Settings, FileText, Terminal, ScrollText, Shield, Brain,
  Plug, Puzzle, ExternalLink, Copy, Check, FolderOpen,
} from "lucide-react";
import { useProjects } from "../../hooks/useProjects";
import { useSidebar } from "../../hooks/useSidebar";
import { useWebSocket } from "../../hooks/useWebSocket";
import { openTab } from "../../stores/workspace";
import { getSidebarStore } from "../../stores/sidebar";
import { useState } from "react";

interface ProjectDropdownProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function ProjectDropdown(props: ProjectDropdownProps) {
  var menuRef = useRef<HTMLDivElement>(null);
  var { activeProject } = useProjects();
  var sidebar = useSidebar();
  var ws = useWebSocket();
  var [copied, setCopied] = useState(false);

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
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return function () {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [props.onClose, props.anchorRef]);

  var style: React.CSSProperties = {};
  if (props.anchorRef.current) {
    var rect = props.anchorRef.current.getBoundingClientRect();
    style.top = rect.bottom + 4 + "px";
    style.left = rect.left + "px";
    style.width = Math.max(rect.width, 240) + "px";
  }

  function goToSettings(section: string) {
    sidebar.openProjectSettings(section as any);
    props.onClose();
  }

  function handleCopyPath() {
    if (activeProject) {
      navigator.clipboard.writeText(activeProject.path || "");
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 1500);
    }
  }

  function handleOpenInIDE() {
    if (activeProject) {
      ws.send({ type: "editor:open", path: "." } as any);
    }
    props.onClose();
  }

  function handleOpenTerminal() {
    openTab("terminal");
    var state = getSidebarStore().state;
    if (state.activeView.type !== "chat") {
      getSidebarStore().setState(function (s) {
        return { ...s, activeView: { type: "chat" } };
      });
    }
    props.onClose();
  }

  function handleViewClaudeMd() {
    openTab("files");
    var state = getSidebarStore().state;
    if (state.activeView.type !== "chat") {
      getSidebarStore().setState(function (s) {
        return { ...s, activeView: { type: "chat" } };
      });
    }
    props.onClose();
  }

  if (!activeProject) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Project actions"
      className="fixed z-[9999] bg-base-300 border border-base-content/15 rounded-xl shadow-2xl overflow-hidden"
      style={style}
    >
      <div className="px-3 py-2.5 border-b border-base-content/10">
        <div className="text-[13px] font-mono font-bold text-base-content truncate">{activeProject.title}</div>
        <div className="text-[10px] text-base-content/30 truncate mt-0.5">{activeProject.path}</div>
      </div>

      <div className="px-1.5 py-1.5">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/25">
          Actions
        </div>
        <button
          role="menuitem"
          onClick={handleOpenInIDE}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors"
        >
          <ExternalLink size={13} className="flex-shrink-0 text-base-content/30" />
          Open in IDE
        </button>
        <button
          role="menuitem"
          onClick={handleOpenTerminal}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors"
        >
          <Terminal size={13} className="flex-shrink-0 text-base-content/30" />
          Open terminal
        </button>
        <button
          role="menuitem"
          onClick={handleViewClaudeMd}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors"
        >
          <FolderOpen size={13} className="flex-shrink-0 text-base-content/30" />
          Browse files
        </button>
        <button
          role="menuitem"
          onClick={handleCopyPath}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors"
        >
          {copied ? (
            <Check size={13} className="flex-shrink-0 text-success" />
          ) : (
            <Copy size={13} className="flex-shrink-0 text-base-content/30" />
          )}
          {copied ? "Copied!" : "Copy path"}
        </button>
      </div>

      <div className="px-1.5 py-1.5 border-t border-base-content/10">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-base-content/25">
          Settings
        </div>
        <button role="menuitem" onClick={function () { goToSettings("general"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <Settings size={13} className="flex-shrink-0 text-base-content/30" />
          General
        </button>
        <button role="menuitem" onClick={function () { goToSettings("claude"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <FileText size={13} className="flex-shrink-0 text-base-content/30" />
          Claude
        </button>
        <button role="menuitem" onClick={function () { goToSettings("mcp"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <Plug size={13} className="flex-shrink-0 text-base-content/30" />
          MCP Servers
        </button>
        <button role="menuitem" onClick={function () { goToSettings("skills"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <Puzzle size={13} className="flex-shrink-0 text-base-content/30" />
          Skills
        </button>
        <button role="menuitem" onClick={function () { goToSettings("rules"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <ScrollText size={13} className="flex-shrink-0 text-base-content/30" />
          Rules
        </button>
        <button role="menuitem" onClick={function () { goToSettings("permissions"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <Shield size={13} className="flex-shrink-0 text-base-content/30" />
          Permissions
        </button>
        <button role="menuitem" onClick={function () { goToSettings("memory"); }} className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors">
          <Brain size={13} className="flex-shrink-0 text-base-content/30" />
          Memory
        </button>
      </div>
    </div>
  );
}
