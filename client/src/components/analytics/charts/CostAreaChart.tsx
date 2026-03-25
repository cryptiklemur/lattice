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

interface CostAreaDatum {
  date: string;
  total: number;
  opus: number;
  sonnet: number;
  haiku: number;
  other: number;
}

interface CostAreaChartProps {
  data: CostAreaDatum[];
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
            <span className="text-base-content ml-auto pl-4">${entry.value.toFixed(4)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CostAreaChart({ data }: CostAreaChartProps) {
  constfullscreenHeight = useChartFullscreen();
  constcolors = getChartColors();
  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="opusGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.secondary} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.secondary} stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="sonnetGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.primary} stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="haikuGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.success} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.success} stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="otherGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.warning} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.warning} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={getTickStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={getTickStyle()} axisLine={false} tickLine={false} tickFormatter={function (v) { return "$" + v.toFixed(2); }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="opus" stackId="1" stroke={colors.secondary} fill="url(#opusGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="sonnet" stackId="1" stroke={colors.primary} fill="url(#sonnetGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="haiku" stackId="1" stroke={colors.success} fill="url(#haikuGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="other" stackId="1" stroke={colors.warning} fill="url(#otherGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
