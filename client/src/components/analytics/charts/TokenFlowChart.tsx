import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

var TICK_STYLE = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fill: "oklch(0.9 0.02 280 / 0.3)",
};

var GRID_COLOR = "oklch(0.9 0.02 280 / 0.06)";

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
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(55% 0.25 280)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="oklch(55% 0.25 280)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="cacheReadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={formatTokens} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="input" stackId="1" stroke="oklch(55% 0.25 280)" fill="url(#inputGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="output" stackId="1" stroke="#22c55e" fill="url(#outputGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="cacheRead" stackId="1" stroke="#f59e0b" fill="url(#cacheReadGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
