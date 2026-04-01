import { useState, useEffect } from "react";
import { Sun, Moon, Settings, Download, ArrowUpCircle } from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getSessionStore } from "../../stores/session";
import pkg from "../../../package.json";
import type { ServerMessage } from "@lattice/shared";

interface UserIslandProps {
  nodeName: string;
  onClick: () => void;
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var sidebar = useSidebar();
  var { canInstall, install } = useInstallPrompt();
  var budgetStatus = useStore(getSessionStore(), function (s) { return s.budgetStatus; });
  var [showTooltip, setShowTooltip] = useState(false);
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

  var budgetBar = null;
  if (budgetStatus && budgetStatus.dailyLimit > 0) {
    var pct = Math.min((budgetStatus.dailySpend / budgetStatus.dailyLimit) * 100, 100);
    var remaining = Math.max(budgetStatus.dailyLimit - budgetStatus.dailySpend, 0);
    var barColor = pct >= 100
      ? "bg-error"
      : pct >= 80
        ? "bg-warning"
        : "bg-primary";

    budgetBar = (
      <div
        className="px-3 pt-2 pb-0 relative"
        onMouseEnter={function () { setShowTooltip(true); }}
        onMouseLeave={function () { setShowTooltip(false); }}
      >
        <div className="h-1.5 rounded-full bg-base-content/8 overflow-hidden">
          <div
            className={"h-full rounded-full transition-all duration-300 " + barColor}
            style={{ width: pct + "%" }}
          />
        </div>
        {showTooltip && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 px-2.5 py-1.5 bg-base-100 border border-base-content/10 rounded-lg shadow-lg z-50 text-[11px] font-mono text-base-content/70 whitespace-nowrap">
            <div>Daily spend: ${budgetStatus.dailySpend.toFixed(2)} / ${budgetStatus.dailyLimit.toFixed(2)}</div>
            <div className="text-base-content/40">Remaining: ${remaining.toFixed(2)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="User controls"
    >
      {budgetBar}
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
              className="btn btn-ghost btn-xs btn-square text-primary/60 hover:text-primary transition-colors"
            >
              <Download size={14} />
            </button>
          )}
          <button
            aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={function (e) { e.stopPropagation(); toggleMode(); }}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors"
          >
            {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            aria-label="Global settings"
            onClick={function () { sidebar.openSettings("appearance"); }}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
