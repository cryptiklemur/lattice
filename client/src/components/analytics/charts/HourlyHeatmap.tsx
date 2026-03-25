import { useState } from "react";
import { getChartColors } from "../chartTokens";

interface HeatmapDatum {
  day: number;
  hour: number;
  count: number;
}

interface HourlyHeatmapProps {
  data: HeatmapDatum[];
}

var CELL_SIZE = 18;
var CELL_GAP = 2;
var CELL_STEP = CELL_SIZE + CELL_GAP;
var DAY_LABEL_WIDTH = 32;
var HOUR_LABEL_HEIGHT = 16;

var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

export function HourlyHeatmap({ data }: HourlyHeatmapProps) {
  var colors = getChartColors();
  var PRIMARY_COLOR = colors.primary;
  var [hover, setHover] = useState<{ x: number; y: number; day: string; hour: number; count: number } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-base-content/25 font-mono text-[11px]">
        No data for this period
      </div>
    );
  }

  var grid = new Map<string, number>();
  var maxCount = 0;
  for (var i = 0; i < data.length; i++) {
    var key = data[i].day + ":" + data[i].hour;
    grid.set(key, data[i].count);
    if (data[i].count > maxCount) maxCount = data[i].count;
  }

  var svgWidth = DAY_LABEL_WIDTH + 24 * CELL_STEP;
  var svgHeight = HOUR_LABEL_HEIGHT + 7 * CELL_STEP;

  return (
    <div className="relative overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="block">
        {HOUR_LABELS.map(function (h) {
          return (
            <text
              key={h}
              x={DAY_LABEL_WIDTH + h * CELL_STEP + CELL_SIZE / 2}
              y={11}
              textAnchor="middle"
              className="fill-base-content/30"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {h}
            </text>
          );
        })}

        {DAY_ORDER.map(function (dayIdx, row) {
          return (
            <text
              key={dayIdx}
              x={0}
              y={HOUR_LABEL_HEIGHT + row * CELL_STEP + CELL_SIZE - 3}
              className="fill-base-content/30"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {DAY_NAMES[dayIdx]}
            </text>
          );
        })}

        {DAY_ORDER.map(function (dayIdx, row) {
          return Array.from({ length: 24 }, function (_, h) {
            var cellKey = dayIdx + ":" + h;
            var count = grid.get(cellKey) || 0;
            var opacity = maxCount > 0 && count > 0 ? Math.max(0.1, count / maxCount) : 0.05;
            var x = DAY_LABEL_WIDTH + h * CELL_STEP;
            var y = HOUR_LABEL_HEIGHT + row * CELL_STEP;
            var dayName = DAY_NAMES[dayIdx];

            return (
              <rect
                key={cellKey}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={count > 0 ? PRIMARY_COLOR : "currentColor"}
                opacity={opacity}
                className={count > 0 ? "" : "text-base-content/5"}
                onMouseEnter={function (e) {
                  setHover({
                    x: e.clientX,
                    y: e.clientY,
                    day: dayName,
                    hour: h,
                    count: count,
                  });
                }}
                onMouseLeave={function () { setHover(null); }}
              />
            );
          });
        })}
      </svg>

      {hover && (
        <div
          className="fixed z-50 rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg pointer-events-none"
          style={{ left: hover.x + 12, top: hover.y - 40 }}
        >
          <div className="text-[11px] font-mono text-base-content/70 space-y-0.5">
            <p><span className="text-base-content/40">{hover.day} </span>{hover.hour}:00</p>
            <p><span className="text-base-content/40">sessions </span>{hover.count}</p>
          </div>
        </div>
      )}
    </div>
  );
}
