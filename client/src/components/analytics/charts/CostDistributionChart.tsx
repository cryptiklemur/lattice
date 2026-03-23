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

interface DistributionDatum {
  bucket: string;
  count: number;
}

interface CostDistributionChartProps {
  data: DistributionDatum[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{label}</p>
      <p className="text-[11px] font-mono text-base-content">{payload[0].value} sessions</p>
    </div>
  );
}

export function CostDistributionChart({ data }: CostDistributionChartProps) {
  var fullscreenHeight = useChartFullscreen();
  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(55% 0.25 280)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="oklch(55% 0.25 280)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="bucket" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="oklch(55% 0.25 280)"
          fill="url(#distGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
