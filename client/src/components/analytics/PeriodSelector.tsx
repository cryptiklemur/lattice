type Period = "24h" | "7d" | "30d" | "90d" | "all";

var PERIODS: Array<{ value: Period; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Time period" className="flex items-center gap-1">
      {PERIODS.map(function (period) {
        var isActive = period.value === value;
        return (
          <button
            key={period.value}
            role="radio"
            aria-checked={isActive}
            onClick={function () { onChange(period.value); }}
            className={[
              "px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold uppercase tracking-widest transition-colors",
              isActive
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-base-content/35 border-base-content/8 hover:text-base-content/60 hover:border-base-content/20",
            ].join(" ")}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}

export type { Period };
