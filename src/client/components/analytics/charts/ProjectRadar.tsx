import { useMemo } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getChartColors } from "../chartTokens";

interface ProjectRadarProps {
  data: Array<{ project: string; cost: number; sessions: number; avgDuration: number; toolDiversity: number; tokensPerSession: number }>;
}

var AXIS_KEYS = ["cost", "sessions", "avgDuration", "toolDiversity", "tokensPerSession"] as const;
var AXIS_LABELS: Record<string, string> = {
  cost: "Cost",
  sessions: "Sessions",
  avgDuration: "Duration",
  toolDiversity: "Tool Diversity",
  tokensPerSession: "Tokens/Session",
};

function normalize(values: number[]): number[] {
  var max = 0;
  for (var i = 0; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  if (max === 0) return values.map(function () { return 0; });
  return values.map(function (v) { return Math.round((v / max) * 100); });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{label}</p>
      {payload.map(function (entry) {
        return (
          <p key={entry.name} className="text-[10px] font-mono text-base-content/70">
            <span style={{ color: entry.color }}>{entry.name}</span>: {entry.value}
          </p>
        );
      })}
    </div>
  );
}

export function ProjectRadar({ data }: ProjectRadarProps) {
  var colors = getChartColors();

  var { projects, radarData } = useMemo(function () {
    var projects = data.slice(0, 5);
    var normalized = new Map<string, Map<string, number>>();
    for (var ai = 0; ai < AXIS_KEYS.length; ai++) {
      var key = AXIS_KEYS[ai];
      var rawValues = projects.map(function (p) { return p[key] as number; });
      var normValues = normalize(rawValues);
      for (var pi = 0; pi < projects.length; pi++) {
        var projMap = normalized.get(projects[pi].project);
        if (!projMap) {
          projMap = new Map();
          normalized.set(projects[pi].project, projMap);
        }
        projMap.set(key, normValues[pi]);
      }
    }
    var radarData = AXIS_KEYS.map(function (key) {
      var entry: Record<string, string | number> = { axis: AXIS_LABELS[key] };
      for (var pi = 0; pi < projects.length; pi++) {
        var projMap = normalized.get(projects[pi].project);
        entry[projects[pi].project] = projMap ? projMap.get(key) || 0 : 0;
      }
      return entry;
    });
    return { projects, radarData };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-base-content/25 font-mono text-[11px]">
        No project data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke={colors.gridStroke} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: colors.tickFill }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        {projects.map(function (project, index) {
          return (
            <Radar
              key={project.project}
              name={project.project}
              dataKey={project.project}
              stroke={colors.palette[index % colors.palette.length]}
              fill={colors.palette[index % colors.palette.length]}
              fillOpacity={0.1}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          );
        })}
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          iconSize={8}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
