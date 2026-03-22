import { Component } from "react";
import { useAnalytics } from "../../hooks/useAnalytics";

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
import { PeriodSelector } from "./PeriodSelector";
import { ChartCard } from "./ChartCard";
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

export function AnalyticsView() {
  var analytics = useAnalytics();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-base-100 bg-lattice-grid">
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 flex-shrink-0">
        <h1 className="text-[16px] font-mono font-bold text-base-content">Analytics</h1>
        <PeriodSelector value={analytics.period} onChange={analytics.setPeriod} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {analytics.loading && !analytics.data && (
          <div className="text-center text-base-content/30 py-20 font-mono text-[13px]">Loading analytics...</div>
        )}

        {analytics.error && (
          <div className="text-center text-error/60 py-20 font-mono text-[13px]">{analytics.error}</div>
        )}

        {analytics.data && (
          <div className="flex flex-col gap-4 max-w-[1200px] mx-auto pb-8">
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
          </div>
        )}

        {!analytics.loading && !analytics.error && !analytics.data && (
          <div className="text-center text-base-content/30 py-20 font-mono text-[13px]">No analytics data yet</div>
        )}
      </div>
    </div>
  );
}
