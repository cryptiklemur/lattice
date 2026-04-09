import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartFullscreen } from "../ChartCard";
import { getChartColors, getTickStyle, getModelColor } from "../chartTokens";

interface ResponseTimeDatum {
  tokens: number;
  duration: number;
  model: string;
  sessionId: string;
}

interface ResponseTimeScatterProps {
  data: ResponseTimeDatum[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { tokens: number; durationSec: number; model: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <div className="text-[11px] font-mono text-base-content/70 space-y-0.5">
        <p><span className="text-base-content/40">tokens </span>{d.tokens.toLocaleString()}</p>
        <p><span className="text-base-content/40">duration </span>{d.durationSec.toFixed(1)}s</p>
        <p><span className="text-base-content/40">model </span>{d.model}</p>
      </div>
    </div>
  );
}

export function ResponseTimeScatter({ data }: ResponseTimeScatterProps) {
  const fullscreenHeight = useChartFullscreen();
  const colors = getChartColors();

  const byModel = useMemo(function () {
    const modelSet = new Set<string>();
    for (let i = 0; i < data.length; i++) modelSet.add(data[i].model);
    const models = Array.from(modelSet);
    return models.map(function (model) {
      return {
        model,
        color: getModelColor(model),
        points: data
          .filter(function (d) { return d.model === model; })
          .map(function (d) { return { tokens: d.tokens, durationSec: d.duration / 1000, model: d.model }; }),
      };
    });
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
      <ScatterChart margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.gridStroke} />
        <XAxis
          dataKey="tokens"
          type="number"
          tick={getTickStyle()}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v); }}
          name="tokens"
        />
        <YAxis
          dataKey="durationSec"
          type="number"
          tick={getTickStyle()}
          axisLine={false}
          tickLine={false}
          tickFormatter={function (v) { return v.toFixed(0) + "s"; }}
          name="duration"
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: colors.gridStroke }} />
        {byModel.map(function (group) {
          return (
            <Scatter
              key={group.model}
              name={group.model}
              data={group.points}
              fill={group.color}
              fillOpacity={0.7}
              isAnimationActive={false}
            />
          );
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
