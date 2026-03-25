import { LineChart, Line, ResponsiveContainer } from "recharts";
import { useAnalytics } from "../../hooks/useAnalytics";
import { getChartColors } from "./chartTokens";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "k";
  return String(n);
}

interface SparklineProps {
  data: Array<{ v: number }>;
  stroke: string;
}

function Sparkline({ data, stroke }: SparklineProps) {
  return (
    <ResponsiveContainer width={60} height={20}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function QuickStats() {
  const analytics = useAnalytics();

  if (!analytics.data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(function (i) {
          return (
            <div key={i} className="bg-base-content/[0.03] border border-base-content/8 rounded-xl p-3.5 animate-pulse">
              <div className="h-2.5 w-16 bg-base-content/10 rounded mb-3" />
              <div className="h-6 w-12 bg-base-content/10 rounded" />
            </div>
          );
        })}
      </div>
    );
  }

  const d = analytics.data;
  const colors = getChartColors();

  const costSparkData = d.costOverTime.slice(-7).map(function (e: typeof d.costOverTime[number]) { return { v: e.total }; });
  const sessionsSparkData = d.sessionsOverTime.slice(-7).map(function (e: typeof d.sessionsOverTime[number]) { return { v: e.count }; });
  const tokensSparkData = d.tokensOverTime.slice(-7).map(function (e: typeof d.tokensOverTime[number]) { return { v: e.input + e.output }; });

  const totalTokens = d.totalTokens.input + d.totalTokens.output;
  const cacheHitPct = Math.round(d.cacheHitRate * 100);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-base-content/[0.03] border border-base-content/8 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40">Total Spend</span>
          {costSparkData.length > 1 && (
            <div role="img" aria-label={"Cost trend: " + (costSparkData[costSparkData.length - 1].v > costSparkData[0].v ? "increasing" : costSparkData[costSparkData.length - 1].v < costSparkData[0].v ? "decreasing" : "stable")}>
              <Sparkline data={costSparkData} stroke={colors.primary} />
            </div>
          )}
        </div>
        <div className="text-[20px] font-mono text-base-content">${d.totalCost.toFixed(2)}</div>
      </div>

      <div className="bg-base-content/[0.03] border border-base-content/8 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40">Sessions</span>
          {sessionsSparkData.length > 1 && (
            <div role="img" aria-label={"Sessions trend: " + (sessionsSparkData[sessionsSparkData.length - 1].v > sessionsSparkData[0].v ? "increasing" : sessionsSparkData[sessionsSparkData.length - 1].v < sessionsSparkData[0].v ? "decreasing" : "stable")}>
              <Sparkline data={sessionsSparkData} stroke={colors.success} />
            </div>
          )}
        </div>
        <div className="text-[20px] font-mono text-base-content">{d.totalSessions}</div>
      </div>

      <div className="bg-base-content/[0.03] border border-base-content/8 rounded-xl p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40">Total Tokens</span>
          {tokensSparkData.length > 1 && (
            <div role="img" aria-label={"Tokens trend: " + (tokensSparkData[tokensSparkData.length - 1].v > tokensSparkData[0].v ? "increasing" : tokensSparkData[tokensSparkData.length - 1].v < tokensSparkData[0].v ? "decreasing" : "stable")}>
              <Sparkline data={tokensSparkData} stroke={colors.warning} />
            </div>
          )}
        </div>
        <div className="text-[20px] font-mono text-base-content">{formatTokens(totalTokens)}</div>
      </div>

      <div className="bg-base-content/[0.03] border border-base-content/8 rounded-xl p-3.5">
        <div className="mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40">Cache Rate</span>
        </div>
        <div className="text-[20px] font-mono text-base-content mb-2">{cacheHitPct}%</div>
        <div
          className="w-full h-1 rounded-full bg-base-content/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={cacheHitPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Cache hit rate"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: cacheHitPct + "%" }}
          />
        </div>
      </div>
    </div>
  );
}
