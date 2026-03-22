import { useAnalytics } from "../../hooks/useAnalytics";
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
              <TokenFlowChart data={analytics.data.tokensOverTime} />
            </ChartCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Cache Efficiency">
                <CacheEfficiencyChart data={analytics.data.cacheHitRateOverTime} />
              </ChartCard>
              <ChartCard title="Response Time vs Tokens">
                <ResponseTimeScatter data={analytics.data.responseTimeData} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChartCard title="Context Window Usage">
                <ContextUtilizationChart data={analytics.data.contextUtilization} />
              </ChartCard>
              <ChartCard title="Token Flow (Sankey)">
                <TokenSankeyChart data={analytics.data.tokenFlowSankey} />
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
