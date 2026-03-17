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
    <div
      style={{
        padding: "8px 12px 4px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        fontFamily: "var(--font-ui)",
        flexShrink: 0,
      }}
    >
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
    <div
      className="sidebar-inner"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {nodes.length > 0 && (
        <NodeRail
          nodes={nodes}
          activeNodeId={activeNodeId}
          onSelectNode={setActiveNodeId}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <SectionLabel label="Projects" />
          <ProjectList
            projects={filteredProjects}
            activeProject={activeProject}
            onSelect={setActiveProject}
            onAddProject={handleAddProject}
          />
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--border-subtle)",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <SectionLabel label="Sessions" />
          <SessionList
            projectSlug={activeProject?.slug ?? null}
            activeSessionId={activeSessionId}
            onSessionActivate={handleSessionActivate}
          />
        </div>

        <div
          style={{
            height: "1px",
            background: "var(--border-subtle)",
            flexShrink: 0,
          }}
        />

        <UserIsland
          nodeName="localhost"
          onSettingsClick={handleSettingsClick}
        />
      </div>
    </div>
  );
}
