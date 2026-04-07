import type { Spec, SpecStatus, SpecPriority } from "#shared";

export var STATUS_DOT: Record<SpecStatus, string> = {
  "draft": "bg-info",
  "in-progress": "bg-warning",
  "on-hold": "bg-base-content/40",
  "completed": "bg-success",
};

export var PRIORITY_COLOR: Record<SpecPriority, string> = {
  "high": "text-error",
  "medium": "text-warning",
  "low": "text-base-content/40",
};

interface SpecCardProps {
  spec: Spec;
  onClick: () => void;
  compact?: boolean;
}

export function SpecCard({ spec, onClick, compact }: SpecCardProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={
        "flex flex-col gap-1 p-2.5 rounded-lg border border-base-content/10 bg-base-100 hover:bg-base-content/5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" +
        (spec.status === "completed" ? " opacity-60" : "")
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + STATUS_DOT[spec.status]} />
        <span className="text-[12px] font-mono font-semibold text-base-content truncate">
          {spec.title || "Untitled"}
        </span>
      </div>
      {!compact && spec.tagline && (
        <span className="text-[11px] text-base-content/40 truncate pl-3.5">
          {spec.tagline}
        </span>
      )}
      <div className="flex items-center gap-2 pl-3.5">
        <span className={"text-[10px] font-mono " + PRIORITY_COLOR[spec.priority]}>
          {spec.priority}
        </span>
        <span className="text-[10px] font-mono text-base-content/30">
          {spec.estimatedEffort}
        </span>
      </div>
    </div>
  );
}
