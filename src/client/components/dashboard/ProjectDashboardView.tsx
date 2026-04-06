import { useState, useEffect } from "react";
import { useSidebar } from "../../hooks/useSidebar";
import { useProjectSettings } from "../../hooks/useProjectSettings";
import { useProjects } from "../../hooks/useProjects";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  Menu, Settings, FileText, Terminal, Plug, ScrollText, Shield,
  MessageSquare, ChevronRight,
} from "lucide-react";
import type { ProjectSettingsSection } from "../../stores/sidebar";
import type { SessionSummary, ServerMessage } from "#shared";
import { openSessionTab } from "../../stores/workspace";

function StatCard({ label, value, icon, loading }: { label: string; value: string | number; icon: React.ReactNode; loading?: boolean }) {
  return (
    <div className="bg-base-300 rounded-xl border border-base-content/15 p-3 px-4">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-10 bg-base-content/10 rounded animate-pulse" />
      ) : (
        <div className="text-xl font-mono font-bold text-base-content">{value}</div>
      )}
    </div>
  );
}

function QuickLink({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-base-content/15 bg-base-300 text-[12px] text-base-content/60 hover:text-base-content hover:border-base-content/30 transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight size={12} className="text-base-content/30" />
    </button>
  );
}

export function ProjectDashboardView() {
  var sidebar = useSidebar();

  if (sidebar.activeView.type !== "project-dashboard") {
    return null;
  }

  var { settings, loading: settingsLoading } = useProjectSettings(sidebar.activeProjectSlug);
  var { projects } = useProjects();
  var { send, subscribe, unsubscribe, status: wsStatus } = useWebSocket();
  var [sessions, setSessions] = useState<SessionSummary[]>([]);
  var [sessionsLoading, setSessionsLoading] = useState(true);

  var activeProject = projects.find(function (p) { return p.slug === sidebar.activeProjectSlug; });
  var projectTitle = activeProject?.title ?? sidebar.activeProjectSlug ?? "Project";

  useEffect(function () {
    if (!sidebar.activeProjectSlug) return;

    function handleSessionList(msg: ServerMessage) {
      if (msg.type !== "session:list") return;
      var data = msg as { type: "session:list"; projectSlug: string; sessions: SessionSummary[] };
      if (data.projectSlug === sidebar.activeProjectSlug) {
        var sorted = data.sessions.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
        setSessions(sorted);
        setSessionsLoading(false);
      }
    }

    subscribe("session:list", handleSessionList);
    if (wsStatus === "connected") {
      setSessionsLoading(true);
      send({ type: "session:list_request", projectSlug: sidebar.activeProjectSlug });
    }

    return function () {
      unsubscribe("session:list", handleSessionList);
    };
  }, [sidebar.activeProjectSlug, wsStatus]);

  function goToSection(section: ProjectSettingsSection) {
    sidebar.openProjectSettings(section);
  }

  function goToSession(s: SessionSummary) {
    if (activeProject) {
      openSessionTab(s.id, activeProject.slug, s.title);
      sidebar.setActiveSessionId(s.id);
    }
  }

  var sessionCount = sessions.length;
  var mcpCount = settings ? Object.keys(settings.mcpServers).length : 0;
  var globalMcpCount = settings ? Object.keys(settings.global.mcpServers).length : 0;
  var rulesCount = settings ? settings.rules.length : 0;
  var globalRulesCount = settings ? settings.global.rules.length : 0;
  var envCount = settings ? Object.keys(settings.env).length : 0;

  return (
    <div className="flex-1 overflow-auto px-4 sm:px-8 py-4 sm:py-6 max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <button
          className="btn btn-ghost btn-sm btn-square lg:hidden"
          aria-label="Toggle sidebar"
          onClick={sidebar.toggleDrawer}
        >
          <Menu size={18} />
        </button>
        <h1 className="text-lg font-mono font-bold text-base-content">{projectTitle}</h1>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sessions" value={sessionCount} icon={<MessageSquare size={14} className="text-primary" />} loading={sessionsLoading} />
          <StatCard label="MCP Servers" value={mcpCount + globalMcpCount} icon={<Plug size={14} className="text-accent" />} loading={settingsLoading} />
          <StatCard label="Rules" value={rulesCount + globalRulesCount} icon={<ScrollText size={14} className="text-info" />} loading={settingsLoading} />
          <StatCard label="Env Vars" value={envCount} icon={<Terminal size={14} className="text-success" />} loading={settingsLoading} />
        </div>

        {settingsLoading ? (
          <div className="bg-base-content/10 rounded-xl h-32 animate-pulse" />
        ) : settings?.claudeMd ? (
          <div>
            <div className="text-[12px] font-semibold text-base-content/40 mb-2">CLAUDE.md</div>
            <div className="px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl font-mono text-[11px] text-base-content/60 leading-relaxed max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{settings.claudeMd}</pre>
            </div>
          </div>
        ) : null}

        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Recent Sessions</div>
          {sessionsLoading ? (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map(function (i) {
                return <div key={i} className="bg-base-content/10 rounded-xl h-10 animate-pulse" />;
              })}
            </div>
          ) : sessions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {sessions.slice(0, 5).map(function (s) {
                return (
                  <button
                    key={s.id}
                    onClick={function () { goToSession(s); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-base-content/15 bg-base-300 hover:border-base-content/30 transition-colors duration-[120ms] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MessageSquare size={12} className="text-base-content/30 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-base-content truncate">{s.title || "Untitled"}</span>
                    <span className="text-[10px] text-base-content/30 font-mono flex-shrink-0">
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                    <ChevronRight size={12} className="text-base-content/20 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[12px] text-base-content/30">No sessions yet</div>
          )}
        </div>

        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Settings</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <QuickLink label="General" icon={<Settings size={13} className="text-base-content/40" />} onClick={function () { goToSection("general"); }} />
            <QuickLink label="Claude" icon={<FileText size={13} className="text-base-content/40" />} onClick={function () { goToSection("claude"); }} />
            <QuickLink label="Environment" icon={<Terminal size={13} className="text-base-content/40" />} onClick={function () { goToSection("environment"); }} />
            <QuickLink label="MCP Servers" icon={<Plug size={13} className="text-base-content/40" />} onClick={function () { goToSection("mcp"); }} />
            <QuickLink label="Rules" icon={<ScrollText size={13} className="text-base-content/40" />} onClick={function () { goToSection("rules"); }} />
            <QuickLink label="Permissions" icon={<Shield size={13} className="text-base-content/40" />} onClick={function () { goToSection("permissions"); }} />
          </div>
        </div>

        {settings && (
          <div className="text-[11px] text-base-content/30 font-mono truncate">
            {settings.path}
          </div>
        )}
      </div>
    </div>
  );
}
