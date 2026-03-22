import { useState } from "react";

interface TimelineDatum {
  id: string;
  title: string;
  project: string;
  start: number;
  end: number;
  cost: number;
}

interface SessionTimelineProps {
  data: TimelineDatum[];
}

var ROW_HEIGHT = 16;
var ROW_GAP = 2;
var ROW_STEP = ROW_HEIGHT + ROW_GAP;
var LEFT_MARGIN = 8;
var RIGHT_MARGIN = 8;

var PROJECT_PALETTE = [
  "oklch(55% 0.25 280)",
  "#a855f7",
  "#22c55e",
  "#f59e0b",
  "oklch(65% 0.2 240)",
  "oklch(65% 0.25 25)",
  "oklch(65% 0.25 150)",
  "oklch(70% 0.2 60)",
];

function formatTime(ts: number): string {
  var d = new Date(ts);
  return (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export function SessionTimeline({ data }: SessionTimelineProps) {
  var [hover, setHover] = useState<{ x: number; y: number; datum: TimelineDatum } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-base-content/25 font-mono text-[11px]">
        No data
      </div>
    );
  }

  var projects = Array.from(new Set(data.map(function (d) { return d.project; })));
  function getColor(project: string): string {
    var idx = projects.indexOf(project);
    return PROJECT_PALETTE[idx % PROJECT_PALETTE.length];
  }

  var minTime = Infinity;
  var maxTime = -Infinity;
  for (var i = 0; i < data.length; i++) {
    if (data[i].start < minTime) minTime = data[i].start;
    if (data[i].end > maxTime) maxTime = data[i].end;
  }
  var timeRange = maxTime - minTime || 1;

  var svgHeight = data.length * ROW_STEP;
  var maxHeight = 300;

  return (
    <div className="relative overflow-y-auto overflow-x-hidden" style={{ maxHeight: maxHeight }}>
      <svg width="100%" height={svgHeight} className="block" viewBox={"0 0 600 " + svgHeight} preserveAspectRatio="none">
        {data.map(function (d, idx) {
          var barWidth = 600 - LEFT_MARGIN - RIGHT_MARGIN;
          var x1 = LEFT_MARGIN + ((d.start - minTime) / timeRange) * barWidth;
          var x2 = LEFT_MARGIN + ((d.end - minTime) / timeRange) * barWidth;
          var w = Math.max(x2 - x1, 3);
          var y = idx * ROW_STEP;

          return (
            <rect
              key={d.id}
              x={x1}
              y={y}
              width={w}
              height={ROW_HEIGHT}
              rx={3}
              ry={3}
              fill={getColor(d.project)}
              opacity={0.7}
              onMouseEnter={function (e) {
                setHover({ x: e.clientX, y: e.clientY, datum: d });
              }}
              onMouseLeave={function () { setHover(null); }}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="fixed z-50 rounded-lg border border-base-content/8 bg-base-200 px-3 py-2 shadow-lg pointer-events-none max-w-[200px]"
          style={{ left: hover.x + 12, top: hover.y - 50 }}
        >
          <p className="text-[10px] font-mono text-base-content/50 mb-1 truncate">{hover.datum.title}</p>
          <div className="text-[11px] font-mono text-base-content/70 space-y-0.5">
            <p><span className="text-base-content/40">project </span>{hover.datum.project}</p>
            <p><span className="text-base-content/40">start </span>{formatTime(hover.datum.start)}</p>
            <p><span className="text-base-content/40">end </span>{formatTime(hover.datum.end)}</p>
            <p><span className="text-base-content/40">cost </span>${hover.datum.cost.toFixed(4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
