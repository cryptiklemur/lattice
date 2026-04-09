import { useState, useMemo, useRef, useEffect } from "react";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, ExternalLink } from "lucide-react";
import { DeleteSpecModal } from "./DeleteSpecModal";
import type { Spec, SpecStatus, SpecPriority, SpecEffort } from "#shared";
import { STATUS_DOT, PRIORITY_COLOR, STATUS_LABELS, PRIORITY_LABELS, EFFORT_LABELS } from "./spec-constants";
import { relativeTime } from "../../../utils/relativeTime";

const STATUS_OPTIONS: SpecStatus[] = ["draft", "in-progress", "on-hold", "completed"];
const PRIORITY_OPTIONS: SpecPriority[] = ["high", "medium", "low"];
const EFFORT_OPTIONS: SpecEffort[] = ["small", "medium", "large", "xl"];

const FILTER_OPTIONS: Array<{ value: SpecStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in-progress", label: "In Progress" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

type SortField = "title" | "status" | "priority" | "estimatedEffort" | "updatedAt";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const EFFORT_ORDER: Record<string, number> = { xl: 0, large: 1, medium: 2, small: 3 };
const STATUS_ORDER: Record<string, number> = { "in-progress": 0, "draft": 1, "on-hold": 2, "completed": 3 };

interface SpecListViewProps {
  specs: Spec[];
  onSelectSpec: (spec: Spec) => void;
  onUpdateSpec: (id: string, updates: Record<string, unknown>) => void;
  onDeleteSpec: (id: string) => void;
  filter: SpecStatus | "all";
  onFilterChange: (filter: SpecStatus | "all") => void;
}

function InlinePicker<T extends string>({ value, options, labels, onSelect, dotColors, textColors }: {
  value: T;
  options: T[];
  labels?: Record<string, string>;
  onSelect: (val: T) => void;
  dotColors?: Record<string, string>;
  textColors?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(function () {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [open]);

  const display = labels ? labels[value] : value;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={function (e) {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-1.5 hover:bg-base-content/10 rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 transition-colors"
      >
        {dotColors && <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (dotColors[value] || "")} />}
        <span className={"text-[11px] font-mono " + (textColors ? (textColors[value] || "text-base-content/60") : "text-base-content/60")}>
          {display}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-base-200 border border-base-content/15 rounded-lg shadow-lg z-50 min-w-[120px] max-w-[calc(100vw-2rem)] py-1">
          {options.map(function (opt) {
            const isActive = opt === value;
            const label = labels ? labels[opt] : opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={function (e) {
                  e.stopPropagation();
                  onSelect(opt);
                  setOpen(false);
                }}
                className={"w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 transition-colors " +
                  (isActive ? "bg-primary/10 text-primary" : "text-base-content/60 hover:bg-base-content/5 hover:text-base-content")}
              >
                {dotColors && <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (dotColors[opt] || "")} />}
                <span className={textColors ? (textColors[opt] || "") : ""}>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionsMenu({ onEdit, onRename, onDelete }: {
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(function () {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={function (e) {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-base-content/20 hover:text-base-content/60 hover:bg-base-content/10 transition-colors"
        aria-label="Spec actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-base-200 border border-base-content/15 rounded-lg shadow-lg z-50 min-w-[130px] py-1">
          <button
            type="button"
            onClick={function (e) {
              e.stopPropagation();
              setOpen(false);
              onEdit();
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors"
          >
            <ExternalLink size={12} />
            Open
          </button>
          <button
            type="button"
            onClick={function (e) {
              e.stopPropagation();
              setOpen(false);
              onRename();
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors"
          >
            <Pencil size={12} />
            Rename
          </button>
          <button
            type="button"
            onClick={function (e) {
              e.stopPropagation();
              setOpen(false);
              onDelete();
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] font-mono flex items-center gap-2 text-error/60 hover:bg-error/5 hover:text-error transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function SpecListView({ specs, onSelectSpec, onUpdateSpec, onDeleteSpec, filter, onFilterChange }: SpecListViewProps) {
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingSpec, setDeletingSpec] = useState<Spec | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(function () {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(function (d) { return d === "asc" ? "desc" : "asc"; });
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function handleRenameSubmit(specId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      onUpdateSpec(specId, { title: trimmed });
    }
    setRenamingId(null);
  }

  const filtered = useMemo(function () {
    const list = filter === "all" ? specs : specs.filter(function (s) { return s.status === filter; });
    const sorted = [...list];
    sorted.sort(function (a, b) {
      let cmp = 0;
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_OPTIONS.map(function (opt) {
          const isActive = filter === opt.value;
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

      <div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-content/10">
              {([
                { field: "title" as SortField, label: "Title", hideClass: "" },
                { field: "status" as SortField, label: "Status", hideClass: "" },
                { field: "priority" as SortField, label: "Priority", hideClass: "" },
                { field: "estimatedEffort" as SortField, label: "Effort", hideClass: "hidden sm:table-cell" },
                { field: "updatedAt" as SortField, label: "Updated", hideClass: "hidden md:table-cell" },
              ]).map(function (col, ci) {
                const isActive = sortField === col.field;
                return (
                  <th key={col.field} className={"pb-2 pr-3 " + (ci === 0 ? "pl-3 " : "") + col.hideClass}>
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
              <th className="pb-2 w-10 pr-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(function (spec) {
              return (
                <tr
                  key={spec.id}
                  className={"border-b border-base-content/5 hover:bg-base-content/5 transition-colors" + (spec.status === "completed" ? " opacity-60" : "")}
                >
                  <td className="py-2 pl-3 pr-3">
                    {renamingId === spec.id ? (
                      <input
                        ref={renameRef}
                        type="text"
                        value={renameValue}
                        onChange={function (e) { setRenameValue(e.target.value); }}
                        onBlur={function () { handleRenameSubmit(spec.id); }}
                        onKeyDown={function (e) {
                          if (e.key === "Enter") { handleRenameSubmit(spec.id); }
                          if (e.key === "Escape") { setRenamingId(null); }
                        }}
                        className="w-full bg-base-300 text-[12px] font-mono font-semibold text-base-content px-2 py-0.5 rounded border border-primary/30 outline-none focus:border-primary/60"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={function () { onSelectSpec(spec); }}
                        className="flex flex-col gap-0.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded px-1 -mx-1"
                      >
                        <span className="text-[12px] font-mono font-semibold text-base-content truncate max-w-[160px] sm:max-w-[300px]">
                          {spec.title || "Untitled"}
                        </span>
                        {spec.tagline && (
                          <span className="text-[10px] text-base-content/30 truncate max-w-[160px] sm:max-w-[300px]">
                            {spec.tagline}
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <InlinePicker
                      value={spec.status}
                      options={STATUS_OPTIONS}
                      labels={STATUS_LABELS}
                      dotColors={STATUS_DOT}
                      onSelect={function (val) { onUpdateSpec(spec.id, { status: val }); }}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <InlinePicker
                      value={spec.priority}
                      options={PRIORITY_OPTIONS}
                      labels={PRIORITY_LABELS}
                      textColors={PRIORITY_COLOR}
                      onSelect={function (val) { onUpdateSpec(spec.id, { priority: val }); }}
                    />
                  </td>
                  <td className="py-2 pr-3 hidden sm:table-cell">
                    <InlinePicker
                      value={spec.estimatedEffort}
                      options={EFFORT_OPTIONS}
                      labels={EFFORT_LABELS}
                      onSelect={function (val) { onUpdateSpec(spec.id, { estimatedEffort: val }); }}
                    />
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    <span className="text-[10px] font-mono text-base-content/30">
                      {relativeTime(spec.updatedAt)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <ActionsMenu
                      onEdit={function () { onSelectSpec(spec); }}
                      onRename={function () {
                        setRenamingId(spec.id);
                        setRenameValue(spec.title);
                      }}
                      onDelete={function () { setDeletingSpec(spec); }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {deletingSpec && (
        <DeleteSpecModal
          title={deletingSpec.title}
          onCancel={function () { setDeletingSpec(null); }}
          onConfirm={function () {
            onDeleteSpec(deletingSpec.id);
            setDeletingSpec(null);
          }}
        />
      )}
    </div>
  );
}
