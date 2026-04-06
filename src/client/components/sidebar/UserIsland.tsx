import { useState, useEffect, useMemo } from "react";
import { Sun, Moon, Settings, Download, ArrowUpCircle, Clock } from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getSessionStore, loadCachedRateLimits, updateRateLimit } from "../../stores/session";
import type { RateLimitEntry } from "../../stores/session";
import pkg from "../../../../package.json";
import type { ServerMessage } from "#shared";

interface UserIslandProps {
  nodeName: string;
  onClick: () => void;
}

function formatResetTime(epochSeconds: number): string {
  var now = Date.now();
  var diff = (epochSeconds * 1000) - now;
  if (diff <= 0) return "now";
  var hours = Math.floor(diff / 3600000);
  var minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) {
    var days = Math.floor(hours / 24);
    return days + "d " + (hours % 24) + "h";
  }
  if (hours > 0) return hours + "h " + minutes + "m";
  if (minutes === 0) return "<1m";
  return minutes + "m";
}

function getRateLimitLabel(type: string): string {
  if (type === "five_hour") return "5-hour";
  if (type === "seven_day") return "7-day";
  if (type === "seven_day_opus") return "7-day Opus";
  if (type === "seven_day_sonnet") return "7-day Sonnet";
  if (type === "overage") return "Overage";
  return type;
}

function getBarColor(entry: RateLimitEntry): string {
  if (entry.status === "rejected") return "bg-error";
  if (entry.status === "allowed_warning") return "bg-warning";
  var util = entry.utilization ?? 0;
  if (util >= 0.9) return "bg-error";
  if (util >= 0.7) return "bg-warning";
  return "bg-primary/60";
}

function getStatusColor(entry: RateLimitEntry): string {
  if (entry.status === "rejected") return "text-error";
  if (entry.status === "allowed_warning") return "text-warning";
  return "text-base-content/70";
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var sidebar = useSidebar();
  var { canInstall, install } = useInstallPrompt();
  var budgetStatus = useStore(getSessionStore(), function (s) { return s.budgetStatus; });
  var rateLimits = useStore(getSessionStore(), function (s) { return s.rateLimits; });
  var [showTooltip, setShowTooltip] = useState(false);
  var ws = useWebSocket();
  var [updateAvailable, setUpdateAvailable] = useState(false);
  var [latestVersion, setLatestVersion] = useState<string | null>(null);
  var [currentVersion, setCurrentVersion] = useState(pkg.version);

  useEffect(function () {
    loadCachedRateLimits();
    function handleRateLimit(msg: ServerMessage) {
      var m = msg as { type: string; status: "allowed" | "allowed_warning" | "rejected"; utilization?: number; resetsAt?: number; rateLimitType?: string; overageStatus?: string; overageResetsAt?: number; isUsingOverage?: boolean };
      if (!m.rateLimitType) return;
      updateRateLimit({
        status: m.status,
        utilization: m.utilization,
        resetsAt: m.resetsAt,
        rateLimitType: m.rateLimitType,
        overageStatus: m.overageStatus,
        overageResetsAt: m.overageResetsAt,
        isUsingOverage: m.isUsingOverage,
        updatedAt: Date.now(),
      });
    }
    ws.subscribe("chat:rate_limit", handleRateLimit);
    return function () { ws.unsubscribe("chat:rate_limit", handleRateLimit); };
  }, []);

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

  var entries = useMemo(function () {
    var all = Object.values(rateLimits);
    all.sort(function (a, b) {
      var order: Record<string, number> = { five_hour: 0, seven_day: 1, seven_day_opus: 2, seven_day_sonnet: 3, overage: 4 };
      return (order[a.rateLimitType] ?? 9) - (order[b.rateLimitType] ?? 9);
    });
    return all;
  }, [rateLimits]);

  var primaryEntry = entries.length > 0 ? entries[0] : null;

  var initial = props.nodeName.charAt(0).toUpperCase();

  var budgetBar = null;
  if (budgetStatus && budgetStatus.dailyLimit > 0) {
    var pct = Math.min((budgetStatus.dailySpend / budgetStatus.dailyLimit) * 100, 100);
    var remaining = Math.max(budgetStatus.dailyLimit - budgetStatus.dailySpend, 0);
    var barColor = pct >= 100 ? "bg-error" : pct >= 80 ? "bg-warning" : "bg-primary";

    budgetBar = (
      <div className="px-3 pt-2 pb-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-base-content/25">Budget</span>
          <span className="text-[9px] font-mono tabular-nums text-base-content/30">${remaining.toFixed(2)} left</span>
        </div>
        <div className="h-1 rounded-full bg-base-content/8 overflow-hidden">
          <div
            className={"h-full rounded-full transition-all duration-300 " + barColor}
            style={{ width: pct + "%" }}
          />
        </div>
      </div>
    );
  }

  var usageBar = null;
  if (primaryEntry) {
    var hasUtilization = primaryEntry.utilization !== undefined && primaryEntry.utilization !== null;
    var utilPct = hasUtilization ? Math.min(100, Math.round((primaryEntry.utilization as number) * 100)) : 0;

    usageBar = (
      <div
        className="px-3 pt-2 pb-0 relative"
        onMouseEnter={function () { setShowTooltip(true); }}
        onMouseLeave={function () { setShowTooltip(false); }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-mono uppercase tracking-wider text-base-content/25">
            {getRateLimitLabel(primaryEntry.rateLimitType)} usage
          </span>
          <span className={"text-[9px] font-mono tabular-nums " + getStatusColor(primaryEntry)}>
            {hasUtilization ? utilPct + "%" : "—"}
          </span>
        </div>
        <div className="h-1 rounded-full bg-base-content/8 overflow-hidden">
          <div
            className={"h-full rounded-full transition-all duration-300 " + getBarColor(primaryEntry)}
            style={{ width: utilPct + "%" }}
          />
        </div>
        {primaryEntry.resetsAt && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={7} className="text-base-content/20" />
            <span className="text-[8px] font-mono text-base-content/20">
              resets in {formatResetTime(primaryEntry.resetsAt)}
            </span>
          </div>
        )}

        {showTooltip && (
          <div className="absolute bottom-full left-2 right-2 mb-2 p-2.5 bg-base-100 border border-base-content/10 rounded-lg shadow-xl z-[9999] text-[11px] font-mono">
            <div className="text-[10px] uppercase tracking-widest text-base-content/30 font-bold mb-2">Usage Limits</div>
            <div className="flex flex-col gap-2.5">
              {entries.map(function (entry) {
                var pctVal = Math.min(100, Math.round((entry.utilization ?? 0) * 100));
                return (
                  <div key={entry.rateLimitType}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-base-content/50">{getRateLimitLabel(entry.rateLimitType)}</span>
                      <span className={"tabular-nums " + getStatusColor(entry)}>
                        {pctVal}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-base-content/8 overflow-hidden">
                      <div
                        className={"h-full rounded-full transition-all duration-300 " + getBarColor(entry)}
                        style={{ width: pctVal + "%" }}
                      />
                    </div>
                    {entry.resetsAt && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-base-content/30">
                        <Clock size={8} />
                        resets in {formatResetTime(entry.resetsAt)}
                      </div>
                    )}
                  </div>
                );
              })}

              {entries.some(function (e) { return e.isUsingOverage; }) && (
                <div className="border-t border-base-content/8 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-warning/70">
                    <span>Overage active</span>
                    {(function () {
                      var oe = entries.find(function (e) { return e.isUsingOverage && e.overageResetsAt; });
                      if (oe && oe.overageResetsAt) return <span className="text-base-content/30">resets in {formatResetTime(oe.overageResetsAt)}</span>;
                      return null;
                    })()}
                  </div>
                </div>
              )}
            </div>
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
      {usageBar}
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
