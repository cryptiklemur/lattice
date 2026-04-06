import { Server, Wifi, WifiOff } from "lucide-react";
import type { NodeInfo } from "#shared";

interface NodeFleetOverviewProps {
  nodes: NodeInfo[];
}

export function NodeFleetOverview(props: NodeFleetOverviewProps) {
  var nodes = props.nodes;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-1">
        <span className="text-base-content/30 font-mono text-[12px]">No nodes connected</span>
        <span className="text-base-content/20 text-[11px]">Pair a node in Settings to see fleet data</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {nodes.map(function (node) {
        return (
          <div
            key={node.id}
            className={
              "rounded-lg border p-3.5 transition-colors " +
              (node.online
                ? "border-success/20 bg-success/[0.03]"
                : "border-base-content/8 bg-base-content/[0.02] opacity-60")
            }
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <Server size={14} className={node.online ? "text-success/60" : "text-base-content/25"} />
              <span className="text-[13px] font-mono font-medium text-base-content/80 truncate">{node.name}</span>
              <span className="ml-auto flex-shrink-0">
                {node.online
                  ? <Wifi size={12} className="text-success/50" />
                  : <WifiOff size={12} className="text-base-content/20" />
                }
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-base-content/35 uppercase tracking-wider">Address</span>
                <span className="text-base-content/50">{node.address}:{node.port}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-base-content/35 uppercase tracking-wider">Projects</span>
                <span className="text-base-content/50">{node.projects.length}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-base-content/35 uppercase tracking-wider">Status</span>
                <span className={node.online ? "text-success/70" : "text-base-content/30"}>
                  {node.online ? "Online" : "Offline"}
                </span>
              </div>
              {node.isLocal && (
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-base-content/35 uppercase tracking-wider">Type</span>
                  <span className="text-primary/50">Local</span>
                </div>
              )}
            </div>

            {node.projects.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-base-content/5">
                <div className="text-[9px] font-mono text-base-content/25 uppercase tracking-widest mb-1.5">Projects</div>
                <div className="flex flex-wrap gap-1">
                  {node.projects.map(function (p: typeof node.projects[number]) {
                    return (
                      <span
                        key={p.slug}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-base-content/5 text-base-content/40"
                      >
                        {p.slug}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
