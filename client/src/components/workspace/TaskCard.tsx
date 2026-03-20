import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import cronstrue from "cronstrue";
import type { ScheduledTask } from "@lattice/shared";

interface TaskCardProps {
  task: ScheduledTask;
  onToggle: (taskId: string) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (taskId: string) => void;
  disabled?: boolean;
}

function formatTime(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: true });
  } catch {
    return expr;
  }
}

export function TaskCard(props: TaskCardProps) {
  var { task, onToggle, onEdit, onDelete, disabled } = props;
  var [expanded, setExpanded] = useState(false);
  var [confirming, setConfirming] = useState(false);

  function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded(function (prev) { return !prev; });
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirming) {
      onDelete(task.id);
    } else {
      setConfirming(true);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirming(false);
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit(task);
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle(task.id);
  }

  return (
    <div className="bg-base-200 border border-base-content/15 rounded-lg overflow-hidden">
      <div
        tabIndex={0}
        role="button"
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-base-300/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
        onClick={handleToggleExpand}
        onKeyDown={function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(function (prev) { return !prev; });
          }
        }}
        aria-expanded={expanded}
      >
        <span className="text-base-content/40 flex-shrink-0">
          {expanded ? <ChevronDown className="!size-3.5" /> : <ChevronRight className="!size-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-medium truncate ${task.enabled ? "text-base-content" : "text-base-content/40"}`}>
              {task.name}
            </span>
          </div>
          <div className="text-[11px] text-base-content/40 truncate mt-0.5">
            {humanCron(task.cron)}
          </div>
        </div>
        <label className="swap flex-shrink-0" onClick={disabled ? undefined : handleToggle}>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-xs"
            checked={task.enabled}
            disabled={disabled}
            onChange={function () {}}
          />
        </label>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-base-content/15 bg-base-100/50">
          <div className="pt-2.5 space-y-2">
            <div>
              <span className="text-[11px] text-base-content/40 uppercase tracking-wider">Prompt</span>
              <p className="text-[12px] text-base-content/80 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                {task.prompt}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-base-content/40 uppercase tracking-wider">Last Run</span>
                <p className="text-[12px] text-base-content/70 mt-0.5">{formatTime(task.lastRunAt)}</p>
              </div>
              <div>
                <span className="text-[11px] text-base-content/40 uppercase tracking-wider">Next Run</span>
                <p className="text-[12px] text-base-content/70 mt-0.5">{formatTime(task.nextRunAt)}</p>
              </div>
            </div>
            {!disabled && (
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={handleEdit}
                  className="btn btn-ghost btn-xs border border-base-content/15 text-base-content/70 gap-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
                >
                  <Pencil className="!size-3" />
                  Edit
                </button>
                {confirming ? (
                  <div className="flex gap-1.5">
                    <button onClick={handleDelete} className="btn btn-error btn-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200">
                      Confirm Delete
                    </button>
                    <button onClick={handleCancelDelete} className="btn btn-ghost btn-xs border border-base-content/15 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleDelete}
                    className="btn btn-ghost btn-xs border border-base-content/15 text-base-content/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
                    aria-label="Delete task"
                  >
                    <Trash2 className="!size-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
