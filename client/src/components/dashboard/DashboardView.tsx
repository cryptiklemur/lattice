import { useState, useEffect, useMemo } from "react";
import { useMesh } from "../../hooks/useMesh";
import { useProjects } from "../../hooks/useProjects";
import { useSidebar } from "../../hooks/useSidebar";
import { useWebSocket } from "../../hooks/useWebSocket";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { QuickStats } from "../analytics/QuickStats";
import {
  Network, FolderOpen, Activity, MessageSquare, Menu,
  ChevronRight, Lock, Bug,
} from "lucide-react";
import type { ServerMessage, SessionSummary, LatticeConfig } from "@lattice/shared";
import { formatSessionTitle } from "../../utils/formatSessionTitle";

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

  var totalSessions = sessions.length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden"
            aria-label="Toggle sidebar"
            onClick={sidebar.toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <LatticeLogomark size={32} />
          <div>
            <h1 className="text-xl font-mono font-bold text-base-content">Lattice</h1>
            <p className="text-[13px] text-base-content/40">Multi-machine agentic dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="bg-base-200 rounded-xl p-3 px-4 border border-base-content/15">
            <div className="flex items-center gap-2 mb-1.5">
              <Network size={14} className="text-primary" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40">Nodes</span>
            </div>
            <div className="text-xl font-mono font-bold text-base-content">
              {onlineNodes.length}
              <span className="text-base-content/30 text-sm font-normal">/{nodes.length}</span>
            </div>
          </div>

          <div className="bg-base-200 rounded-xl p-3 px-4 border border-base-content/15">
            <div className="flex items-center gap-2 mb-1.5">
              <FolderOpen size={14} className="text-accent" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40">Projects</span>
            </div>
            <div className="text-xl font-mono font-bold text-base-content">{projects.length}</div>
          </div>

          <div className="bg-base-200 rounded-xl p-3 px-4 border border-base-content/15">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare size={14} className="text-info" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40">Sessions</span>
            </div>
            <div className="text-xl font-mono font-bold text-base-content">{totalSessions}</div>
          </div>

          <div className="bg-base-200 rounded-xl p-3 px-4 border border-base-content/15">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity size={14} className="text-success" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40">Status</span>
            </div>
            <div className="text-xl font-mono font-bold text-success">OK</div>
          </div>
        </div>

        <div className="mt-4 mb-8">
          <QuickStats />
        </div>

        {sessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Recent Sessions</h2>
            <div className="flex flex-col gap-1.5">
              {sessions.slice(0, 8).map(function (s) {
                return (
                  <button
                    key={s.id}
                    onClick={function () { sidebar.navigateToSession(s.projectSlug, s.id); }}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-base-content/15 bg-base-200 hover:border-base-content/30 transition-colors duration-[120ms] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MessageSquare size={12} className="text-base-content/30 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-base-content truncate">{formatSessionTitle(s.title) || "Untitled"}</span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-base-content/8 text-base-content/40 flex-shrink-0">
                      {getProjectTitle(s.projectSlug)}
                    </span>
                    <span className="text-[10px] text-base-content/30 font-mono flex-shrink-0">
                      {relativeTime(s.updatedAt)}
                    </span>
                    <ChevronRight size={12} className="text-base-content/20 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map(function (project) {
                var projectSessions = sessionsByProject.get(project.slug) || [];
                return (
                  <button
                    key={project.slug}
                    onClick={function () { sidebar.setActiveProjectSlug(project.slug); }}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl bg-base-200 border border-base-content/15 hover:border-base-content/30 transition-colors duration-[120ms] cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-primary group"
                  >
                    <FolderOpen size={16} className="text-base-content/30 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-base-content truncate">{project.title}</div>
                      <div className="text-[11px] text-base-content/30 font-mono truncate">{project.path}</div>
                      <div className="text-[10px] text-base-content/30 mt-1">
                        {projectSessions.length} session{projectSessions.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-base-content/20 mt-0.5 flex-shrink-0 group-hover:text-base-content/40" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {nodes.length > 0 && (
          <div>
            <h2 className="text-[11px] font-semibold tracking-wider uppercase text-base-content/40 mb-3">Mesh Nodes</h2>
            <div className="flex flex-col gap-2">
              {nodes.map(function (node) {
                return (
                  <div key={node.id} className="flex items-center gap-3 bg-base-200 rounded-xl px-4 py-3 border border-base-content/15">
                    <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + (node.online ? "bg-success" : "bg-error")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-base-content truncate">
                        {node.name}
                        {node.isLocal && <span className="text-base-content/30 font-normal ml-2">(this machine)</span>}
                      </div>
                      <div className="text-[11px] text-base-content/40">{node.address}:{node.port}</div>
                    </div>
                    {node.isLocal && localConfig && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {localConfig.tls && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-base-content/8 text-base-content/40">
                            <Lock size={9} />
                            TLS
                          </span>
                        )}
                        {localConfig.debug && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-warning/20 text-warning">
                            <Bug size={9} />
                            Debug
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] text-base-content/40 flex-shrink-0">
                      {node.projects.length} project{node.projects.length !== 1 ? "s" : ""}
                    </div>
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
