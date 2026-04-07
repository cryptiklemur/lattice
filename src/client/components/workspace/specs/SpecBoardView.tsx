import { useMemo } from "react";
import type { Spec, SpecStatus } from "#shared";
import { SpecCard } from "./SpecCard";

var COLUMNS: Array<{ status: SpecStatus; label: string; color: string; borderColor: string }> = [
  { status: "draft", label: "Draft", color: "text-info", borderColor: "border-info/40" },
  { status: "in-progress", label: "In Progress", color: "text-warning", borderColor: "border-warning/40" },
  { status: "on-hold", label: "On Hold", color: "text-base-content/50", borderColor: "border-base-content/20" },
  { status: "completed", label: "Completed", color: "text-success", borderColor: "border-success/40" },
];

interface SpecBoardViewProps {
  specs: Spec[];
  onSelectSpec: (spec: Spec) => void;
}

export function SpecBoardView({ specs, onSelectSpec }: SpecBoardViewProps) {
  var grouped = useMemo(function () {
    var map: Record<SpecStatus, Spec[]> = {
      "draft": [],
      "in-progress": [],
      "on-hold": [],
      "completed": [],
    };
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      if (map[spec.status]) {
        map[spec.status].push(spec);
      }
    }
    return map;
  }, [specs]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full">
      {COLUMNS.map(function (col) {
        var columnSpecs = grouped[col.status];
        return (
          <div key={col.status} className="flex flex-col min-h-0">
            <div className={"flex items-center gap-2 pb-2 mb-2 border-b-2 " + col.borderColor}>
              <span className={"text-[12px] font-mono font-bold " + col.color}>
                {col.label}
              </span>
              <span className="text-[10px] font-mono text-base-content/30 bg-base-content/5 px-1.5 rounded-full">
                {columnSpecs.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1">
              {columnSpecs.map(function (spec) {
                return (
                  <SpecCard
                    key={spec.id}
                    spec={spec}
                    onClick={function () { onSelectSpec(spec); }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
