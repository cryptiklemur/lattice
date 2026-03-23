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
import { getChartColors, getTickStyle } from "../chartTokens";

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
  var colors = getChartColors();
  var projects = Array.from(new Set(data.map(function (d) { return d.project; })));

  function getColor(project: string): string {
    var idx = projects.indexOf(project);
    return colors.palette[idx % colors.palette.length];
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
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
        <XAxis
          dataKey="x"
          type="number"
          domain={[minTs, maxTs]}
          tick={getTickStyle()}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return formatDate(v); }}
        />
        <YAxis
          dataKey="y"
          type="number"
          tick={getTickStyle()}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v); }}
        />
        <ZAxis dataKey="z" range={[20, 300]} />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: colors.gridStroke }} />
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
