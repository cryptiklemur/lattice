import { WifiOff, Loader2 } from "lucide-react";
import { useProjects } from "../../hooks/useProjects";
import { useMesh } from "../../hooks/useMesh";
import { useSidebar } from "../../hooks/useSidebar";

export function NodeDisconnectedOverlay() {
  var { activeProject } = useProjects();
  var { nodes } = useMesh();
  var sidebar = useSidebar();

  if (!activeProject || !activeProject.isRemote) return null;
  if (sidebar.activeView.type !== "chat") return null;

  var remoteNode = nodes.find(function (n) { return n.id === activeProject!.nodeId; });
  if (!remoteNode || remoteNode.online) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-base-100/80 backdrop-blur-sm">
      <div className="bg-base-300 border border-base-content/15 rounded-2xl shadow-2xl px-8 py-6 max-w-sm text-center">
        <WifiOff size={28} className="text-warning mx-auto mb-3" />
        <h3 className="text-[15px] font-mono font-bold text-base-content mb-1">Node Disconnected</h3>
        <p className="text-[13px] text-base-content/50 mb-3">
          <span className="font-semibold text-base-content/70">{remoteNode.name}</span> is unreachable.
        </p>
        <div className="flex items-center justify-center gap-2 text-[12px] text-base-content/40">
          <Loader2 size={12} className="animate-spin" />
          Attempting to reconnect...
        </div>
        <p className="text-[11px] text-base-content/25 mt-3">
          Session state preserved. Operations will resume on reconnect.
        </p>
      </div>
    </div>
  );
}
