import type { Spec } from "#shared";
import { STATUS_DOT, PRIORITY_COLOR, PRIORITY_LABELS, EFFORT_LABELS } from "./spec-constants";

interface SpecCardProps {
  spec: Spec;
  onClick: () => void;
  compact?: boolean;
}

export function SpecCard({ spec, onClick, compact }: SpecCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-col gap-1 p-2.5 rounded-lg border border-base-content/10 bg-base-100 hover:bg-base-content/5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 text-left w-full" +
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
          {PRIORITY_LABELS[spec.priority]}
        </span>
        <span className="text-[10px] font-mono text-base-content/30">
          {EFFORT_LABELS[spec.estimatedEffort]}
        </span>
      </div>
    </button>
  );
}
