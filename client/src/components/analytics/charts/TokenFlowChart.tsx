import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartFullscreen } from "../ChartCard";
import { getChartColors, getTickStyle } from "../chartTokens";

interface TokenFlowDatum {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
}

interface TokenFlowChartProps {
  data: TokenFlowDatum[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{label}</p>
      {payload.map(function (entry) {
        return (
          <div key={entry.name} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-base-content/60 capitalize">{entry.name}</span>
            <span className="text-base-content ml-auto pl-4">{entry.value.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatTokens(v: number): string {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(0) + "k";
  return String(v);
}

export function TokenFlowChart({ data }: TokenFlowChartProps) {
  var fullscreenHeight = useChartFullscreen();
  var colors = getChartColors();
  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.primary} stopOpacity={0.25} />
          </linearGradient>
          <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.success} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.success} stopOpacity={0.25} />
          </linearGradient>
          <linearGradient id="cacheReadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.warning} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.warning} stopOpacity={0.25} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={getTickStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={getTickStyle()} axisLine={false} tickLine={false} tickFormatter={formatTokens} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="input" stackId="1" stroke={colors.primary} fill="url(#inputGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="output" stackId="1" stroke={colors.success} fill="url(#outputGrad)" strokeWidth={2} />
        <Area type="monotone" dataKey="cacheRead" stackId="1" stroke={colors.warning} fill="url(#cacheReadGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
