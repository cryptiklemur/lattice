import { useMesh } from "../../hooks/useMesh";
import { useProjects } from "../../hooks/useProjects";
import { useSidebar } from "../../hooks/useSidebar";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { Network, FolderOpen, Activity, Menu } from "lucide-react";

export function DashboardView() {
  var { nodes } = useMesh();
  var { projects } = useProjects();
  var { toggleDrawer } = useSidebar();
  var onlineNodes = nodes.filter(function (n) { return n.online; });

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden"
            aria-label="Toggle sidebar"
            onClick={toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <LatticeLogomark size={32} />
          <div>
            <h1 className="text-xl font-mono font-bold text-base-content">Lattice</h1>
            <p className="text-[13px] text-base-content/40">Multi-machine agentic dashboard</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-base-200 rounded-lg p-4 border border-base-300">
            <div className="flex items-center gap-2 mb-2">
              <Network size={16} className="text-primary" />
              <span className="text-xs font-bold tracking-wider uppercase text-base-content/40">Nodes</span>
            </div>
            <div className="text-2xl font-mono font-bold text-base-content">
              {onlineNodes.length}
              <span className="text-base-content/30 text-sm font-normal">/{nodes.length}</span>
            </div>
            <div className="text-[11px] text-base-content/40 mt-1">online</div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 border border-base-300">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen size={16} className="text-accent" />
              <span className="text-xs font-bold tracking-wider uppercase text-base-content/40">Projects</span>
            </div>
            <div className="text-2xl font-mono font-bold text-base-content">
              {projects.length}
            </div>
            <div className="text-[11px] text-base-content/40 mt-1">across all nodes</div>
          </div>

          <div className="bg-base-200 rounded-lg p-4 border border-base-300">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-success" />
              <span className="text-xs font-bold tracking-wider uppercase text-base-content/40">Status</span>
            </div>
            <div className="text-2xl font-mono font-bold text-success">
              OK
            </div>
            <div className="text-[11px] text-base-content/40 mt-1">all systems</div>
          </div>
        </div>

        {nodes.length > 0 && (
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-base-content/40 mb-3">Mesh Nodes</h2>
            <div className="flex flex-col gap-2">
              {nodes.map(function (node) {
                return (
                  <div key={node.id} className="flex items-center gap-3 bg-base-200 rounded-lg px-4 py-3 border border-base-300">
                    <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + (node.online ? "bg-success" : "bg-error")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-base-content truncate">
                        {node.name}
                        {node.isLocal && <span className="text-base-content/30 font-normal ml-2">(this machine)</span>}
                      </div>
                      <div className="text-[11px] text-base-content/40">{node.address}:{node.port}</div>
                    </div>
                    <div className="text-[11px] text-base-content/40">
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
