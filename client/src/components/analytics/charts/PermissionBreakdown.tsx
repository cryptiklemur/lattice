import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface PermissionBreakdownProps {
  data: { allowed: number; denied: number; alwaysAllowed: number };
}

var COLORS = {
  allowed: "#22c55e",
  denied: "#ef4444",
  alwaysAllowed: "oklch(55% 0.25 280)",
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload || payload.length === 0) return null;
  var entry = payload[0];
  return (
    <div className="rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg">
      <p className="text-[11px] font-mono text-base-content">{entry.name}</p>
      <p className="text-[10px] font-mono text-base-content/60">{entry.value.toLocaleString()}</p>
    </div>
  );
}

export function PermissionBreakdown({ data }: PermissionBreakdownProps) {
  var total = data.allowed + data.denied + data.alwaysAllowed;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-base-content/25 font-mono text-[11px]">
        No permission data
      </div>
    );
  }

  if (data.denied === 0 && data.alwaysAllowed === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-2">
        <div className="text-[32px] font-mono font-bold text-base-content/80">{total.toLocaleString()}</div>
        <div className="text-[11px] font-mono text-base-content/40">tool calls — all allowed</div>
      </div>
    );
  }

  var pieData = [
    { name: "Allowed", value: data.allowed },
    { name: "Denied", value: data.denied },
    { name: "Always Allowed", value: data.alwaysAllowed },
  ].filter(function (d) { return d.value > 0; });

  var colorMap: Record<string, string> = {
    Allowed: COLORS.allowed,
    Denied: COLORS.denied,
    "Always Allowed": COLORS.alwaysAllowed,
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {pieData.map(function (entry) {
              return <Cell key={entry.name} fill={colorMap[entry.name] || "#888"} />;
            })}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            <tspan x="50%" dy="-0.3em" style={{ fontSize: 14, fontFamily: "var(--font-mono)", fill: "oklch(0.9 0.02 280 / 0.9)", fontWeight: 700 }}>
              {total.toLocaleString()}
            </tspan>
            <tspan x="50%" dy="1.3em" style={{ fontSize: 9, fontFamily: "var(--font-mono)", fill: "oklch(0.9 0.02 280 / 0.35)" }}>
              total
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-1">
        {pieData.map(function (entry) {
          return (
            <div key={entry.name} className="flex items-center gap-1.5 text-[10px] font-mono text-base-content/50">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: colorMap[entry.name] }}
              />
              <span>{entry.name}</span>
              <span className="text-base-content/30">{entry.value.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
