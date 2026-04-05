import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useChartFullscreen } from "../ChartCard";
import { getChartColors, getModelColor } from "../chartTokens";

interface ModelUsage {
  model: string;
  cost: number;
  percentage: number;
}

interface CostDonutChartProps {
  modelUsage: ModelUsage[];
  totalCost: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ModelUsage }> }) {
  if (!active || !payload || payload.length === 0) return null;
  var entry = payload[0];
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[10px] font-mono text-base-content/50 mb-1">{entry.name}</p>
      <p className="text-[11px] font-mono text-base-content">${entry.value.toFixed(4)}</p>
      <p className="text-[10px] font-mono text-base-content/50">{entry.payload.percentage.toFixed(1)}%</p>
    </div>
  );
}

function CenterLabel({ totalCost }: { totalCost: number }) {
  var colors = getChartColors();
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-0.4em" style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: colors.tickFill }}>
        TOTAL
      </tspan>
      <tspan x="50%" dy="1.4em" style={{ fontSize: 14, fontFamily: "var(--font-mono)", fill: colors.tickFill, fontWeight: 700 }}>
        ${totalCost.toFixed(2)}
      </tspan>
    </text>
  );
}

export function CostDonutChart({ modelUsage, totalCost }: CostDonutChartProps) {
  var fullscreenHeight = useChartFullscreen();
  var colors = getChartColors();
  return (
    <div>
      <ResponsiveContainer width="100%" height={fullscreenHeight || 200}>
        <PieChart>
          <Pie
            data={modelUsage}
            dataKey="cost"
            nameKey="model"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {modelUsage.map(function (entry, index) {
              return <Cell key={entry.model + index} fill={getModelColor(entry.model)} />;
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <CenterLabel totalCost={totalCost} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {modelUsage.map(function (entry) {
          return (
            <div key={entry.model} className="flex items-center gap-1.5 text-[10px] font-mono text-base-content/50">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: getModelColor(entry.model) }}
              />
              <span className="capitalize">{entry.model}</span>
              <span className="text-base-content/30">{entry.percentage.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
