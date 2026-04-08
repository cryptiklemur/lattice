import { useMemo, useCallback, useEffect, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { Activity, AlertTriangle, TrendingUp, Gauge, X, Plug, PlugZap, Monitor, ChevronLeft, Clock, ArrowUpDown, History, Filter } from "lucide-react";
import { getContextAnalyzerStore, dismissAnomaly, selectSession, getSelectedAnalysis } from "../../stores/context-analyzer";
import type { ToolDeltaEntry, AnomalyEntry, ExternalSessionSnapshot, SessionAnalysis, ToolEventEntry } from "../../stores/context-analyzer";
import type { ToolBaseline } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-200";

interface HistoricalSessionSummary {
  hookSessionId: string;
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
  usedPercent: number;
  costUsd: number;
  durationMs: number;
  modelName: string;
  timestamp: number;
  endedAt: number | null;
  active: boolean;
  projectName: string | null;
  projectSlug: string | null;
  toolEventCount: number;
  toolDeltaCount: number;
}

interface HistoricalSessionFull extends HistoricalSessionSummary {
  toolEvents: ToolEventEntry[];
  toolDeltas: Array<{ toolName: string; total: number; timestamp: number }>;
  anomalyCount: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s";
  return Math.floor(seconds / 3600) + "h " + Math.floor((seconds % 3600) / 60) + "m";
}

interface ToolSummary {
  name: string;
  count: number;
  totalTokens: number;
  avgTokens: number;
  lastDelta: number;
  baseline: ToolBaseline | null;
}

function buildToolSummaries(analysis: SessionAnalysis): ToolSummary[] {
  const map = new Map<string, { count: number; total: number; last: number }>();
  for (let i = 0; i < analysis.deltas.length; i++) {
    const d = analysis.deltas[i];
    const existing = map.get(d.toolName);
    if (existing) {
      existing.count++;
      existing.total += d.delta.total;
      existing.last = d.delta.total;
    } else {
      map.set(d.toolName, { count: 1, total: d.delta.total, last: d.delta.total });
    }
  }
  const result: ToolSummary[] = [];
  map.forEach(function (v, name) {
    result.push({
      name,
      count: v.count,
      totalTokens: v.total,
      avgTokens: Math.round(v.total / v.count),
      lastDelta: v.last,
      baseline: analysis.baselines[name] || null,
    });
  });
  result.sort(function (a, b) { return b.totalTokens - a.totalTokens; });
  return result;
}

export function ContextAnalyzerView() {
  const hooksInstalled = useStore(getContextAnalyzerStore(), function (s) { return s.hooksInstalled; });
  const hooksMessage = useStore(getContextAnalyzerStore(), function (s) { return s.hooksMessage; });
  const externalSessions = useStore(getContextAnalyzerStore(), function (s) { return s.externalSessions; });
  const selectedSessionId = useStore(getContextAnalyzerStore(), function (s) { return s.selectedSessionId; });
  const sessionAnalysis = useStore(getContextAnalyzerStore(), function (s) { return s.sessionAnalysis; });
  const analysis = useStore(getContextAnalyzerStore(), function (s) { return getSelectedAnalysis(s); });
  const{ send } = useWebSocket();

  const handleInstallHooks = useCallback(function () {
    send({ type: "context:action", action: "install_hooks" } as any);
  }, [send]);

  const handleUninstallHooks = useCallback(function () {
    send({ type: "context:action", action: "uninstall_hooks" } as any);
  }, [send]);

  const handleCheckHooks = useCallback(function () {
    send({ type: "context:action", action: "check_hooks" } as any);
  }, [send]);

  useEffect(function () {
    if (hooksInstalled === null) {
      send({ type: "context:action", action: "check_hooks" } as any);
    }
  }, [hooksInstalled, send]);

  const toolSummaries = useMemo(function () {
    return buildToolSummaries(analysis);
  }, [analysis]);

  const activeAnomalies = useMemo(function () {
    return analysis.anomalies.filter(function (a) { return !a.dismissed; });
  }, [analysis.anomalies]);

  const hasData = analysis.deltas.length > 0 || analysis.toolEvents.length > 0;

  const externalSessionList = useMemo(function () {
    return Object.values(externalSessions).sort(function (a, b) { return b.timestamp - a.timestamp; });
  }, [externalSessions]);

  const selectedSnapshot = selectedSessionId ? externalSessions[selectedSessionId] || null : null;

  const [historicalSessions, setHistoricalSessions] = useState<HistoricalSessionSummary[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "active" | "ended">("all");
  const [historyProjectFilter, setHistoryProjectFilter] = useState<string | null>(null);
  const [selectedHistorySession, setSelectedHistorySession] = useState<HistoricalSessionFull | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(function () {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyFilter === "active") params.set("active", "true");
    if (historyFilter === "ended") params.set("active", "false");
    if (historyProjectFilter) params.set("project", historyProjectFilter);
    params.set("limit", "100");
    fetch("/api/session-history?" + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (data: HistoricalSessionSummary[]) {
        setHistoricalSessions(data);
        setHistoryLoading(false);
      })
      .catch(function () { setHistoryLoading(false); });
  }, [historyFilter, historyProjectFilter]);

  useEffect(function () {
    loadHistory();
  }, [loadHistory]);

  const handleSelectHistorySession = useCallback(function (id: string) {
    fetch("/api/session-history/" + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (data: HistoricalSessionFull) {
        setSelectedHistorySession(data);
      })
      .catch(function () {});
  }, []);

  const historyProjects = useMemo(function () {
    const seen = new Set<string>();
    for (const s of historicalSessions) {
      if (s.projectName) seen.add(s.projectName);
    }
    return Array.from(seen).sort();
  }, [historicalSessions]);

  return (
    <div className="flex-1 overflow-y-auto bg-base-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-primary" aria-hidden="true" />
          <h1 className="text-lg font-mono font-bold text-base-content">Context Analyzer</h1>
        </div>

        <HooksPanel
          installed={hooksInstalled}
          message={hooksMessage}
          onInstall={handleInstallHooks}
          onUninstall={handleUninstallHooks}
          onCheck={handleCheckHooks}
        />

        {selectedHistorySession ? (
          <HistoryDetailView
            session={selectedHistorySession}
            onBack={function () { setSelectedHistorySession(null); }}
          />
        ) : selectedSessionId ? (
          <SessionDetailView
            sessionId={selectedSessionId}
            snapshot={selectedSnapshot}
            analysis={analysis}
            toolSummaries={toolSummaries}
            activeAnomalies={activeAnomalies}
            hasData={hasData}
            onBack={function () { selectSession(null); }}
          />
        ) : (
          <>
            {externalSessionList.length > 0 && (
              <ExternalSessions
                sessions={externalSessionList}
                sessionAnalysis={sessionAnalysis}
                onSelect={function (id) { selectSession(id); }}
              />
            )}

            {hasData ? (
              <section aria-label="Active Lattice session analysis">
                <div className="px-1 mb-4">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-base-content/25">Active Lattice Session</span>
                </div>
                <AnalysisDisplay
                  analysis={analysis}
                  toolSummaries={toolSummaries}
                  activeAnomalies={activeAnomalies}
                />
              </section>
            ) : (
              <EmptyState hooksInstalled={hooksInstalled} />
            )}

            <SessionHistoryList
              sessions={historicalSessions}
              loading={historyLoading}
              filter={historyFilter}
              projectFilter={historyProjectFilter}
              projects={historyProjects}
              onFilterChange={setHistoryFilter}
              onProjectChange={setHistoryProjectFilter}
              onSelect={handleSelectHistorySession}
              onRefresh={loadHistory}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SessionDetailView({ sessionId, snapshot, analysis, toolSummaries, activeAnomalies, hasData, onBack }: {
  sessionId: string;
  snapshot: ExternalSessionSnapshot | null;
  analysis: SessionAnalysis;
  toolSummaries: ToolSummary[];
  activeAnomalies: AnomalyEntry[];
  hasData: boolean;
  onBack: () => void;
}) {
  return (
    <section aria-label={"Session " + sessionId.slice(0, 12)}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to session overview"
        className={"flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors min-h-[44px] " + focusRing}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back to overview
      </button>

      {snapshot && (
        <div className="bg-base-200 rounded-lg px-4 py-3 mt-4">
          <div className="flex items-center gap-2">
            <div
              className={"!size-2.5 rounded-full flex-shrink-0 " + (snapshot.active ? "bg-success motion-safe:animate-pulse" : "bg-base-content/15")}
              aria-hidden="true"
            />
            <span className="text-xs font-mono font-semibold text-base-content/70">{sessionId.slice(0, 12)}</span>
            <span className="text-[11px] font-mono text-base-content/30">{snapshot.modelName}</span>
            <span className={"text-[11px] font-mono px-1.5 py-0.5 rounded " + (snapshot.active ? "bg-success/15 text-success" : "bg-base-content/5 text-base-content/30")}>
              {snapshot.active ? "Active" : "Ended"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-mono">
            <InlineStat label="In" value={formatTokens(snapshot.inputTokens)} colorClass="text-info" />
            <InlineStat label="Out" value={formatTokens(snapshot.outputTokens)} colorClass="text-secondary" />
            <InlineStat label="Ctx" value={Math.round(snapshot.usedPercent) + "%"} colorClass={contextColor(snapshot.usedPercent)} sub={formatTokens(snapshot.contextWindow) + " window"} />
            <InlineStat label="Cost" value={"$" + snapshot.costUsd.toFixed(3)} colorClass="text-accent" />
            <span className="text-base-content/25">{formatDuration(Math.round(snapshot.durationMs / 1000))} elapsed</span>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-6">
        {hasData ? (
          <AnalysisDisplay
            analysis={analysis}
            toolSummaries={toolSummaries}
            activeAnomalies={activeAnomalies}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity size={24} className="text-base-content/15 mb-2" aria-hidden="true" />
            <p className="text-xs text-base-content/40 font-mono">No tool analysis data yet for this session</p>
            <p className="text-[10px] text-base-content/25 mt-1">Tool attribution data appears as tools are used and statusline updates arrive.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisDisplay({ analysis, toolSummaries, activeAnomalies }: {
  analysis: SessionAnalysis;
  toolSummaries: ToolSummary[];
  activeAnomalies: AnomalyEntry[];
}) {
  return (
    <div className="space-y-6">
      <StatsRow burnRate={analysis.burnRate} deltas={analysis.deltas} toolCount={toolSummaries.length} />
      {activeAnomalies.length > 0 && <AnomalyBanner anomalies={activeAnomalies} />}
      {analysis.toolEvents.length > 0 && <ToolCostTimeline events={analysis.toolEvents} />}
      {toolSummaries.length > 0 && <ToolBreakdownTable summaries={toolSummaries} />}
      {Object.keys(analysis.baselines).length > 0 && <BaselineStats baselines={analysis.baselines} />}
      {analysis.anomalies.length > 0 && <AnomalyHistory anomalies={analysis.anomalies} />}
    </div>
  );
}

function EmptyState({ hooksInstalled }: { hooksInstalled: boolean | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-4">
        <Activity size={32} className="text-primary/20" aria-hidden="true" />
        <div className="absolute -top-1 -right-1 !size-3 rounded-full bg-primary/10 motion-safe:animate-pulse" />
      </div>
      <p className="text-sm text-base-content/40 font-mono">No tool activity yet</p>
      {hooksInstalled === true ? (
        <p className="text-xs text-base-content/25 mt-1.5 max-w-xs">Hooks are active. Data will appear as you use tools in Claude Code sessions.</p>
      ) : hooksInstalled === false ? (
        <p className="text-xs text-base-content/25 mt-1.5 max-w-xs">Install hooks above to track token usage across all your Claude Code sessions.</p>
      ) : (
        <p className="text-xs text-base-content/25 mt-1.5 max-w-xs">Token attribution data will appear as tools are used in the active session.</p>
      )}
    </div>
  );
}

function StatsRow({ burnRate, deltas, toolCount }: {
  burnRate: { tokensPerMinute: number; estimatedSecondsToCompact: number | null; currentUsage: number; compactThreshold: number } | null;
  deltas: ToolDeltaEntry[];
  toolCount: number;
}) {
  const totalTokens = useMemo(function () {
    let sum = 0;
    for (let i = 0; i < deltas.length; i++) sum += deltas[i].delta.total;
    return sum;
  }, [deltas]);

  return (
    <div className="bg-base-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono" role="list" aria-label="Session statistics">
      <InlineStat label="Calls" value={String(deltas.length)} colorClass="text-primary" title="Number of tool invocations tracked via statusline deltas" />
      <InlineStat label="Types" value={String(toolCount)} colorClass="text-secondary" title="Distinct tool types observed in this session" />
      <InlineStat label="Attributed" value={formatTokens(totalTokens)} colorClass="text-accent" title="Total tokens attributed to specific tool calls by measuring context window deltas" />
      <InlineStat
        label="Burn"
        value={burnRate ? formatTokens(burnRate.tokensPerMinute) + "/min" : "--"}
        colorClass={burnRate ? "text-info" : "text-base-content/30"}
        title="Tokens consumed per minute. Predicts when context compaction will trigger."
        sub={burnRate?.estimatedSecondsToCompact != null
          ? "~" + formatDuration(burnRate.estimatedSecondsToCompact) + " to compact"
          : undefined}
      />
    </div>
  );
}

function InlineStat({ label, value, colorClass, sub, title }: { label: string; value: string; colorClass?: string; sub?: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="listitem" title={title}>
      <span className="text-base-content/30 uppercase tracking-wider text-[10px]">{label}</span>
      <span className={"font-semibold " + (colorClass || "text-base-content")} aria-label={label + ": " + value}>{value}</span>
      {sub && <span className="text-base-content/25">{sub}</span>}
    </span>
  );
}

function HooksPanel({ installed, message, onInstall, onUninstall, onCheck }: {
  installed: boolean | null;
  message: string | null;
  onInstall: () => void;
  onUninstall: () => void;
  onCheck: () => void;
}) {
  const checked = installed !== null;
  return (
    <section aria-label="Claude Code hooks status" className="bg-base-200 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {installed ? (
            <PlugZap size={14} className="text-success" aria-hidden="true" />
          ) : (
            <Plug size={14} className="text-base-content/30" aria-hidden="true" />
          )}
          <span className="text-xs font-mono font-semibold text-base-content/70">Claude Code Hooks</span>
          {checked && (
            <span className={"text-[10px] font-mono px-1.5 py-0.5 rounded " + (installed ? "bg-success/15 text-success" : "bg-base-content/5 text-base-content/30")}>
              {installed ? "Active" : "Not installed"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!checked && (
            <button
              type="button"
              onClick={onCheck}
              aria-label="Check hook installation status"
              className={"text-[10px] font-mono text-primary hover:text-primary/80 transition-colors min-h-[44px] px-2 " + focusRing}
            >
              Check status
            </button>
          )}
          {checked && installed && (
            <button
              type="button"
              onClick={onUninstall}
              aria-label="Uninstall Claude Code hooks"
              className={"text-[10px] font-mono text-error/60 hover:text-error transition-colors min-h-[44px] px-2 " + focusRing}
            >
              Uninstall
            </button>
          )}
          {checked && !installed && (
            <button
              type="button"
              onClick={onInstall}
              aria-label="Install Claude Code hooks"
              className={"text-[10px] font-mono text-primary hover:text-primary/80 transition-colors min-h-[44px] px-2 " + focusRing}
            >
              Install hooks
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className="text-[10px] font-mono text-base-content/40 mt-1.5">{message}</p>
      )}
      {!checked && (
        <p className="text-[10px] font-mono text-base-content/25 mt-1">
          Install hooks to track token usage across all Claude Code sessions, not just Lattice-managed ones.
        </p>
      )}
    </section>
  );
}

function ExternalSessions({ sessions, sessionAnalysis, onSelect }: {
  sessions: ExternalSessionSnapshot[];
  sessionAnalysis: Record<string, SessionAnalysis>;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-label="External CLI sessions" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <Monitor size={13} className="text-secondary/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">External CLI Sessions</h2>
        <span className="text-[10px] font-mono text-base-content/25 ml-auto">{sessions.length} tracked</span>
      </div>
      <div className="divide-y divide-base-content/5" role="list">
        {sessions.slice(0, 10).map(function (s) {
          const time = new Date(s.timestamp);
          const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const sa = sessionAnalysis[s.hookSessionId];
          const deltaCount = sa ? sa.deltas.length : 0;
          const eventCount = sa ? sa.toolEvents.length : 0;
          const anomalyCount = sa ? sa.anomalies.filter(function (a) { return !a.dismissed; }).length : 0;
          const statusLabel = s.active ? "Active" : "Ended";
          return (
            <button
              key={s.hookSessionId}
              type="button"
              role="listitem"
              onClick={function () { onSelect(s.hookSessionId); }}
              aria-label={"View session " + s.hookSessionId.slice(0, 12) + ", " + statusLabel + ", " + (s.projectName || "unknown project") + ", " + s.modelName + ", " + formatTokens(s.inputTokens + s.outputTokens) + " tokens"}
              className={"flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-base-content/3 transition-colors min-h-[44px] " + focusRing}
            >
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className={"!size-2.5 rounded-full " + (s.active ? "bg-success motion-safe:animate-pulse" : "bg-base-content/15")}
                  aria-hidden="true"
                />
                <span className={"text-[10px] font-mono " + (s.active ? "text-success" : "text-base-content/30")}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-base-content/70 font-semibold truncate">{s.hookSessionId.slice(0, 12)}</span>
                  {s.projectName && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/70">{s.projectName}</span>
                  )}
                  <span className="text-[10px] font-mono text-base-content/30">{s.modelName}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-base-content/40">
                  <span>{formatTokens(s.inputTokens + s.outputTokens)} tokens</span>
                  <span className={contextColor(s.usedPercent)}>{Math.round(s.usedPercent)}% ctx</span>
                  <span>${s.costUsd.toFixed(3)}</span>
                  {eventCount > 0 && (
                    <span>{eventCount} events</span>
                  )}
                  {deltaCount > 0 && (
                    <span>{deltaCount} tools</span>
                  )}
                  {anomalyCount > 0 && (
                    <span className="text-warning">{anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"}</span>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-mono text-base-content/25 tabular-nums hidden sm:inline">{timeStr}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const TOOL_COLORS: Record<string, { bg: string; text: string }> = {
  Read: { bg: "bg-info", text: "text-info" },
  Write: { bg: "bg-success", text: "text-success" },
  Edit: { bg: "bg-success", text: "text-success" },
  MultiEdit: { bg: "bg-success", text: "text-success" },
  Bash: { bg: "bg-warning", text: "text-warning" },
  Glob: { bg: "bg-accent", text: "text-accent" },
  Grep: { bg: "bg-accent", text: "text-accent" },
  Agent: { bg: "bg-secondary", text: "text-secondary" },
  WebSearch: { bg: "bg-primary", text: "text-primary" },
  WebFetch: { bg: "bg-primary", text: "text-primary" },
};

function getToolColor(toolName: string): { bg: string; text: string } {
  if (TOOL_COLORS[toolName]) return TOOL_COLORS[toolName];
  const { display } = displayToolName(toolName);
  return TOOL_COLORS[display] || { bg: "bg-base-content/40", text: "text-base-content/50" };
}

function contextColor(pct: number): string {
  if (pct >= 80) return "text-error";
  if (pct >= 60) return "text-warning";
  return "text-success";
}

function displayToolName(toolName: string): { display: string; namespace: string | null } {
  const parts = toolName.split("__");
  if (parts.length >= 3 && parts[0] === "mcp") {
    return { display: parts.slice(2).join("_"), namespace: parts[1] };
  }
  return { display: toolName, namespace: null };
}

function ToolCostTimeline({ events }: { events: ToolEventEntry[] }) {
  const [sortBy, setSortBy] = useState<"time" | "cost">("time");
  const [filterTool, setFilterTool] = useState<string | null>(null);

  const toolTypes = useMemo(function () {
    const seen = new Map<string, number>();
    for (let i = 0; i < events.length; i++) {
      const name = events[i].toolName;
      seen.set(name, (seen.get(name) || 0) + 1);
    }
    return Array.from(seen.entries()).sort(function (a, b) { return b[1] - a[1]; });
  }, [events]);

  const filtered = useMemo(function () {
    const base = filterTool ? events.filter(function (e) { return e.toolName === filterTool; }) : events;
    if (sortBy === "cost") {
      return [...base].sort(function (a, b) { return b.estimatedTotalTokens - a.estimatedTotalTokens; });
    }
    return [...base].sort(function (a, b) { return b.timestamp - a.timestamp; });
  }, [events, filterTool, sortBy]);

  const maxTokens = useMemo(function () {
    let max = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].estimatedTotalTokens > max) max = filtered[i].estimatedTotalTokens;
    }
    return Math.max(max, 1);
  }, [filtered]);

  const totalTokens = useMemo(function () {
    let sum = 0;
    for (let i = 0; i < events.length; i++) sum += events[i].estimatedTotalTokens;
    return sum;
  }, [events]);

  return (
    <section aria-label="Tool cost timeline" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <Clock size={13} className="text-primary/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">Tool Cost Timeline</h2>
        <span className="text-[11px] font-mono text-base-content/25 ml-auto">
          {filterTool ? filtered.length + "/" : ""}{events.length} calls, ~{formatTokens(totalTokens)} tokens
        </span>
      </div>
      {toolTypes.length > 1 && (
        <div className="px-4 py-2 border-b border-base-content/5 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={function () { setSortBy(sortBy === "time" ? "cost" : "time"); }}
            className={"text-[11px] font-mono px-2 py-1 rounded flex items-center gap-1 transition-colors " + focusRing + " " + (sortBy === "cost" ? "bg-primary/15 text-primary" : "text-base-content/40 hover:text-base-content/60")}
            title={"Sort by " + (sortBy === "time" ? "token cost" : "time")}
          >
            <ArrowUpDown size={10} aria-hidden="true" />
            {sortBy === "time" ? "Time" : "Cost"}
          </button>
          <span className="text-base-content/10">|</span>
          <button
            type="button"
            onClick={function () { setFilterTool(null); }}
            className={"text-[11px] font-mono px-2 py-1 rounded transition-colors " + focusRing + " " + (filterTool === null ? "bg-base-content/10 text-base-content/70" : "text-base-content/30 hover:text-base-content/50")}
          >
            All
          </button>
          {toolTypes.slice(0, 8).map(function (entry) {
            const [name, count] = entry;
            const color = getToolColor(name);
            const { display } = displayToolName(name);
            const isActive = filterTool === name;
            return (
              <button
                key={name}
                type="button"
                onClick={function () { setFilterTool(isActive ? null : name); }}
                className={"text-[11px] font-mono px-2 py-1 rounded transition-colors " + focusRing + " " + (isActive ? color.text + " bg-base-content/10" : "text-base-content/30 hover:text-base-content/50")}
                title={name + " (" + count + " calls)"}
              >
                {display} <span className="text-base-content/20">{count}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="divide-y divide-base-content/5 max-h-80 overflow-y-auto" role="list" aria-label={"Tool calls sorted by " + sortBy}>
        {filtered.map(function (ev, i) {
          const time = new Date(ev.timestamp);
          const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const barWidth = Math.max(2, (ev.estimatedTotalTokens / maxTokens) * 100);
          const colorClass = getToolColor(ev.toolName);
          const { display: toolDisplay, namespace: toolNs } = displayToolName(ev.toolName);
          return (
            <div key={ev.timestamp + "-" + i} role="listitem" className="px-4 py-2 hover:bg-base-content/3 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-base-content/25 tabular-nums w-16 flex-shrink-0 hidden sm:block">{timeStr}</span>
                <div className="w-28 sm:w-36 flex-shrink-0 min-w-0" title={ev.toolName}>
                  <span className={"text-xs font-mono font-semibold truncate block " + colorClass.text}>{toolDisplay}</span>
                  {toolNs && <span className="text-[10px] font-mono text-base-content/20 truncate block">{toolNs}</span>}
                </div>
                <div className="flex-1 min-w-0 hidden sm:flex flex-col gap-0.5">
                  {ev.inputSummary && (
                    <span className="text-[10px] font-mono text-base-content/30 truncate block" title={ev.inputSummary}>{ev.inputSummary}</span>
                  )}
                  <div className="h-1.5 bg-base-300 rounded-full overflow-hidden" role="meter" aria-label={"Token usage: " + formatTokens(ev.estimatedTotalTokens)} aria-valuenow={ev.estimatedTotalTokens} aria-valuemax={maxTokens}>
                    <div
                      className={"h-full rounded-full transition-all " + colorClass.bg}
                      style={{ width: barWidth + "%" }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-mono text-base-content/50 tabular-nums">
                    ~{formatTokens(ev.estimatedTotalTokens)}
                  </span>
                  {ev.estimatedInputTokens > 0 && ev.estimatedOutputTokens > 0 && (
                    <div className="text-[9px] font-mono text-base-content/20 tabular-nums hidden sm:block">
                      {formatTokens(ev.estimatedInputTokens)}in / {formatTokens(ev.estimatedOutputTokens)}out
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:hidden mt-1">
                <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                  <div
                    className={"h-full rounded-full " + colorClass.bg}
                    style={{ width: barWidth + "%" }}
                  />
                </div>
                {ev.inputSummary && (
                  <span className="text-[10px] font-mono text-base-content/30 truncate block mt-0.5">{ev.inputSummary}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AnomalyBanner({ anomalies }: { anomalies: AnomalyEntry[] }) {
  return (
    <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-3" role="alert">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-warning" aria-hidden="true" />
        <span className="text-xs font-mono font-bold text-warning">
          {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} detected
        </span>
      </div>
      <div className="space-y-1">
        {anomalies.slice(0, 3).map(function (a, i) {
          return (
            <div key={a.toolId + "-" + a.timestamp + "-" + i} className="flex items-center justify-between text-xs">
              <span className="text-base-content/60 font-mono">
                {a.toolName}: {formatTokens(a.observed)} tokens (expected ~{formatTokens(a.expected)}, z={a.zScore.toFixed(1)})
              </span>
              <button
                type="button"
                onClick={function () { dismissAnomaly(a.toolId, a.timestamp); }}
                aria-label={"Dismiss anomaly for " + a.toolName}
                className={"text-base-content/30 hover:text-base-content/60 transition-colors p-2 -m-1 min-h-[44px] min-w-[44px] flex items-center justify-center " + focusRing}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToolBreakdownTable({ summaries }: { summaries: ToolSummary[] }) {
  return (
    <section aria-label="Per-tool token attribution" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <Activity size={13} className="text-accent/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">Per-Tool Token Attribution</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono" aria-label="Tool token breakdown">
          <thead>
            <tr className="border-b border-base-content/5">
              <th scope="col" className="text-left px-4 py-2 text-base-content/30 font-semibold">Tool</th>
              <th scope="col" className="text-right px-4 py-2 text-base-content/30 font-semibold">Calls</th>
              <th scope="col" className="text-right px-4 py-2 text-base-content/30 font-semibold">Total</th>
              <th scope="col" className="text-right px-4 py-2 text-base-content/30 font-semibold hidden sm:table-cell">Avg</th>
              <th scope="col" className="text-right px-4 py-2 text-base-content/30 font-semibold hidden sm:table-cell">Last</th>
              <th scope="col" className="text-right px-4 py-2 text-base-content/30 font-semibold hidden md:table-cell">Baseline</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(function (s) {
              const isAnomalous = s.baseline && s.baseline.count >= 3 && s.baseline.stddev > 0 &&
                (s.lastDelta - s.baseline.mean) / Math.max(s.baseline.stddev, 100) >= 2.0;
              const { display: tDisplay, namespace: tNs } = displayToolName(s.name);
              return (
                <tr key={s.name} className="border-b border-base-content/5 hover:bg-base-content/3 transition-colors">
                  <td className="px-4 py-2" title={s.name}>
                    <span className={"font-semibold " + getToolColor(s.name).text}>{tDisplay}</span>
                    {tNs && <span className="text-[10px] text-base-content/20 ml-1.5">{tNs}</span>}
                  </td>
                  <td className="text-right px-4 py-2 text-base-content/50">{s.count}</td>
                  <td className="text-right px-4 py-2 text-base-content/70 font-semibold">{formatTokens(s.totalTokens)}</td>
                  <td className="text-right px-4 py-2 text-base-content/50 hidden sm:table-cell">{formatTokens(s.avgTokens)}</td>
                  <td className={"text-right px-4 py-2 font-semibold hidden sm:table-cell " + (isAnomalous ? "text-warning" : "text-base-content/70")}>
                    {formatTokens(s.lastDelta)}
                    {isAnomalous && <AlertTriangle size={10} className="inline ml-1 text-warning" aria-label="Anomalous value" />}
                  </td>
                  <td className="text-right px-4 py-2 text-base-content/40 hidden md:table-cell">
                    {s.baseline ? formatTokens(s.baseline.mean) + " +/- " + formatTokens(s.baseline.stddev) : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BaselineStats({ baselines }: { baselines: Record<string, ToolBaseline> }) {
  const entries = useMemo(function () {
    return Object.entries(baselines)
      .filter(function (e) { return e[1].count >= 2; })
      .sort(function (a, b) { return b[1].mean - a[1].mean; });
  }, [baselines]);

  if (entries.length === 0) return null;

  return (
    <section aria-label="Statistical baselines" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <Gauge size={13} className="text-info/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">Statistical Baselines</h2>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(function (entry) {
          const[name, b] = entry;
          const range = b.max - b.min;
          const meanPos = range > 0 ? ((b.mean - b.min) / range) * 100 : 50;
          return (
            <div key={name} className="bg-base-100 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-base-content/70 font-semibold" title={name}>{name}</span>
                <span className="text-[10px] font-mono text-base-content/30">{b.count} samples</span>
              </div>
              <div
                className="relative h-2 bg-base-300 rounded-full overflow-hidden mb-1.5"
                role="meter"
                aria-label={name + " baseline: " + formatTokens(b.mean) + " average"}
                aria-valuenow={b.mean}
                aria-valuemin={b.min}
                aria-valuemax={b.max}
              >
                <div
                  className="absolute top-0 h-full bg-primary/30 rounded-full"
                  style={{
                    left: Math.max(0, meanPos - 15) + "%",
                    width: "30%",
                  }}
                />
                <div
                  className="absolute top-0 w-0.5 h-full bg-primary"
                  style={{ left: meanPos + "%" }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-base-content/30">
                <span>{formatTokens(b.min)}</span>
                <span className="text-base-content/50">{formatTokens(b.mean)} avg</span>
                <span>{formatTokens(b.max)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HistoryDetailView({ session, onBack }: {
  session: HistoricalSessionFull;
  onBack: () => void;
}) {
  const time = new Date(session.timestamp);
  const dateStr = time.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const endStr = session.endedAt
    ? new Date(session.endedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

  const toolEvents: ToolEventEntry[] = useMemo(function () {
    return (session.toolEvents || []).map(function (e) {
      return { ...e, hookSessionId: session.hookSessionId };
    });
  }, [session]);

  const deltaSummaries: ToolSummary[] = useMemo(function () {
    const map = new Map<string, { count: number; total: number; last: number }>();
    for (const d of session.toolDeltas || []) {
      const existing = map.get(d.toolName);
      if (existing) {
        existing.count++;
        existing.total += d.total;
        existing.last = d.total;
      } else {
        map.set(d.toolName, { count: 1, total: d.total, last: d.total });
      }
    }
    const result: ToolSummary[] = [];
    map.forEach(function (v, name) {
      result.push({
        name,
        count: v.count,
        totalTokens: v.total,
        avgTokens: Math.round(v.total / v.count),
        lastDelta: v.last,
        baseline: null,
      });
    });
    result.sort(function (a, b) { return b.totalTokens - a.totalTokens; });
    return result;
  }, [session]);

  return (
    <section aria-label={"Historical session " + session.hookSessionId.slice(0, 12)}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to session overview"
        className={"flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors min-h-[44px] " + focusRing}
      >
        <ChevronLeft size={14} aria-hidden="true" />
        Back to overview
      </button>

      <div className="bg-base-200 rounded-lg px-4 py-3 mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={"!size-2.5 rounded-full flex-shrink-0 " + (session.active ? "bg-success motion-safe:animate-pulse" : "bg-base-content/15")}
            aria-hidden="true"
          />
          <span className="text-xs font-mono font-semibold text-base-content/70">{session.hookSessionId.slice(0, 12)}</span>
          {session.projectName && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/70">{session.projectName}</span>
          )}
          <span className="text-[10px] font-mono text-base-content/30">{session.modelName}</span>
          <span className={"text-[10px] font-mono px-1.5 py-0.5 rounded " + (session.active ? "bg-success/15 text-success" : "bg-base-content/5 text-base-content/30")}>
            {session.active ? "Active" : "Ended"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-mono">
          <InlineStat label="In" value={formatTokens(session.inputTokens)} colorClass="text-info" />
          <InlineStat label="Out" value={formatTokens(session.outputTokens)} colorClass="text-secondary" />
          <InlineStat label="Ctx" value={Math.round(session.usedPercent) + "%"} colorClass={contextColor(session.usedPercent)} sub={formatTokens(session.contextWindow) + " window"} />
          <InlineStat label="Cost" value={"$" + session.costUsd.toFixed(3)} colorClass="text-accent" />
          <span className="text-base-content/25">{formatDuration(Math.round(session.durationMs / 1000))} elapsed</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-base-content/25">
          <span>{dateStr} {timeStr}</span>
          {endStr && <span>ended {endStr}</span>}
          <span>{session.toolEventCount} tool calls</span>
          {session.anomalyCount > 0 && <span className="text-warning">{session.anomalyCount} anomalies</span>}
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {toolEvents.length > 0 && <ToolCostTimeline events={toolEvents} />}
        {deltaSummaries.length > 0 && <ToolBreakdownTable summaries={deltaSummaries} />}
        {toolEvents.length === 0 && deltaSummaries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity size={24} className="text-base-content/15 mb-2" aria-hidden="true" />
            <p className="text-xs text-base-content/40 font-mono">No detailed tool data stored for this session</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SessionHistoryList({ sessions, loading, filter, projectFilter, projects, onFilterChange, onProjectChange, onSelect, onRefresh }: {
  sessions: HistoricalSessionSummary[];
  loading: boolean;
  filter: "all" | "active" | "ended";
  projectFilter: string | null;
  projects: string[];
  onFilterChange: (f: "all" | "active" | "ended") => void;
  onProjectChange: (p: string | null) => void;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section aria-label="Session history" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <History size={13} className="text-info/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">Session History</h2>
        <span className="text-[10px] font-mono text-base-content/25 ml-auto">{sessions.length} sessions</span>
      </div>

      <div className="px-4 py-2 border-b border-base-content/5 flex items-center gap-2 flex-wrap">
        <Filter size={10} className="text-base-content/25" aria-hidden="true" />
        {(["all", "active", "ended"] as const).map(function (f) {
          return (
            <button
              key={f}
              type="button"
              onClick={function () { onFilterChange(f); }}
              className={"text-[11px] font-mono px-2 py-1 rounded transition-colors " + focusRing + " " + (filter === f ? "bg-base-content/10 text-base-content/70" : "text-base-content/30 hover:text-base-content/50")}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Ended"}
            </button>
          );
        })}
        {projects.length > 0 && (
          <>
            <span className="text-base-content/10">|</span>
            <button
              type="button"
              onClick={function () { onProjectChange(null); }}
              className={"text-[11px] font-mono px-2 py-1 rounded transition-colors " + focusRing + " " + (projectFilter === null ? "bg-primary/15 text-primary" : "text-base-content/30 hover:text-base-content/50")}
            >
              All projects
            </button>
            {projects.map(function (p) {
              return (
                <button
                  key={p}
                  type="button"
                  onClick={function () { onProjectChange(projectFilter === p ? null : p); }}
                  className={"text-[11px] font-mono px-2 py-1 rounded transition-colors " + focusRing + " " + (projectFilter === p ? "bg-primary/15 text-primary" : "text-base-content/30 hover:text-base-content/50")}
                >
                  {p}
                </button>
              );
            })}
          </>
        )}
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh session history"
          className={"text-[10px] font-mono text-primary/60 hover:text-primary transition-colors ml-auto min-h-[44px] px-2 " + focusRing}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="px-4 py-6 flex items-center justify-center">
          <span className="text-[11px] font-mono text-base-content/30 animate-pulse">Loading sessions...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-8 flex flex-col items-center text-center">
          <History size={20} className="text-base-content/15 mb-2" aria-hidden="true" />
          <p className="text-xs text-base-content/40 font-mono">No sessions match the current filters</p>
        </div>
      ) : (
        <div className="divide-y divide-base-content/5 max-h-96 overflow-y-auto" role="list">
          {sessions.map(function (s) {
            const time = new Date(s.timestamp);
            const dateStr = time.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            return (
              <button
                key={s.hookSessionId}
                type="button"
                role="listitem"
                onClick={function () { onSelect(s.hookSessionId); }}
                aria-label={"View historical session " + s.hookSessionId.slice(0, 12) + ", " + (s.active ? "active" : "ended") + ", " + (s.projectName || "unknown project")}
                className={"flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-base-content/3 transition-colors min-h-[44px] " + focusRing}
              >
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div
                    className={"!size-2.5 rounded-full " + (s.active ? "bg-success motion-safe:animate-pulse" : "bg-base-content/15")}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-base-content/70 font-semibold truncate">{s.hookSessionId.slice(0, 12)}</span>
                    {s.projectName && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/70">{s.projectName}</span>
                    )}
                    <span className="text-[10px] font-mono text-base-content/30">{s.modelName}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-base-content/40">
                    <span>{formatTokens(s.inputTokens + s.outputTokens)} tokens</span>
                    <span className={contextColor(s.usedPercent)}>{Math.round(s.usedPercent)}% ctx</span>
                    <span>${s.costUsd.toFixed(3)}</span>
                    {s.toolEventCount > 0 && <span>{s.toolEventCount} tools</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <span className="text-[10px] font-mono text-base-content/30 tabular-nums">{dateStr}</span>
                  <span className="text-[10px] font-mono text-base-content/25 tabular-nums block">{timeStr}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AnomalyHistory({ anomalies }: { anomalies: AnomalyEntry[] }) {
  const sorted = useMemo(function () {
    return [...anomalies].sort(function (a, b) { return b.timestamp - a.timestamp; });
  }, [anomalies]);

  return (
    <section aria-label="Anomaly history" className="bg-base-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-base-content/10 flex items-center gap-2">
        <TrendingUp size={13} className="text-warning/50" aria-hidden="true" />
        <h2 className="text-xs font-mono font-bold text-base-content/60 uppercase tracking-wider">Anomaly History</h2>
      </div>
      <div className="divide-y divide-base-content/5" role="list">
        {sorted.map(function (a, i) {
          const time = new Date(a.timestamp);
          const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          return (
            <div key={a.toolId + "-" + a.timestamp + "-" + i} role="listitem" className={"flex items-center gap-3 px-4 py-2.5 " + (a.dismissed ? "opacity-40" : "")}>
              <AlertTriangle size={12} className="text-warning flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-base-content/70">
                  <span className="font-semibold">{a.toolName}</span>
                  <span className="text-base-content/40 ml-2">{formatTokens(a.observed)} tokens</span>
                  <span className="text-base-content/25 ml-1 hidden sm:inline">(expected ~{formatTokens(a.expected)})</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-warning/70 tabular-nums" title={"Z-score: how many standard deviations from the mean. Higher = more unusual. This call used " + formatTokens(a.observed) + " tokens vs expected " + formatTokens(a.expected)}>z={a.zScore.toFixed(1)}</span>
              <span className="text-[10px] font-mono text-base-content/25 tabular-nums hidden sm:inline">{timeStr}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
