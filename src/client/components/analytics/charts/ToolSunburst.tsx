import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getChartColors } from "../chartTokens";

interface ToolSunburstProps {
  data: Array<{ name: string; category: string; count: number }>;
}

function getCategoryColor(category: string): string {
  var colors = getChartColors();
  return colors.category[category] || colors.category.Other;
}

function getToolColor(category: string, index: number): string {
  var base = getCategoryColor(category);
  var opacity = 0.9 - index * 0.12;
  if (opacity < 0.4) opacity = 0.4;
  return base.startsWith("oklch") ? base.replace(")", " / " + opacity + ")") : base + String(Math.round(opacity * 255).toString(16)).padStart(2, "0");
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { category?: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;
  var entry = payload[0];
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[11px] font-mono text-base-content font-bold">{entry.name}</p>
      {entry.payload.category && (
        <p className="text-[10px] font-mono text-base-content/40">{entry.payload.category}</p>
      )}
      <p className="text-[10px] font-mono text-base-content/60">{entry.value.toLocaleString()} calls</p>
    </div>
  );
}

export function ToolSunburst({ data }: ToolSunburstProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-base-content/25 font-mono text-[11px]">
        No tool data
      </div>
    );
  }

  var categoryTotals = new Map<string, number>();
  for (var i = 0; i < data.length; i++) {
    var cat = data[i].category;
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + data[i].count);
  }

  var innerData: Array<{ name: string; value: number }> = [];
  categoryTotals.forEach(function (count, category) {
    innerData.push({ name: category, value: count });
  });
  innerData.sort(function (a, b) { return b.value - a.value; });

  var categoryOrder: string[] = innerData.map(function (d) { return d.name; });

  var outerData: Array<{ name: string; category: string; value: number }> = [];
  for (var ci = 0; ci < categoryOrder.length; ci++) {
    var catName = categoryOrder[ci];
    var catTools = data
      .filter(function (d) { return d.category === catName; })
      .sort(function (a, b) { return b.count - a.count; });
    for (var ti = 0; ti < catTools.length; ti++) {
      outerData.push({ name: catTools[ti].name, category: catName, value: catTools[ti].count });
    }
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={innerData}
            dataKey="value"
            nameKey="name"
            innerRadius={35}
            outerRadius={60}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {innerData.map(function (entry) {
              return <Cell key={"inner-" + entry.name} fill={getCategoryColor(entry.name)} />;
            })}
          </Pie>
          <Pie
            data={outerData}
            dataKey="value"
            nameKey="name"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={1}
            startAngle={90}
            endAngle={-270}
          >
            {outerData.map(function (entry, index) {
              var catIndex = outerData.slice(0, index).filter(function (d) { return d.category === entry.category; }).length;
              return <Cell key={"outer-" + entry.name} fill={getToolColor(entry.category, catIndex)} />;
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-1">
        {innerData.map(function (entry) {
          return (
            <div key={entry.name} className="flex items-center gap-1.5 text-[10px] font-mono text-base-content/50">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: getCategoryColor(entry.name) }}
              />
              <span>{entry.name}</span>
              <span className="text-base-content/30">{entry.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
