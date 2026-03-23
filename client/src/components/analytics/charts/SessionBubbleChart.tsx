import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";
import { useChartFullscreen } from "../ChartCard";

var TICK_STYLE = {
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  fill: "oklch(0.9 0.02 280 / 0.3)",
};

var GRID_COLOR = "oklch(0.9 0.02 280 / 0.06)";

var PROJECT_PALETTE = [
  "oklch(55% 0.25 280)",
  "#a855f7",
  "#22c55e",
  "#f59e0b",
  "oklch(65% 0.2 240)",
  "oklch(65% 0.25 25)",
  "oklch(65% 0.25 150)",
  "oklch(70% 0.2 60)",
];

interface SessionBubbleDatum {
  id: string;
  title: string;
  cost: number;
  tokens: number;
  timestamp: number;
  project: string;
}

interface SessionBubbleChartProps {
  data: SessionBubbleDatum[];
}

function formatDate(ts: number): string {
  var d = new Date(ts);
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SessionBubbleDatum }> }) {
  if (!active || !payload || payload.length === 0) return null;
  var d = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg max-w-[180px]">
      <p className="text-[10px] font-mono text-base-content/50 mb-1 truncate">{d.title || d.id}</p>
      <div className="text-[11px] font-mono text-base-content/70 space-y-0.5">
        <p><span className="text-base-content/40">cost </span>${d.cost.toFixed(4)}</p>
        <p><span className="text-base-content/40">tokens </span>{d.tokens.toLocaleString()}</p>
        <p><span className="text-base-content/40">project </span>{d.project}</p>
      </div>
    </div>
  );
}

export function SessionBubbleChart({ data }: SessionBubbleChartProps) {
  var fullscreenHeight = useChartFullscreen();
  var projects = Array.from(new Set(data.map(function (d) { return d.project; })));

  function getColor(project: string): string {
    var idx = projects.indexOf(project);
    return PROJECT_PALETTE[idx % PROJECT_PALETTE.length];
  }

  var byProject = projects.map(function (project) {
    return {
      project,
      color: getColor(project),
      points: data
        .filter(function (d) { return d.project === project; })
        .map(function (d) { return { ...d, x: d.timestamp, y: d.tokens, z: Math.max(d.cost * 1000, 20) }; }),
    };
  });

  var minTs = Math.min(...data.map(function (d) { return d.timestamp; }));
  var maxTs = Math.max(...data.map(function (d) { return d.timestamp; }));

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <ScatterChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
        <XAxis
          dataKey="x"
          type="number"
          domain={[minTs, maxTs]}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return formatDate(v); }}
        />
        <YAxis
          dataKey="y"
          type="number"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v); }}
        />
        <ZAxis dataKey="z" range={[20, 300]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: GRID_COLOR }} />
        {byProject.map(function (group) {
          return (
            <Scatter
              key={group.project}
              name={group.project}
              data={group.points}
              fill={group.color}
              fillOpacity={0.7}
            />
          );
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
