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

interface CumulativeDatum {
  date: string;
  total: number;
}

interface CumulativeCostChartProps {
  data: CumulativeDatum[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{label}</p>
      <p className="text-[11px] font-mono text-base-content">${payload[0].value.toFixed(4)}</p>
    </div>
  );
}

export function CumulativeCostChart({ data }: CumulativeCostChartProps) {
  const fullscreenHeight = useChartFullscreen();
  const colors = getChartColors();
  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.7} />
            <stop offset="95%" stopColor={colors.primary} stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={getTickStyle()} axisLine={false} tickLine={false} />
        <YAxis tick={getTickStyle()} axisLine={false} tickLine={false} tickFormatter={function (v) { return "$" + v.toFixed(2); }} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke={colors.primary}
          fill="url(#cumulativeGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
