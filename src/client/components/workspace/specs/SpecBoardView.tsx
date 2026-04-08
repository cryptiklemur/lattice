import { useCallback, useMemo, useState } from "react";
import type { Spec, SpecStatus } from "#shared";
import { SpecCard } from "./SpecCard";

const COLUMNS: Array<{ status: SpecStatus; label: string; color: string; borderColor: string }> = [
  { status: "draft", label: "Draft", color: "text-info", borderColor: "border-info/40" },
  { status: "in-progress", label: "In Progress", color: "text-warning", borderColor: "border-warning/40" },
  { status: "on-hold", label: "On Hold", color: "text-base-content/50", borderColor: "border-base-content/20" },
  { status: "completed", label: "Completed", color: "text-success", borderColor: "border-success/40" },
];

const DROP_BG: Record<SpecStatus, string> = {
  "draft": "bg-info/5",
  "in-progress": "bg-warning/5",
  "on-hold": "bg-base-content/5",
  "completed": "bg-success/5",
};

interface SpecBoardViewProps {
  specs: Spec[];
  onSelectSpec: (spec: Spec) => void;
  onStatusChange: (specId: string, status: SpecStatus) => void;
}

export function SpecBoardView({ specs, onSelectSpec, onStatusChange }: SpecBoardViewProps) {
  const [draggedSpecId, setDraggedSpecId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SpecStatus | null>(null);

  const grouped = useMemo(function () {
    const map: Record<SpecStatus, Spec[]> = {
      "draft": [],
      "in-progress": [],
      "on-hold": [],
      "completed": [],
    };
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (map[spec.status]) {
        map[spec.status].push(spec);
      }
    }
    return map;
  }, [specs]);

  function handleDragStart(e: React.DragEvent, specId: string) {
    e.dataTransfer.setData("text/plain", specId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedSpecId(specId);
  }

  function handleDragOver(e: React.DragEvent, status: SpecStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  }

  function handleDragLeave(e: React.DragEvent, columnEl: HTMLElement) {
    if (!columnEl.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }

  function handleDrop(e: React.DragEvent, status: SpecStatus) {
    e.preventDefault();
    if (draggedSpecId) {
      const spec = specs.find(function (s) { return s.id === draggedSpecId; });
      if (spec && spec.status !== status) {
        onStatusChange(draggedSpecId, status);
      }
    }
    setDraggedSpecId(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedSpecId(null);
    setDropTarget(null);
  }

  const handleColumnDragOver = useCallback(function (e: React.DragEvent, status: SpecStatus) {
    handleDragOver(e, status);
  }, []);

  const handleColumnDragLeave = useCallback(function (e: React.DragEvent) {
    handleDragLeave(e, e.currentTarget as HTMLElement);
  }, []);

  const handleColumnDrop = useCallback(function (e: React.DragEvent, status: SpecStatus) {
    handleDrop(e, status);
  }, [draggedSpecId, specs, onStatusChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-4 h-full sm:overflow-x-auto pb-2">
      {COLUMNS.map(function (col) {
        const columnSpecs = grouped[col.status];
        const isDropTarget = dropTarget === col.status;
        return (
          <div
            key={col.status}
            className={
              "flex flex-col min-h-0 sm:min-w-[240px] sm:w-[280px] sm:flex-shrink-0 rounded-lg transition-colors motion-reduce:transition-none " +
              (isDropTarget ? DROP_BG[col.status] : "")
            }
            onDragOver={function (e) { handleColumnDragOver(e, col.status); }}
            onDragLeave={handleColumnDragLeave}
            onDrop={function (e) { handleColumnDrop(e, col.status); }}
          >
            <div className={"flex items-center gap-2 pb-2 mb-2 border-b-2 px-1 " + col.borderColor}>
              <span className={"text-[12px] font-mono font-bold " + col.color}>
                {col.label}
              </span>
              <span className="text-[10px] font-mono text-base-content/30 bg-base-content/5 px-1.5 rounded-full">
                {columnSpecs.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 px-1">
              {columnSpecs.map(function (spec) {
                return (
                  <div
                    key={spec.id}
                    draggable
                    onDragStart={function (e) { handleDragStart(e, spec.id); }}
                    onDragEnd={handleDragEnd}
                    className={draggedSpecId === spec.id ? "opacity-30" : ""}
                  >
                    <SpecCard
                      spec={spec}
                      onClick={function () { onSelectSpec(spec); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
