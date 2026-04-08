import { useState, useEffect } from "react";
import { Sun, Moon, Settings, Download, ArrowUpCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { useWebSocket } from "../../hooks/useWebSocket";
import pkg from "../../../../package.json";
import type { ServerMessage } from "#shared";

interface UserIslandProps {
  nodeName: string;
  onClick: () => void;
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var sidebar = useSidebar();
  var { canInstall, install } = useInstallPrompt();
  var ws = useWebSocket();
  var [updateAvailable, setUpdateAvailable] = useState(false);
  var [latestVersion, setLatestVersion] = useState<string | null>(null);
  var [currentVersion, setCurrentVersion] = useState(pkg.version);

  useEffect(function () {
    function handleUpdateStatus(msg: ServerMessage) {
      if (msg.type !== "update:status") return;
      var data = msg as { type: string; updateAvailable: boolean; latestVersion: string | null; currentVersion: string };
      setUpdateAvailable(data.updateAvailable);
      setLatestVersion(data.latestVersion);
      if (data.currentVersion && data.currentVersion !== "0.0.0") {
        setCurrentVersion(data.currentVersion);
      }
    }
    ws.subscribe("update:status", handleUpdateStatus);
    ws.send({ type: "update:check" } as any);
    return function () { ws.unsubscribe("update:status", handleUpdateStatus); };
  }, []);

  var initial = props.nodeName.charAt(0).toUpperCase();

  return (
    <div
      role="group"
      aria-label="User controls"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={props.onClick}
          className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-1 py-1 -mx-1 hover:bg-base-content/5 transition-colors duration-[120ms] cursor-pointer"
          aria-label="Node info"
        >
          <div className="w-7 h-7 rounded-full bg-base-content/10 text-base-content/50 text-[12px] font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[13px] font-semibold text-base-content truncate">
              {props.nodeName}
            </div>
            <div className="text-[10px] font-mono flex items-center gap-1">
              <span className="text-base-content/30">{"v" + currentVersion}</span>
              {updateAvailable && latestVersion && (
                <span className="flex items-center gap-0.5 text-base-content/30">
                  <ArrowUpCircle size={9} />
                  {latestVersion}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {canInstall && (
            <button
              aria-label="Install Lattice"
              onClick={install}
              className="btn btn-ghost btn-xs btn-square text-primary/60 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Download size={14} />
            </button>
          )}
          <button
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={function (e) { e.stopPropagation(); toggleMode(); }}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            aria-label="Global settings"
            onClick={function () { sidebar.openSettings("appearance"); }}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
