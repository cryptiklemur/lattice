import { useState, useEffect } from "react";
import { Plus, Download, Search, FolderPlus } from "lucide-react";
import type { SessionSummary } from "@lattice/shared";
import { useProjects } from "../../hooks/useProjects";
import { useMesh } from "../../hooks/useMesh";
import { useWebSocket } from "../../hooks/useWebSocket";
import { NodeRail } from "./NodeRail";
import { ProjectList } from "./ProjectList";
import { SessionList } from "./SessionList";
import { ImportPanel } from "./ImportPanel";
import { UserIsland } from "./UserIsland";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { SearchFilter } from "./SearchFilter";

function SectionLabel({ label, actions }: { label: string; actions?: React.ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0 select-none">
      <span className="text-xs font-bold tracking-wider uppercase text-base-content/40">
        {label}
      </span>
      {actions && (
        <div className="flex items-center gap-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ onSessionSelect }: { onSessionSelect?: () => void }) {
  var { projects, activeProject, setActiveProject } = useProjects();
  var { nodes, activeNodeId, setActiveNodeId } = useMesh();
  var ws = useWebSocket();
  var [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  var [projectSearch, setProjectSearch] = useState<string>("");
  var [projectSearchOpen, setProjectSearchOpen] = useState<boolean>(false);
  var [sessionSearch, setSessionSearch] = useState<string>("");
  var [sessionSearchOpen, setSessionSearchOpen] = useState<boolean>(false);
  var [importOpen, setImportOpen] = useState<boolean>(false);

  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSessionSearchOpen(function (prev) { return !prev; });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () { document.removeEventListener("keydown", handleKeyDown); };
  }, []);

  function handleSessionActivate(session: SessionSummary) {
    setActiveSessionId(session.id);
    if (onSessionSelect) {
      onSessionSelect();
    }
  }

  function handleAddProject() {
    console.log("[lattice] Add project: not yet implemented");
  }

  function handleNewSession() {
    if (!activeProject?.slug) {
      return;
    }
    ws.send({ type: "session:create", projectSlug: activeProject.slug });
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
        <div className="px-4 py-3 border-b border-base-300 flex-shrink-0 flex items-center gap-2">
          <LatticeLogomark size={20} />
          <span className="text-sm font-mono font-bold tracking-widest text-base-content/80 uppercase">
            lattice
          </span>
        </div>

        <div className="flex flex-col overflow-hidden min-h-0" style={{ flex: "0 0 auto", maxHeight: "40%" }}>
          <SectionLabel
            label="Projects"
            actions={
              <>
                <button onClick={function () { setProjectSearchOpen(function (v) { return !v; }); }} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Search projects">
                  <Search size={13} />
                </button>
                <button onClick={handleAddProject} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Add project">
                  <FolderPlus size={13} />
                </button>
              </>
            }
          />
          {projectSearchOpen && (
            <SearchFilter
              value={projectSearch}
              onChange={setProjectSearch}
              onClose={function () { setProjectSearchOpen(false); setProjectSearch(""); }}
              placeholder="Filter projects..."
            />
          )}
          <ProjectList
            projects={filteredProjects}
            activeProject={activeProject}
            onSelect={setActiveProject}
            filter={projectSearch}
          />
        </div>

        <div className="divider m-0 px-4 h-px bg-base-300 flex-shrink-0" />

        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          <SectionLabel
            label="Sessions"
            actions={
              <>
                <button onClick={function () { setSessionSearchOpen(function (v) { return !v; }); }} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Search sessions">
                  <Search size={13} />
                </button>
                <button onClick={function () { setImportOpen(function (v) { return !v; }); }} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="Import sessions">
                  <Download size={13} />
                </button>
                <button onClick={handleNewSession} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content" aria-label="New session">
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
            activeSessionId={activeSessionId}
            onSessionActivate={handleSessionActivate}
            filter={sessionSearch}
          />
        </div>

        {importOpen && activeProject && (
          <ImportPanel
            projectSlug={activeProject.slug}
            onClose={function () { setImportOpen(false); }}
            onImported={function () { setImportOpen(false); }}
          />
        )}

        <div className="divider m-0 h-px bg-base-300 flex-shrink-0" />

        <UserIsland
          nodeName="localhost"
          onSettingsClick={handleSettingsClick}
        />
      </div>
    </div>
  );
}
