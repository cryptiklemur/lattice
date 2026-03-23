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

var TICK_STYLE = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fill: "oklch(0.9 0.02 280 / 0.3)",
};

var GRID_COLOR = "oklch(0.9 0.02 280 / 0.06)";

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
  var fullscreenHeight = useChartFullscreen();
  var displayData = data.map(function (d) {
    return { date: d.date, rate: d.rate * 100 };
  });

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cacheEffGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={function (v) { return v + "%"; }} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="rate" stroke="#22c55e" fill="url(#cacheEffGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
