import { Component } from "react";
import { BarChart3 } from "lucide-react";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useMesh } from "../../hooks/useMesh";

class ChartErrorBoundary extends Component<{ children: React.ReactNode; name: string }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-[200px] text-base-content/25 font-mono text-[11px]">
          Chart error: {this.props.name}
        </div>
      );
    }
    return this.props.children;
  }
}

function SectionHeader(props: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="h-px flex-1 bg-base-content/6" />
      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-base-content/20">{props.label}</span>
      <div className="h-px flex-1 bg-base-content/6" />
    </div>
  );
}

import { PeriodSelector } from "./PeriodSelector";
import { ChartCard } from "./ChartCard";
import { QuickStats } from "./QuickStats";
import { CostAreaChart } from "./charts/CostAreaChart";
import { CumulativeCostChart } from "./charts/CumulativeCostChart";
import { CostDonutChart } from "./charts/CostDonutChart";
import { CostDistributionChart } from "./charts/CostDistributionChart";
import { SessionBubbleChart } from "./charts/SessionBubbleChart";
import { TokenFlowChart } from "./charts/TokenFlowChart";
import { CacheEfficiencyChart } from "./charts/CacheEfficiencyChart";
import { ResponseTimeScatter } from "./charts/ResponseTimeScatter";
import { ContextUtilizationChart } from "./charts/ContextUtilizationChart";
import { TokenSankeyChart } from "./charts/TokenSankeyChart";
import { ActivityCalendar } from "./charts/ActivityCalendar";
import { HourlyHeatmap } from "./charts/HourlyHeatmap";
import { SessionTimeline } from "./charts/SessionTimeline";
import { DailySummaryCards } from "./charts/DailySummaryCards";
import { ProjectRadar } from "./charts/ProjectRadar";
import { SessionComplexityList } from "./charts/SessionComplexityList";
import { NodeFleetOverview } from "./charts/NodeFleetOverview";

export function AnalyticsView() {
  var analytics = useAnalytics();
  var mesh = useMesh();
  var nodes = mesh.nodes;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base-100 bg-lattice-grid">
      <div className="flex items-center justify-between px-2 sm:px-4 min-h-10 sm:min-h-12 border-b border-base-300 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-mono font-semibold text-base-content">Analytics</h1>
          {analytics.loading && analytics.data && (
            <span className="w-3.5 h-3.5 border-2 border-base-content/15 border-t-primary/60 rounded-full animate-spin" />
          )}
        </div>
        <PeriodSelector value={analytics.period} onChange={analytics.setPeriod} />
      </div>

      <div className={"flex-1 overflow-y-auto px-6 py-4 transition-opacity duration-200 " + (analytics.loading && analytics.data ? "opacity-50" : "opacity-100")}>
        {analytics.loading && !analytics.data && (
          <div className="flex flex-col gap-4 max-w-[1200px] mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(function (i) {
                return <div key={i} className="h-24 rounded-xl bg-base-content/[0.03] animate-pulse" />;
              })}
            </div>
            <div className="h-[240px] rounded-xl bg-base-content/[0.03] animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-[240px] rounded-xl bg-base-content/[0.03] animate-pulse" />
              <div className="h-[240px] rounded-xl bg-base-content/[0.03] animate-pulse" />
            </div>
          </div>
        )}

        {analytics.error && (
          <div className="text-center text-error/60 py-20 font-mono text-[13px]">{analytics.error}</div>
        )}

        {analytics.data && (
          <div className="flex flex-col gap-4 max-w-[1200px] mx-auto pb-8">
            <QuickStats />

            <SectionHeader label="Cost" />

            <ChartCard title="Cost Over Time">
              <CostAreaChart data={analytics.data.costOverTime} />
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Cost Breakdown">
                <CostDonutChart modelUsage={analytics.data.modelUsage} totalCost={analytics.data.totalCost} />
              </ChartCard>
              <ChartCard title="Cumulative Cost">
                <CumulativeCostChart data={analytics.data.cumulativeCost} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Cost Distribution">
                <CostDistributionChart data={analytics.data.costDistribution} />
              </ChartCard>
              <ChartCard title="Session Costs">
                <SessionBubbleChart data={analytics.data.sessionBubbles} />
              </ChartCard>
            </div>

            <SectionHeader label="Tokens & Performance" />

            <ChartCard title="Token Flow">
              <ChartErrorBoundary name="TokenFlow">
                <TokenFlowChart data={analytics.data.tokensOverTime} />
              </ChartErrorBoundary>
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Cache Efficiency">
                <ChartErrorBoundary name="CacheEfficiency">
                  <CacheEfficiencyChart data={analytics.data.cacheHitRateOverTime} />
                </ChartErrorBoundary>
              </ChartCard>
              <ChartCard title="Response Time vs Tokens">
                <ChartErrorBoundary name="ResponseTime">
                  <ResponseTimeScatter data={analytics.data.responseTimeData} />
                </ChartErrorBoundary>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Context Window Usage">
                <ChartErrorBoundary name="ContextUtilization">
                  <ContextUtilizationChart data={analytics.data.contextUtilization} />
                </ChartErrorBoundary>
              </ChartCard>
              <ChartCard title="Token Flow (Sankey)">
                <ChartErrorBoundary name="Sankey">
                  <TokenSankeyChart data={analytics.data.tokenFlowSankey} />
                </ChartErrorBoundary>
              </ChartCard>
            </div>

            <SectionHeader label="Activity" />

            <ChartCard title="Activity Calendar">
              <ChartErrorBoundary name="Calendar">
                <ActivityCalendar data={analytics.data.activityCalendar} />
              </ChartErrorBoundary>
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Hourly Activity">
                <ChartErrorBoundary name="HourlyHeatmap">
                  <HourlyHeatmap data={analytics.data.hourlyHeatmap} />
                </ChartErrorBoundary>
              </ChartCard>
              <ChartCard title="Session Timeline">
                <ChartErrorBoundary name="Timeline">
                  <SessionTimeline data={analytics.data.sessionTimeline} />
                </ChartErrorBoundary>
              </ChartCard>
            </div>

            <ChartCard title="Daily Summary">
              <ChartErrorBoundary name="DailySummary">
                <DailySummaryCards data={analytics.data.dailySummaries} />
              </ChartErrorBoundary>
            </ChartCard>

            <SectionHeader label="Projects" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Project Comparison">
                <ChartErrorBoundary name="Radar">
                  <ProjectRadar data={analytics.data.projectRadar} />
                </ChartErrorBoundary>
              </ChartCard>
            </div>

            <ChartCard title="Session Complexity">
              <ChartErrorBoundary name="Complexity">
                <SessionComplexityList data={analytics.data.sessionComplexity} />
              </ChartErrorBoundary>
            </ChartCard>

            <SectionHeader label="Fleet" />

            <ChartCard title="Node Fleet">
              <ChartErrorBoundary name="Fleet">
                <NodeFleetOverview nodes={nodes} />
              </ChartErrorBoundary>
            </ChartCard>
          </div>
        )}

        {!analytics.loading && !analytics.error && !analytics.data && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <BarChart3 size={40} className="text-base-content/10" />
            <div className="text-center">
              <p className="text-[14px] font-mono text-base-content/40">No analytics data yet</p>
              <p className="text-[12px] text-base-content/25 mt-1">Start a Claude session to begin tracking usage</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
