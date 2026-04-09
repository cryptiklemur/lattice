import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import type { ProjectInfo } from "#shared";
import type { ProjectsListMessage } from "#shared";
import type { ServerMessage } from "#shared";
import { useWebSocket } from "./useWebSocket";
import { setActiveProjectSlug, getSidebarStore } from "../stores/sidebar";

export interface UseProjectsResult {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  setActiveProject: (project: ProjectInfo | null) => void;
}

function loadCachedProjects(): ProjectInfo[] {
  try {
    const raw = localStorage.getItem("lattice:projects");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function cacheProjects(projects: ProjectInfo[]): void {
  try {
    localStorage.setItem("lattice:projects", JSON.stringify(projects));
  } catch {}
}

export function useProjects(): UseProjectsResult {
  const ws = useWebSocket();
  const [projects, setProjects] = useState<ProjectInfo[]>(loadCachedProjects);
  const activeProjectSlug = useStore(getSidebarStore(), function (state) { return state.activeProjectSlug; });

  const handleRef = useRef<(msg: ServerMessage) => void>(function () {});

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "projects:list") {
        const incoming = (msg as ProjectsListMessage).projects;
        setProjects(function (prev) {
          const incomingKeys = new Set(incoming.map(function (p) { return p.slug + "@" + p.nodeId; }));
          const kept = prev.filter(function (p) {
            if (!p.isRemote) return false;
            return !incomingKeys.has(p.slug + "@" + p.nodeId);
          });
          for (let i = 0; i < kept.length; i++) {
            (kept[i] as any).online = false;
          }
          const merged = incoming.concat(kept);
          cacheProjects(merged);
          return merged;
        });
        const storeState = getSidebarStore().state;
        const currentSlug = storeState.activeProjectSlug;
        if (currentSlug !== null) {
          const found = incoming.find(function (p: typeof incoming[number]) { return p.slug === currentSlug; });
          if (!found) {
            setProjects(function (current) {
              const stillExists = current.find(function (p) { return p.slug === currentSlug; });
              if (!stillExists && current.length > 0) {
                setActiveProjectSlug(current[0].slug);
              }
              return current;
            });
          }
        }
      }
    };
  });

  useEffect(function () {
    function handler(msg: ServerMessage) {
      handleRef.current(msg);
    }

    ws.subscribe("projects:list", handler);

    return function () {
      ws.unsubscribe("projects:list", handler);
    };
  }, [ws]);

  useEffect(function () {
    if (ws.status === "connected") {
      ws.send({ type: "settings:get" });
    }
  }, [ws.status, ws]);

  const activeProject = activeProjectSlug !== null
    ? (projects.find(function (p) { return p.slug === activeProjectSlug; }) ?? null)
    : null;

  function setActiveProject(project: ProjectInfo | null): void {
    setActiveProjectSlug(project ? project.slug : null);
  }

  return { projects, activeProject, setActiveProject };
}
