import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

var MODE_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "acceptEdits", label: "Accept Edits" },
  { value: "plan", label: "Plan" },
  { value: "dontAsk", label: "Don't Ask" },
];

export function PermissionModeSelector() {
  var [mode, setMode] = useState<string>("default");
  var { send } = useWebSocket();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    var val = e.currentTarget.value;
    setMode(val);
    send({ type: "chat:set_permission_mode", mode: val } as any);
  }

  return (
    <div className="flex items-center">
      <select
        value={mode}
        onChange={handleChange}
        title="Permission mode"
        className="select select-ghost select-xs text-[11px] text-base-content/60 bg-transparent border-none outline-none focus:outline-none h-auto min-h-0 py-0 px-0.5 cursor-pointer appearance-none"
      >
        {MODE_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value} className="bg-base-200 text-base-content">
              {opt.label}
            </option>
          );
        })}
      </select>
      <ChevronDown size={10} className="text-base-content/30 pointer-events-none -ml-0.5" />
    </div>
  );
}
