import { useState } from "react";
import type { SessionSummary } from "@lattice/shared";
import { useProjects } from "../../hooks/useProjects";
import { useMesh } from "../../hooks/useMesh";
import { NodeRail } from "./NodeRail";
import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { UserIsland } from "./UserIsland";

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] uppercase text-base-content/40 flex-shrink-0">
      {label}
    </div>
  );
}

export function Sidebar({ onSessionSelect }: { onSessionSelect?: () => void }) {
  var { projects, activeProject, setActiveProject } = useProjects();
  var { nodes, activeNodeId, setActiveNodeId } = useMesh();
  var [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  function handleSessionActivate(session: SessionSummary) {
    setActiveSessionId(session.id);
  }

  function handleAddProject() {
    console.log("[lattice] Add project: not yet implemented");
  }

  function handleSettingsClick() {
    console.log("[lattice] Settings: not yet implemented");
  }

  var filteredProjects = activeNodeId
    ? projects.filter(function (p) { return p.nodeId === activeNodeId; })
    : projects;

  return (
    <div className="flex flex-row h-full w-full overflow-hidden bg-base-200">
      {nodes.length > 0 && (
        <NodeRail
          nodes={nodes}
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <SectionLabel label="Projects" />
          <ProjectList
            projects={filteredProjects}
            activeProject={activeProject}
            onSelect={setActiveProject}
            onAddProject={handleAddProject}
          />
        </div>

        <div className="h-px bg-base-300 flex-shrink-0" />

        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <SectionLabel label="Sessions" />
          <SessionList
            projectSlug={activeProject?.slug ?? null}
            activeSessionId={activeSessionId}
            onSessionActivate={handleSessionActivate}
          />
        </div>

        <div className="h-px bg-base-300 flex-shrink-0" />

        <UserIsland
          nodeName="localhost"
          onSettingsClick={handleSettingsClick}
        />
      </div>
    </div>
  );
}
