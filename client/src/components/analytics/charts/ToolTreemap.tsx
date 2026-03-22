import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

interface ToolTreemapProps {
  data: Array<{ name: string; count: number; avgCost: number }>;
}

var MAX_COST_INTENSITY = 0.5;

function getColor(avgCost: number, maxCost: number): string {
  var intensity = maxCost > 0 ? Math.min(avgCost / maxCost, 1) : 0.3;
  var lightness = 0.45 - intensity * 0.15;
  var chroma = 0.15 + intensity * 0.12;
  return "oklch(" + lightness + " " + chroma + " 280)";
}

function CustomContent(props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; count?: number; avgCost?: number;
  maxCost?: number;
}) {
  var { x = 0, y = 0, width = 0, height = 0, name = "", count = 0, avgCost = 0, maxCost = MAX_COST_INTENSITY } = props;
  if (width < 4 || height < 4) return null;
  var showLabel = width > 40 && height > 20;
  var showCount = width > 50 && height > 34;
  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        rx={3}
        fill={getColor(avgCost, maxCost)}
        fillOpacity={0.85}
        stroke="oklch(0.2 0.02 280)"
        strokeWidth={1}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showCount ? -5 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "oklch(0.95 0.02 280 / 0.9)" }}
        >
          {name}
        </text>
      )}
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: "oklch(0.95 0.02 280 / 0.5)" }}
        >
          {count}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number; avgCost: number } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  var d = payload[0].payload;
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[11px] font-mono text-base-content font-bold mb-1">{d.name}</p>
      <div className="text-[10px] font-mono text-base-content/60 space-y-0.5">
        <p><span className="text-base-content/40">calls </span>{d.count.toLocaleString()}</p>
        <p><span className="text-base-content/40">avg cost </span>${d.avgCost.toFixed(4)}</p>
      </div>
    </div>
  );
}

export function ToolTreemap({ data }: ToolTreemapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-base-content/25 font-mono text-[11px]">
        No tool data
      </div>
    );
  }

  var maxCost = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i].avgCost > maxCost) maxCost = data[i].avgCost;
  }

  var treemapData = data.map(function (d) {
    return { name: d.name, size: d.count, count: d.count, avgCost: d.avgCost, maxCost: maxCost };
  });

  return (
    <ResponsiveContainer width="100%" height={250}>
      <Treemap
        data={treemapData}
        dataKey="size"
        aspectRatio={4 / 3}
        content={<CustomContent maxCost={maxCost} />}
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
