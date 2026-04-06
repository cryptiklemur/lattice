import { useState, useEffect, useMemo } from "react";
import { useMesh } from "../../hooks/useMesh";
import { useProjects } from "../../hooks/useProjects";
import { useSidebar } from "../../hooks/useSidebar";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useTimeTick } from "../../hooks/useTimeTick";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { QuickStats } from "../analytics/QuickStats";
import {
  Network, FolderOpen, MessageSquare, Menu,
  ChevronRight, CircleDot, Circle,
} from "lucide-react";
import type { ServerMessage, SessionSummary, LatticeConfig } from "#shared";
import { formatSessionTitle } from "../../utils/formatSessionTitle";
import { openSessionTab } from "../../stores/workspace";

function relativeTime(ts: number): string {
  var diff = Date.now() - ts;
  var seconds = Math.floor(diff / 1000);
  if (seconds < 60) return seconds + "s ago";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  return days + "d ago";
}

export function DashboardView() {
  useTimeTick();
  var { nodes } = useMesh();
  var { projects } = useProjects();
  var sidebar = useSidebar();
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [sessions, setSessions] = useState<SessionSummary[]>([]);
  var [localConfig, setLocalConfig] = useState<LatticeConfig | null>(null);

  var onlineNodes = useMemo(function () {
    return nodes.filter(function (n) { return n.online; });
  }, [nodes]);

  useEffect(function () {
    function handleSessions(msg: ServerMessage) {
      if (msg.type !== "session:list_all") return;
      var data = msg as { type: "session:list_all"; sessions: SessionSummary[] };
      setSessions(data.sessions);
    }

    function handleSettings(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as { type: "settings:data"; config: LatticeConfig };
      setLocalConfig(data.config);
    }

    subscribe("session:list_all", handleSessions);
    subscribe("settings:data", handleSettings);
    send({ type: "session:list_all_request" });
    send({ type: "settings:get" });

    return function () {
      unsubscribe("session:list_all", handleSessions);
      unsubscribe("settings:data", handleSettings);
    };
  }, []);

  var projectTitleMap = useMemo(function () {
    var map = new Map<string, string>();
    for (var i = 0; i < projects.length; i++) {
      map.set(projects[i].slug, projects[i].title);
    }
    return map;
  }, [projects]);

  function getProjectTitle(slug: string): string {
    return projectTitleMap.get(slug) || slug;
  }

  var sessionsByProject = useMemo(function () {
    var map = new Map<string, SessionSummary[]>();
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var arr = map.get(s.projectSlug);
      if (!arr) {
        arr = [];
        map.set(s.projectSlug, arr);
      }
      arr.push(s);
    }
    return map;
  }, [sessions]);

  var remoteNodes = nodes.filter(function (n) { return !n.isLocal; });

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="flex items-center gap-3 mb-2">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden"
            aria-label="Toggle sidebar"
            onClick={sidebar.toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <LatticeLogomark size={28} />
          <h1 className="text-lg font-mono font-bold text-base-content">Lattice</h1>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-mono text-base-content/30 mb-10 ml-[43px]">
          <span>{onlineNodes.length}/{nodes.length} nodes</span>
          <span className="text-base-content/15">/</span>
          <span>{projects.length} projects</span>
          <span className="text-base-content/15">/</span>
          <span>{sessions.length} sessions</span>
        </div>

        <div className="mb-12">
          <QuickStats />
        </div>

        {sessions.length > 0 && (
          <div className="mb-12">
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Recent Sessions</h2>
            <div className="flex flex-col gap-1">
              {sessions.slice(0, 8).map(function (s) {
                return (
                  <button
                    key={s.id}
                    onClick={function () { openSessionTab(s.id, s.projectSlug, s.title); sidebar.navigateToSession(s.projectSlug, s.id); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-200 transition-colors duration-[120ms] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary group"
                  >
                    <MessageSquare size={12} className="text-base-content/20 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-base-content/70 truncate group-hover:text-base-content">{formatSessionTitle(s.title) || "Untitled"}</span>
                    <span className="text-[10px] font-mono text-base-content/25 flex-shrink-0">
                      {getProjectTitle(s.projectSlug)}
                    </span>
                    <span className="text-[10px] text-base-content/20 font-mono flex-shrink-0">
                      {relativeTime(s.updatedAt)}
                    </span>
                    <ChevronRight size={10} className="text-base-content/15 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {projects.map(function (project) {
                var projectSessions = sessionsByProject.get(project.slug) || [];
                return (
                  <button
                    key={project.slug + "@" + project.nodeId}
                    onClick={function () { sidebar.setActiveProjectSlug(project.slug); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-base-200 transition-colors duration-[120ms] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary group"
                  >
                    <FolderOpen size={14} className="text-base-content/20 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-base-content/70 truncate group-hover:text-base-content">{project.title}</div>
                      <div className="text-[10px] text-base-content/25 font-mono">
                        {projectSessions.length} session{projectSessions.length !== 1 ? "s" : ""}
                        {project.isRemote && (
                          <span className="ml-1.5 text-base-content/20">on {project.nodeName}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={12} className="text-base-content/15 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {remoteNodes.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Mesh</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {remoteNodes.map(function (node) {
                return (
                  <div key={node.id} className="flex items-center gap-2">
                    {node.online
                      ? <CircleDot size={10} className="text-success flex-shrink-0" />
                      : <Circle size={10} className="text-base-content/20 flex-shrink-0" />
                    }
                    <span className="text-[12px] text-base-content/50">{node.name}</span>
                    <span className="text-[10px] text-base-content/20 font-mono">{node.projects.length}p</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
