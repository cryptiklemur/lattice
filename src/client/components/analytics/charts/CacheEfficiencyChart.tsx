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

interface CacheEfficiencyDatum {
  date: string;
  rate: number;
}

interface CacheEfficiencyChartProps {
  data: CacheEfficiencyDatum[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{label}</p>
      <p className="text-[11px] font-mono text-base-content">{(payload[0].value * 100).toFixed(1)}%</p>
    </div>
  );
}

export function CacheEfficiencyChart({ data }: CacheEfficiencyChartProps) {
  const fullscreenHeight = useChartFullscreen();
  const colors = getChartColors();
  const displayData = data.map(function (d) {
    return { date: d.date, rate: d.rate * 100 };
  });

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="cacheEffGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.success} stopOpacity={0.8} />
            <stop offset="95%" stopColor={colors.success} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={getTickStyle()} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={getTickStyle()} axisLine={false} tickLine={false} tickFormatter={function (v) { return v + "%"; }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="rate" stroke={colors.success} fill="url(#cacheEffGrad)" strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
