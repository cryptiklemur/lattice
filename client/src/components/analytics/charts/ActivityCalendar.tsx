import { useState, useRef, useEffect } from "react";
import { getChartColors } from "../chartTokens";

interface CalendarDatum {
  date: string;
  count: number;
  tokens: number;
  cost: number;
}

interface ActivityCalendarProps {
  data: CalendarDatum[];
}

var DAY_LABEL_WIDTH = 28;
var MONTH_LABEL_HEIGHT = 16;

var INTENSITY_OPACITIES = [0.05, 0.15, 0.3, 0.5, 0.8];

var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DAY_LABELS = [
  { index: 1, label: "Mon" },
  { index: 3, label: "Wed" },
  { index: 5, label: "Fri" },
];

function getIntensity(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) return -1;
  var ratio = count / maxCount;
  if (ratio <= 0.2) return 0;
  if (ratio <= 0.4) return 1;
  if (ratio <= 0.6) return 2;
  if (ratio <= 0.8) return 3;
  return 4;
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  var parts = dateStr.split("-");
  return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) };
}

export function ActivityCalendar({ data }: ActivityCalendarProps) {
  var colors = getChartColors();
  var PRIMARY_COLOR = colors.primary;
  var [hover, setHover] = useState<{ x: number; y: number; datum: CalendarDatum } | null>(null);
  var containerRef = useRef<HTMLDivElement>(null);
  var [containerWidth, setContainerWidth] = useState(0);

  useEffect(function () {
    if (!containerRef.current) return;
    let ro = new ResizeObserver(function (entries) {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return function () { ro.disconnect(); };
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-base-content/25 font-mono text-[11px]">
        No data
      </div>
    );
  }

  var dataMap = new Map<string, CalendarDatum>();
  var maxCount = 0;
  for (var i = 0; i < data.length; i++) {
    dataMap.set(data[i].date, data[i]);
    if (data[i].count > maxCount) maxCount = data[i].count;
  }

  var lastDate = new Date(data[data.length - 1].date + "T00:00:00");
  var startDate = new Date(lastDate);
  startDate.setDate(startDate.getDate() - 364);
  var startDay = startDate.getDay();
  if (startDay !== 0) {
    startDate.setDate(startDate.getDate() - startDay);
  }

  var weeks: Array<Array<{ date: string; datum: CalendarDatum | undefined } | null>> = [];
  var cursor = new Date(startDate);
  var currentWeek: Array<{ date: string; datum: CalendarDatum | undefined } | null> = [];

  while (cursor <= lastDate) {
    var dow = cursor.getDay();
    if (dow === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    var key = cursor.getFullYear() + "-" + String(cursor.getMonth() + 1).padStart(2, "0") + "-" + String(cursor.getDate()).padStart(2, "0");
    currentWeek.push({ date: key, datum: dataMap.get(key) });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  var monthLabels: Array<{ col: number; label: string }> = [];
  var lastMonth = -1;
  for (var wi = 0; wi < weeks.length; wi++) {
    var firstCell = weeks[wi][0];
    if (!firstCell) continue;
    var parts = parseDateParts(firstCell.date);
    if (parts.month !== lastMonth) {
      monthLabels.push({ col: wi, label: MONTH_NAMES[parts.month] });
      lastMonth = parts.month;
    }
  }

  var availableWidth = (containerWidth || 800) - DAY_LABEL_WIDTH;
  var CELL_STEP = Math.max(3, Math.floor(availableWidth / weeks.length));
  var CELL_GAP = Math.max(1, Math.round(CELL_STEP * 0.15));
  var CELL_SIZE = CELL_STEP - CELL_GAP;

  var svgWidth = DAY_LABEL_WIDTH + weeks.length * CELL_STEP;
  var svgHeight = MONTH_LABEL_HEIGHT + 7 * CELL_STEP;

  return (
    <div ref={containerRef} className="relative w-full">
      <svg width="100%" height={svgHeight} viewBox={"0 0 " + svgWidth + " " + svgHeight} className="block">
        {monthLabels.map(function (ml, idx) {
          return (
            <text
              key={idx}
              x={DAY_LABEL_WIDTH + ml.col * CELL_STEP}
              y={10}
              className="fill-base-content/30"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {ml.label}
            </text>
          );
        })}

        {DAY_LABELS.map(function (dl) {
          return (
            <text
              key={dl.index}
              x={0}
              y={MONTH_LABEL_HEIGHT + dl.index * CELL_STEP + CELL_SIZE - 1}
              className="fill-base-content/30"
              style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {dl.label}
            </text>
          );
        })}

        {weeks.map(function (week, col) {
          return week.map(function (cell, row) {
            if (!cell) return null;
            var intensity = getIntensity(cell.datum?.count || 0, maxCount);
            var x = DAY_LABEL_WIDTH + col * CELL_STEP;
            var y = MONTH_LABEL_HEIGHT + row * CELL_STEP;
            var opacity = intensity >= 0 ? INTENSITY_OPACITIES[intensity] : 0.05;
            var fillColor = intensity >= 0 ? PRIMARY_COLOR : undefined;

            return (
              <rect
                key={cell.date}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                fill={fillColor || "currentColor"}
                opacity={opacity}
                className={fillColor ? "" : "text-base-content/5"}
                onMouseEnter={function (e) {
                  setHover({
                    x: e.clientX,
                    y: e.clientY,
                    datum: cell!.datum || { date: cell!.date, count: 0, tokens: 0, cost: 0 },
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
          <p className="text-[10px] font-mono text-base-content/50">{hover.datum.date}</p>
          <div className="text-[11px] font-mono text-base-content/70 space-y-0.5">
            <p><span className="text-base-content/40">sessions </span>{hover.datum.count}</p>
            <p><span className="text-base-content/40">cost </span>${hover.datum.cost.toFixed(4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
