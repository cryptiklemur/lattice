import { useEffect, useRef, useState } from "react";
import type { ProjectInfo } from "@lattice/shared";
import type { ProjectsListMessage } from "@lattice/shared";
import type { ServerMessage } from "@lattice/shared";
import { useWebSocket } from "./useWebSocket";

export interface UseProjectsResult {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  setActiveProject: (project: ProjectInfo | null) => void;
}

export function useProjects(): UseProjectsResult {
  var ws = useWebSocket();
  var [projects, setProjects] = useState<ProjectInfo[]>([]);
  var [activeProject, setActiveProject] = useState<ProjectInfo | null>(null);

  var handleRef = useRef<(msg: ServerMessage) => void>(function () {});

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "projects:list") {
        var list = (msg as ProjectsListMessage).projects;
        setProjects(list);
        setActiveProject(function (prev) {
          if (prev === null && list.length > 0) {
            return list[0];
          }
          if (prev !== null) {
            var found = list.find(function (p) { return p.slug === prev.slug; });
            return found ?? (list.length > 0 ? list[0] : null);
          }
          return null;
        });
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

  return { projects, activeProject, setActiveProject };
}
