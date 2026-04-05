import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Search, Moon, Sun, Settings, Layout, MessageSquare, FolderOpen, Zap, RotateCcw } from "lucide-react";
import { useProjects } from "../../hooks/useProjects";
import { useSkills } from "../../hooks/useSkills";
import { useTheme } from "../../hooks/useTheme";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { getSessionStore } from "../../stores/session";
import type { SettingsSection } from "../../stores/sidebar";

interface Command {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string;
}

export function CommandPalette() {
  var [open, setOpen] = useState(false);
  var [query, setQuery] = useState("");
  var [selectedIndex, setSelectedIndex] = useState(0);
  var inputRef = useRef<HTMLInputElement>(null);
  var listRef = useRef<HTMLDivElement>(null);

  var { projects, setActiveProject } = useProjects();
  var skills = useSkills();
  var { mode, toggleMode, themes, setTheme, currentThemeId } = useTheme();
  var ws = useWebSocket();
  var sidebar = useSidebar();

  var close = useCallback(function () {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  useHotkey("Mod+K", function (e) {
    e.preventDefault();
    setOpen(function (prev) {
      if (prev) {
        setQuery("");
        setSelectedIndex(0);
      }
      return !prev;
    });
  });

  useHotkey("Escape", function (e) {
    e.preventDefault();
    close();
  }, { enabled: open });

  // Focus input when opened
  useEffect(function () {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Build command list
  var commands = useMemo(function (): Command[] {
    var cmds: Command[] = [];

    // Navigation
    cmds.push({
      id: "nav:dashboard",
      label: "Go to Dashboard",
      group: "Navigation",
      icon: <Layout size={14} />,
      action: function () { sidebar.goToDashboard(); close(); },
      keywords: "home overview",
    });

    // Projects
    projects.forEach(function (project) {
      cmds.push({
        id: "project:" + project.slug,
        label: project.title || project.slug,
        description: project.path,
        group: "Projects",
        icon: <FolderOpen size={14} />,
        action: function () { setActiveProject(project); close(); },
        keywords: "switch project " + project.slug,
      });
    });

    // Session actions
    var sessionState = getSessionStore().state;
    if (sessionState.activeProjectSlug) {
      cmds.push({
        id: "session:new",
        label: "New Session",
        group: "Session",
        icon: <MessageSquare size={14} />,
        action: function () {
          ws.send({ type: "session:create", projectSlug: sessionState.activeProjectSlug! });
          close();
        },
        keywords: "create chat conversation",
      });
    }

    // Settings sections
    var settingsSections: Array<{ id: SettingsSection; label: string; keywords: string }> = [
      { id: "appearance", label: "Appearance", keywords: "theme visual colors" },
      { id: "claude", label: "Claude Settings", keywords: "api model key" },
      { id: "environment", label: "Environment", keywords: "env variables config" },
      { id: "mcp", label: "MCP Servers", keywords: "model context protocol" },
      { id: "skills", label: "Skills", keywords: "capabilities commands" },
      { id: "nodes", label: "Mesh Nodes", keywords: "machines network" },
    ];
    settingsSections.forEach(function (section) {
      cmds.push({
        id: "settings:" + section.id,
        label: section.label,
        group: "Settings",
        icon: <Settings size={14} />,
        action: function () { sidebar.openSettings(section.id); close(); },
        keywords: section.keywords,
      });
    });

    // Theme
    cmds.push({
      id: "theme:toggle",
      label: mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      group: "Theme",
      icon: mode === "dark" ? <Sun size={14} /> : <Moon size={14} />,
      action: function () { toggleMode(); close(); },
      keywords: "dark light mode toggle",
    });

    var themeVariant = mode === "dark" ? "dark" : "light";
    themes.filter(function (t) { return t.theme.variant === themeVariant; }).forEach(function (t) {
      if (t.id === currentThemeId) return;
      cmds.push({
        id: "theme:" + t.id,
        label: t.theme.name,
        group: "Theme",
        icon: mode === "dark" ? <Moon size={14} /> : <Sun size={14} />,
        action: function () { setTheme(t.id); close(); },
        keywords: "color scheme " + t.theme.name,
      });
    });

    // Skills
    skills.forEach(function (skill) {
      cmds.push({
        id: "skill:" + skill.name,
        label: "/" + skill.name,
        description: skill.description,
        group: "Skills",
        icon: <Zap size={14} />,
        action: function () {
          // Focus chat input and prefill with skill command
          var textarea = document.querySelector("textarea[aria-label='Message input']") as HTMLTextAreaElement | null;
          if (textarea) {
            textarea.value = "/" + skill.name + " ";
            textarea.focus();
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
          close();
        },
        keywords: skill.description,
      });
    });

    // System
    cmds.push({
      id: "system:restart",
      label: "Restart Daemon",
      group: "System",
      icon: <RotateCcw size={14} />,
      action: function () { ws.send({ type: "settings:restart" } as any); close(); },
      keywords: "reboot server",
    });

    return cmds;
  }, [projects, skills, mode, themes, currentThemeId, sidebar, ws, close, setActiveProject, toggleMode, setTheme]);

  // Filter commands
  var filtered = useMemo(function () {
    if (!query.trim()) return commands;
    var q = query.toLowerCase();
    return commands.filter(function (cmd) {
      var searchText = (cmd.label + " " + (cmd.description || "") + " " + (cmd.keywords || "") + " " + cmd.group).toLowerCase();
      // All words in query must match
      var words = q.split(/\s+/);
      for (var i = 0; i < words.length; i++) {
        if (!searchText.includes(words[i])) return false;
      }
      return true;
    });
  }, [query, commands]);

  // Reset selection when filter changes
  useEffect(function () {
    setSelectedIndex(0);
  }, [filtered.length, query]);

  // Scroll active item into view
  useEffect(function () {
    if (!listRef.current) return;
    var active = listRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(function (i) { return i < filtered.length - 1 ? i + 1 : 0; });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(function (i) { return i > 0 ? i - 1 : filtered.length - 1; });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  }

  // Group filtered commands
  var grouped = useMemo(function () {
    var groups: Array<{ name: string; items: Array<Command & { globalIndex: number }> }> = [];
    var groupMap = new Map<string, Array<Command & { globalIndex: number }>>();
    var globalIdx = 0;
    filtered.forEach(function (cmd) {
      var list = groupMap.get(cmd.group);
      if (!list) {
        list = [];
        groupMap.set(cmd.group, list);
        groups.push({ name: cmd.group, items: list });
      }
      list.push(Object.assign({}, cmd, { globalIndex: globalIdx }));
      globalIdx++;
    });
    return groups;
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]" onClick={close}>
      <div className="absolute inset-0 bg-base-content/50" />
      <div
        className="relative w-full max-w-[520px] mx-4 bg-base-200 border border-base-content/10 rounded-xl shadow-2xl overflow-hidden"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-base-content/10">
          <Search size={16} className="text-base-content/30 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={function (e) { setQuery(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-[14px] text-base-content outline-none placeholder:text-base-content/30"
          />
          <kbd className="text-[10px] font-mono text-base-content/20 bg-base-300 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1.5">
          {grouped.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-base-content/30">
              No commands found
            </div>
          )}
          {grouped.map(function (group) {
            return (
              <div key={group.name}>
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[9px] uppercase tracking-widest text-base-content/30 font-mono font-bold">{group.name}</span>
                </div>
                {group.items.map(function (cmd) {
                  var isActive = cmd.globalIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-active={isActive}
                      onMouseEnter={function () { setSelectedIndex(cmd.globalIndex); }}
                      onMouseDown={function (e) { e.preventDefault(); }}
                      onClick={function () { cmd.action(); }}
                      className={
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors " +
                        (isActive ? "bg-primary/10" : "hover:bg-base-content/5")
                      }
                    >
                      <div className={"flex-shrink-0 " + (isActive ? "text-primary" : "text-base-content/30")}>
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={"text-[13px] truncate " + (isActive ? "text-base-content" : "text-base-content/70")}>
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div className="text-[11px] text-base-content/30 truncate">{cmd.description}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 py-2 border-t border-base-content/10 text-[10px] text-base-content/25 font-mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
