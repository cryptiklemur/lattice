import { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown, Search, LayoutDashboard, FolderOpen, TerminalSquare, StickyNote, Calendar, BarChart3, Bookmark, ClipboardList, Settings, Network, Activity } from "lucide-react";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import type { SessionSummary, ServerMessage, SettingsDataMessage } from "#shared";
import type { DateRange } from "./SessionList";
import { useProjects } from "../../hooks/useProjects";
import { useMesh } from "../../hooks/useMesh";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { useSession } from "../../hooks/useSession";
import { clearSession } from "../../stores/session";
import { useOnline } from "../../hooks/useOnline";
import { openTab, openSessionTab, closeTab, getWorkspaceStore } from "../../stores/workspace";
import { getSidebarStore, goToAnalytics, openSettings } from "../../stores/sidebar";
import { ProjectRail } from "./ProjectRail";
import { SessionList } from "./SessionList";
import { UserIsland } from "./UserIsland";
import { UserMenu } from "./UserMenu";
import { SearchFilter } from "./SearchFilter";
import { ProjectDropdown } from "./ProjectDropdown";
import { SettingsSidebar } from "./SettingsSidebar";
import { SpecsSidebarWidget } from "./SpecsSidebarWidget";

type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  custom: "Custom",
};

function computeDateRange(preset: DatePreset, customFrom?: string, customTo?: string): DateRange {
  if (preset === "all") return {};
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (preset === "today") {
    return { from: todayStart.getTime() };
  }
  if (preset === "yesterday") {
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    return { from: yesterdayStart.getTime(), to: todayStart.getTime() };
  }
  if (preset === "week") {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return { from: weekStart.getTime() };
  }
  if (preset === "month") {
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    return { from: monthStart.getTime() };
  }
  if (preset === "custom") {
    const range: DateRange = {};
    if (customFrom) {
      range.from = new Date(customFrom + "T00:00:00").getTime();
    }
    if (customTo) {
      const toDate = new Date(customTo + "T23:59:59");
      range.to = toDate.getTime() + 999;
    }
    return range;
  }
  return {};
}

function DateRangeDropdown({ dateRange, onChange }: { dateRange: DateRange; onChange: (r: DateRange, preset: DatePreset) => void }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(function () {
    if (!open) return;
    function dismiss(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", dismiss);
    return function () { document.removeEventListener("mousedown", dismiss); };
  }, [open]);

  function handlePreset(p: DatePreset) {
    setPreset(p);
    if (p !== "custom") {
      onChange(computeDateRange(p), p);
      setOpen(false);
    }
  }

  function handleCustomApply() {
    onChange(computeDateRange("custom", customFrom, customTo), "custom");
    setOpen(false);
  }

  const hasFilter = preset !== "all";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={function () { setOpen(function (v) { return !v; }); }}
        className={"btn btn-ghost btn-xs btn-square " + (hasFilter ? "text-primary" : "text-base-content/40 hover:text-base-content")}
        aria-label="Filter by date"
        title={DATE_PRESET_LABELS[preset]}
      >
        <Calendar size={13} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-[9999] bg-base-300 border border-base-content/15 rounded-lg shadow-xl min-w-[180px] py-1">
          {(["all", "today", "yesterday", "week", "month", "custom"] as DatePreset[]).map(function (p) {
            return (
              <button
                key={p}
                type="button"
                onClick={function () { handlePreset(p); }}
                className={
                  "block w-full text-left px-3 py-1.5 text-[12px] transition-colors duration-75 " +
                  (preset === p ? "text-primary bg-primary/10" : "text-base-content/70 hover:bg-base-content/5 hover:text-base-content")
                }
              >
                {DATE_PRESET_LABELS[p]}
              </button>
            );
          })}
          {preset === "custom" && (
            <div className="px-3 py-2 border-t border-base-content/10 flex flex-col gap-1.5">
              <label className="text-[10px] text-base-content/40 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={function (e) { setCustomFrom(e.target.value); }}
                className="h-7 px-2 bg-base-200 border border-base-content/15 rounded text-base-content text-[12px] focus:border-primary focus-visible:outline-none transition-colors [color-scheme:dark]"
              />
              <label className="text-[10px] text-base-content/40 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={customTo}
                onChange={function (e) { setCustomTo(e.target.value); }}
                className="h-7 px-2 bg-base-200 border border-base-content/15 rounded text-base-content text-[12px] focus:border-primary focus-visible:outline-none transition-colors [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={handleCustomApply}
                className="btn btn-xs btn-primary mt-1"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label, actions }: { label: string; actions?: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0 select-none">
      <h2 className="text-xs font-bold tracking-wider uppercase text-base-content/40">
        {label}
      </h2>
      {actions && (
        <div className="flex items-center gap-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onSessionSelect }: { onSessionSelect?: () => void }) {
  const { projects, activeProject } = useProjects();
  const { nodes } = useMesh();
  const ws = useWebSocket();
  const online = useOnline();
  const sidebar = useSidebar();
  const session = useSession();
  const [sessionSearch, setSessionSearch] = useState<string>("");
  const [sessionSearchOpen, setSessionSearchOpen] = useState<boolean>(false);
  const [sessionDateRange, setSessionDateRange] = useState<DateRange>({});
  const userIslandRef = useRef<HTMLElement | null>(null);
  const projectHeaderRef = useRef<HTMLElement | null>(null);

  const localNode = nodes.find(function (n) { return n.isLocal; });
  const [configNodeName, setConfigNodeName] = useState("");

  useEffect(function () {
    function handleSettingsData(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      const data = msg as SettingsDataMessage;
      if (data.config.name) {
        setConfigNodeName(data.config.name);
      }
    }
    ws.subscribe("settings:data", handleSettingsData);
    ws.send({ type: "settings:get" });
    return function () {
      ws.unsubscribe("settings:data", handleSettingsData);
    };
  }, []);

  const localNodeName = localNode ? localNode.name : configNodeName;
  const initialActivatedRef = useRef<boolean>(false);

  useEffect(function () {
    if (initialActivatedRef.current) return;
    if (!sidebar.activeProjectSlug || !sidebar.activeSessionId) return;
    if (!activeProject) return;
    initialActivatedRef.current = true;
    const wsState = getWorkspaceStore().state;
    const alreadyHasTab = wsState.tabs.some(function (t) {
      return t.type === "chat" && t.sessionId === sidebar.activeSessionId;
    });
    if (!alreadyHasTab) {
      openSessionTab(sidebar.activeSessionId, sidebar.activeProjectSlug, "Session");
    }
    session.activateSession(sidebar.activeProjectSlug, sidebar.activeSessionId);
  }, [sidebar.activeProjectSlug, sidebar.activeSessionId, activeProject]);

  // Ctrl/Cmd+K is handled by the global CommandPalette

  function handleSessionActivate(s: SessionSummary) {
    if (activeProject) {
      openSessionTab(s.id, activeProject.slug, s.title);
      session.activateSession(activeProject.slug, s.id);
    }
    sidebar.closeMenus();
    if (onSessionSelect) {
      onSessionSelect();
    }
  }

  function handleNewSession() {
    if (!activeProject?.slug) {
      return;
    }
    ws.send({ type: "session:create", projectSlug: activeProject.slug });
  }

  return (
    <div className="flex flex-row h-full w-full overflow-hidden relative">
      <ProjectRail
        projects={projects}
        nodes={nodes}
        activeProjectSlug={sidebar.activeProjectSlug}
        onSelectProject={sidebar.setActiveProjectSlug}
        onDashboardClick={sidebar.goToDashboard}
        isDashboardActive={sidebar.activeView.type === "dashboard"}
        dimmed={sidebar.sidebarMode === "settings"}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-base-200 border-r border-base-300">
        {sidebar.sidebarMode === "project" ? (
          <>
            {(sidebar.activeView.type === "dashboard" || ((sidebar.activeView.type === "analytics" || sidebar.activeView.type === "context") && !sidebar.activeProjectSlug)) ? (
              <>
                <div className="px-4 h-12 border-b border-base-300 flex-shrink-0 flex items-center gap-2">
                  <LatticeLogomark size={18} />
                  <span className="text-[13px] font-mono font-bold text-base-content/90">
                    Lattice
                  </span>
                </div>
                <div className="flex-1 overflow-auto px-4 py-3 pb-16">
                  <div className="flex flex-col gap-0.5 mb-3">
                    <button
                      type="button"
                      onClick={function () {
                        const store = getWorkspaceStore();
                        const state = store.state;
                        const activePane = state.panes.find(function (p) { return p.id === state.activePaneId; });
                        const activeTab = activePane ? state.tabs.find(function (t) { return t.id === activePane!.activeTabId; }) : null;
                        if (activeTab && activeTab.id !== "chat") {
                          closeTab(activeTab.id);
                        }
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                    >
                      <LayoutDashboard size={12} />
                      <span className="font-mono tracking-wide">Dashboard</span>
                    </button>
                    <button
                      type="button"
                      onClick={goToAnalytics}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                    >
                      <BarChart3 size={12} />
                      <span className="font-mono tracking-wide">Global Analytics</span>
                    </button>
                    <button
                      type="button"
                      onClick={function () {
                        openTab("context");
                        getSidebarStore().setState(function (s) {
                          return { ...s, activeView: { type: "context" } };
                        });
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                    >
                      <Activity size={12} />
                      <span className="font-mono tracking-wide">Context Analyzer</span>
                    </button>
                    <button
                      type="button"
                      onClick={function () { openSettings("nodes"); }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                    >
                      <Network size={12} />
                      <span className="font-mono tracking-wide">Nodes</span>
                    </button>
                    <button
                      type="button"
                      onClick={function () { openSettings("appearance"); }}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                    >
                      <Settings size={12} />
                      <span className="font-mono tracking-wide">Settings</span>
                    </button>
                  </div>
                  <SectionLabel label="Projects" />
                  {projects.length === 0 && nodes.some(function (n) { return !n.isLocal && n.online; }) ? (
                    <div className="flex items-center gap-2 text-[12px] text-base-content/25 px-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-base-content/30 animate-pulse flex-shrink-0" />
                      Syncing remote projects...
                    </div>
                  ) : (
                    <div className="text-[12px] text-base-content/25 px-4">
                      Select a project from the left to get started.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  ref={function (el) { projectHeaderRef.current = el; }}
                  onClick={sidebar.toggleProjectDropdown}
                  aria-label="Switch project"
                  aria-expanded={sidebar.projectDropdownOpen}
                  className={"w-full px-4 border-b border-base-300 flex-shrink-0 flex items-center justify-between cursor-pointer hover:bg-base-300/30 transition-colors text-left " + (activeProject?.isRemote ? "h-14 py-2" : "h-12 py-2.5")}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-mono font-bold text-base-content/90 truncate">
                      {activeProject?.title ?? (projects.length === 0 ? "Loading..." : "No Project")}
                    </div>
                    {activeProject?.isRemote && (
                      <div className="text-[10px] text-base-content/30 font-mono">
                        on {activeProject.nodeName}
                      </div>
                    )}
                  </div>
                  <ChevronDown size={14} className="text-base-content/30 flex-shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={function () { sidebar.goToProjectDashboard(); }}
                  className="flex items-center gap-2 mx-3 mt-2 px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                >
                  <LayoutDashboard size={12} />
                  <span className="font-mono tracking-wide">Dashboard</span>
                </button>

                <div className="flex flex-col gap-0.5 mx-3 mt-1">
                  {[
                    { type: "files" as const, icon: FolderOpen, label: "Files", localOnly: true },
                    { type: "terminal" as const, icon: TerminalSquare, label: "Terminal", localOnly: true },
                    { type: "notes" as const, icon: StickyNote, label: "Notes", localOnly: false },
                    { type: "tasks" as const, icon: Calendar, label: "Scheduled Tasks", localOnly: false },
                    { type: "bookmarks" as const, icon: Bookmark, label: "Bookmarks", localOnly: false },
                    { type: "specs" as const, icon: ClipboardList, label: "Specs", localOnly: false },
                    { type: "context" as const, icon: Activity, label: "Context Analyzer", localOnly: false },
                  ].map(function (item) {
                    const isDisabled = item.localOnly && activeProject?.isRemote;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        disabled={!!isDisabled}
                        onClick={function () {
                          if (isDisabled) return;
                          openTab(item.type);
                          const state = getSidebarStore().state;
                          if (state.activeView.type !== "chat") {
                            getSidebarStore().setState(function (s) {
                              return { ...s, activeView: { type: "chat" } };
                            });
                          }
                        }}
                        className={
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors " +
                          (isDisabled
                            ? "text-base-content/15 cursor-not-allowed"
                            : "text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30")
                        }
                        title={isDisabled ? "Not available for remote projects" : undefined}
                      >
                        <item.icon size={12} />
                        <span className="font-mono tracking-wide">{item.label}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={function () { openTab("analytics"); }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30 transition-colors"
                  >
                    <BarChart3 size={12} />
                    <span className="font-mono tracking-wide">Analytics</span>
                  </button>
                </div>

                <SpecsSidebarWidget />

                <SectionLabel
                  label="Sessions"
                  actions={
                    <>
                      <button onClick={function () { setSessionSearchOpen(function (v) { return !v; }); }} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Search sessions">
                        <Search size={13} />
                      </button>
                      <DateRangeDropdown
                        dateRange={sessionDateRange}
                        onChange={function (r) { setSessionDateRange(r); }}
                      />
                      <button onClick={handleNewSession} disabled={!online} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="New session">
                        <Plus size={13} />
                      </button>
                    </>
                  }
                />
                {sessionSearchOpen && (
                  <SearchFilter
                    value={sessionSearch}
                    onChange={setSessionSearch}
                    onClose={function () { setSessionSearchOpen(false); setSessionSearch(""); }}
                    placeholder="Filter sessions..."
                  />
                )}
                <SessionList
                  projectSlug={activeProject?.slug ?? null}
                  activeSessionId={session.activeSessionId}
                  onSessionActivate={handleSessionActivate}
                  onSessionDeactivate={clearSession}
                  filter={sessionSearch}
                  dateRange={sessionDateRange}
                />
              </>
            )}

          </>
        ) : (
          <SettingsSidebar
            projectName={activeProject?.title ?? "Dashboard"}
            onBack={sidebar.exitSettings}
          />
        )}
      </div>
      <div
        ref={function (el) { userIslandRef.current = el; }}
        className="absolute bottom-2 left-2 right-2 z-10 bg-base-300 border border-base-content/15 rounded-xl shadow-lg"
      >
        <UserIsland nodeName={localNodeName} onClick={sidebar.toggleUserMenu} />
      </div>
      {sidebar.userMenuOpen && (
        <UserMenu
          anchorRef={userIslandRef}
          onClose={sidebar.closeMenus}
          onOpenNodeSettings={sidebar.openNodeSettings}
        />
      )}
      {sidebar.projectDropdownOpen && (
        <ProjectDropdown
          anchorRef={projectHeaderRef}
          onClose={sidebar.closeMenus}
        />
      )}
    </div>
  );
}
