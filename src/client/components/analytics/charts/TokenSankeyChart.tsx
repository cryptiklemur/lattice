import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import { useChartFullscreen } from "../ChartCard";
import { getChartColors } from "../chartTokens";

interface SankeyData {
  nodes: Array<{ name: string }>;
  links: Array<{ source: number; target: number; value: number }>;
}

interface TokenSankeyChartProps {
  data: SankeyData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { source?: { name: string }; target?: { name: string }; value?: number; name?: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (d.source && d.target) {
    return (
      <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
        <p className="text-[11px] font-mono text-base-content">
          {d.source.name} → {d.target.name}: {(d.value || 0).toLocaleString()}
        </p>
      </div>
    );
  }
  if (d.name) {
    return (
      <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
        <p className="text-[11px] font-mono text-base-content">{d.name}</p>
      </div>
    );
  }
  return null;
}

function SankeyNode({ x, y, width, height, index, payload }: { x: number; y: number; width: number; height: number; index: number; payload: { name: string } }) {
  const colors = getChartColors();
  const NODE_COLORS: Record<string, string> = {
    "Input Tokens": colors.primary,
    "Cache Read": colors.warning,
    "Cache Creation": colors.accent,
    "Opus": colors.secondary,
    "Sonnet": colors.primary,
    "Haiku": colors.success,
    "Other": colors.warning,
    "Output Tokens": colors.success,
  };
  const color = NODE_COLORS[payload.name] || colors.primary;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} rx={2} />
      {height > 14 && (
        <text
          x={x + width + 6}
          y={y + height / 2}
          dy={4}
          fill={colors.tickFill}
          fontSize={9}
          fontFamily="var(--font-mono)"
        >
          {payload.name}
        </text>
      )}
    </g>
  );
}

export function TokenSankeyChart({ data }: TokenSankeyChartProps) {
  const fullscreenHeight = useChartFullscreen();
  const colors = getChartColors();
  if (!data.links || data.links.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-base-content/30 font-mono text-[12px]">
        No token flow data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={fullscreenHeight || 250}>
      <Sankey
        data={data}
        node={<SankeyNode x={0} y={0} width={0} height={0} index={0} payload={{ name: "" }} />}
        link={{ stroke: colors.gridStroke }}
        margin={{ top: 10, right: 100, left: 10, bottom: 10 }}
        nodeWidth={12}
        nodePadding={14}
      >
        <Tooltip content={<CustomTooltip />} />
      </Sankey>
    </ResponsiveContainer>
  );
}
