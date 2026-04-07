import type { SpecActivity, SpecActivityType } from "#shared";

var TYPE_COLORS: Record<SpecActivityType, string> = {
  "created": "bg-info/20 text-info",
  "status-change": "bg-warning/20 text-warning",
  "session-linked": "bg-accent/20 text-accent",
  "edited": "bg-base-content/10 text-base-content/60",
  "ai-note": "bg-secondary/20 text-secondary",
};

var TYPE_LABELS: Record<SpecActivityType, string> = {
  "created": "Created",
  "status-change": "Status",
  "session-linked": "Session",
  "edited": "Edited",
  "ai-note": "AI Note",
};

function relativeTime(ts: number): string {
  var diff = Date.now() - ts;
  var seconds = Math.floor(diff / 1000);
  if (seconds < 60) return seconds + "s ago";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  return days + "d ago";
}

interface SpecActivityTabProps {
  activity: SpecActivity[];
}

export function SpecActivityTab({ activity }: SpecActivityTabProps) {
  var reversed = [...activity].reverse();

  if (reversed.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[13px] text-base-content/30 font-mono">
        No activity yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {reversed.map(function (entry, i) {
        return (
          <div key={i} className="flex items-start gap-3 px-1 py-1.5">
            <span className="text-[10px] text-base-content/30 font-mono w-14 flex-shrink-0 pt-0.5 text-right">
              {relativeTime(entry.timestamp)}
            </span>
            <span className={"text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 " + TYPE_COLORS[entry.type]}>
              {TYPE_LABELS[entry.type]}
            </span>
            <span className="text-[12px] text-base-content/70 min-w-0">
              {entry.detail}
            </span>
          </div>
        );
      })}
    </div>
  );
}
