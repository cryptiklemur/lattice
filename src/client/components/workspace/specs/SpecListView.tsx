import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import type { Spec, SpecStatus } from "#shared";
import { STATUS_DOT, PRIORITY_COLOR } from "./SpecCard";

var STATUS_LABELS: Record<SpecStatus, string> = {
  "draft": "Draft",
  "in-progress": "In Progress",
  "on-hold": "On Hold",
  "completed": "Completed",
};

var FILTER_OPTIONS: Array<{ value: SpecStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

type SortField = "title" | "status" | "priority" | "estimatedEffort" | "updatedAt";
type SortDir = "asc" | "desc";

var PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
var EFFORT_ORDER: Record<string, number> = { xl: 0, large: 1, medium: 2, small: 3 };
var STATUS_ORDER: Record<string, number> = { "in-progress": 0, "draft": 1, "on-hold": 2, "completed": 3 };

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

interface SpecListViewProps {
  specs: Spec[];
  onSelectSpec: (spec: Spec) => void;
  filter: SpecStatus | "all";
  onFilterChange: (filter: SpecStatus | "all") => void;
}

export function SpecListView({ specs, onSelectSpec, filter, onFilterChange }: SpecListViewProps) {
  var [sortField, setSortField] = useState<SortField>("updatedAt");
  var [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(function (d) { return d === "asc" ? "desc" : "asc"; });
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  var filtered = useMemo(function () {
    var list = filter === "all" ? specs : specs.filter(function (s) { return s.status === filter; });
    var sorted = [...list];
    sorted.sort(function (a, b) {
      var cmp = 0;
      if (sortField === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      } else if (sortField === "priority") {
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      } else if (sortField === "estimatedEffort") {
        cmp = (EFFORT_ORDER[a.estimatedEffort] ?? 99) - (EFFORT_ORDER[b.estimatedEffort] ?? 99);
      } else {
        cmp = a.updatedAt - b.updatedAt;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [specs, filter, sortField, sortDir]);

  function handleRowKeyDown(e: React.KeyboardEvent, spec: Spec) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectSpec(spec);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_OPTIONS.map(function (opt) {
          var isActive = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={function () { onFilterChange(opt.value); }}
              className={
                "px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors " +
                (isActive
                  ? "bg-primary/20 text-primary"
                  : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5")
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-content/10">
              {([
                { field: "title" as SortField, label: "Title" },
                { field: "status" as SortField, label: "Status" },
                { field: "priority" as SortField, label: "Priority" },
                { field: "estimatedEffort" as SortField, label: "Effort" },
                { field: "updatedAt" as SortField, label: "Updated" },
              ]).map(function (col) {
                var isActive = sortField === col.field;
                return (
                  <th key={col.field} className="pb-2 pr-3">
                    <button
                      type="button"
                      onClick={function () { toggleSort(col.field); }}
                      className={
                        "flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider transition-colors " +
                        (isActive ? "text-primary" : "text-base-content/30 hover:text-base-content/60")
                      }
                    >
                      {col.label}
                      <ArrowUpDown size={10} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map(function (spec) {
              return (
                <tr
                  key={spec.id}
                  tabIndex={0}
                  role="button"
                  onClick={function () { onSelectSpec(spec); }}
                  onKeyDown={function (e) { handleRowKeyDown(e, spec); }}
                  className={"border-b border-base-content/5 hover:bg-base-content/5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40" + (spec.status === "completed" ? " opacity-60" : "")}
                >
                  <td className="py-2 pr-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-mono font-semibold text-base-content truncate max-w-[300px]">
                        {spec.title || "Untitled"}
                      </span>
                      {spec.tagline && (
                        <span className="text-[10px] text-base-content/30 truncate max-w-[300px]">
                          {spec.tagline}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={"w-1.5 h-1.5 rounded-full " + STATUS_DOT[spec.status]} />
                      <span className="text-[11px] font-mono text-base-content/60">{STATUS_LABELS[spec.status]}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={"text-[11px] font-mono " + PRIORITY_COLOR[spec.priority]}>
                      {spec.priority}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-[11px] font-mono text-base-content/40">
                      {spec.estimatedEffort}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="text-[10px] font-mono text-base-content/30">
                      {relativeTime(spec.updatedAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
