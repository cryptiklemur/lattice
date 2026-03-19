import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import type { ProjectInfo } from "@lattice/shared";
import type { ProjectsListMessage } from "@lattice/shared";
import type { ServerMessage } from "@lattice/shared";
import { useWebSocket } from "./useWebSocket";
import { setActiveProjectSlug, getSidebarStore } from "../stores/sidebar";

export interface UseProjectsResult {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  setActiveProject: (project: ProjectInfo | null) => void;
}

export function useProjects(): UseProjectsResult {
  var ws = useWebSocket();
  var [projects, setProjects] = useState<ProjectInfo[]>([]);
  var activeProjectSlug = useStore(getSidebarStore(), function (state) { return state.activeProjectSlug; });

  var handleRef = useRef<(msg: ServerMessage) => void>(function () {});

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "projects:list") {
        var list = (msg as ProjectsListMessage).projects;
        setProjects(list);
        var storeState = getSidebarStore().state;
        var currentSlug = storeState.activeProjectSlug;
        if (currentSlug !== null) {
          var found = list.find(function (p) { return p.slug === currentSlug; });
          if (!found && list.length > 0) {
            setActiveProjectSlug(list[0].slug);
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

  var activeProject = activeProjectSlug !== null
    ? (projects.find(function (p) { return p.slug === activeProjectSlug; }) ?? null)
    : null;

  function setActiveProject(project: ProjectInfo | null): void {
    setActiveProjectSlug(project ? project.slug : null);
  }

  return { projects, activeProject, setActiveProject };
}
