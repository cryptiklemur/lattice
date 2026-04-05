import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartFullscreen } from "../ChartCard";
import { getChartColors, getTickStyle } from "../chartTokens";

interface ContextUtilDatum {
  messageIndex: number;
  contextPercent: number;
  sessionId: string;
  title: string;
}

interface ContextUtilizationChartProps {
  data: ContextUtilDatum[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      {payload.map(function (entry) {
        return (
          <div key={entry.name} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-base-content/60 truncate max-w-[120px]">{entry.name}</span>
            <span className="text-base-content ml-auto pl-4">{entry.value.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export function ContextUtilizationChart({ data }: ContextUtilizationChartProps) {
  var fullscreenHeight = useChartFullscreen();
  var colors = getChartColors();

  var { sessions, merged } = useMemo(function () {
    var sessionMap = new Map<string, { title: string; points: Array<{ messageIndex: number; contextPercent: number }> }>();
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var entry = sessionMap.get(d.sessionId);
      if (!entry) {
        entry = { title: d.title, points: [] };
        sessionMap.set(d.sessionId, entry);
      }
      entry.points.push({ messageIndex: d.messageIndex, contextPercent: d.contextPercent });
    }

    var sessions = Array.from(sessionMap.entries()).slice(0, 5);

    var maxIndex = 0;
    for (var si = 0; si < sessions.length; si++) {
      var pts = sessions[si][1].points;
      for (var pi = 0; pi < pts.length; pi++) {
        if (pts[pi].messageIndex > maxIndex) maxIndex = pts[pi].messageIndex;
      }
    }

    var merged: Array<Record<string, number>> = [];
    for (var mi = 0; mi <= maxIndex; mi++) {
      var row: Record<string, number> = { messageIndex: mi };
      for (var sj = 0; sj < sessions.length; sj++) {
        var point = sessions[sj][1].points.find(function (p) { return p.messageIndex === mi; });
        if (point) row[sessions[sj][0]] = point.contextPercent;
      }
      merged.push(row);
    }

    return { sessions, merged };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <LineChart data={merged} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} vertical={false} />
        <XAxis dataKey="messageIndex" tick={getTickStyle()} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={getTickStyle()} axisLine={false} tickLine={false} tickFormatter={function (v) { return v + "%"; }} />
        <Tooltip content={<CustomTooltip />} />
        {sessions.map(function (s, idx) {
          return (
            <Line
              key={s[0]}
              type="monotone"
              dataKey={s[0]}
              name={s[1].title.slice(0, 30)}
              stroke={colors.palette[idx % colors.palette.length]}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
