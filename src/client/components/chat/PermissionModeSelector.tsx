import { useState } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";

const MODE_OPTIONS = [
  { value: "default", label: "Mode: Default" },
  { value: "acceptEdits", label: "Mode: Accept Edits" },
  { value: "plan", label: "Mode: Plan" },
  { value: "dontAsk", label: "Mode: Don't Ask" },
];

export function PermissionModeSelector() {
  const [mode, setMode] = useState<string>("default");
  const { send } = useWebSocket();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.currentTarget.value;
    setMode(val);
    send({ type: "chat:set_permission_mode", mode: val as "default" | "acceptEdits" | "plan" | "dontAsk" });
  }

  return (
    <select
      value={mode}
      onChange={handleChange}
      title="Permission mode"
      aria-label="Permission mode"
      className={
        "select select-xs select-ghost font-mono text-[10px] min-h-0 h-6 min-w-0 w-auto " +
        (mode === "default" ? "text-base-content/40" : "text-primary")
      }
    >
      {MODE_OPTIONS.map(function (opt) {
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}
