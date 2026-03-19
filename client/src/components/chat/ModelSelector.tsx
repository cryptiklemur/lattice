import { useState } from "react";

interface ModelSelectorState {
  model: string;
  effort: string;
}

var MODEL_OPTIONS = [
  { value: "default", label: "Model: Default" },
  { value: "opus", label: "Model: Opus" },
  { value: "sonnet", label: "Model: Sonnet" },
  { value: "haiku", label: "Model: Haiku" },
];

var EFFORT_OPTIONS = [
  { value: "low", label: "Effort: Low" },
  { value: "medium", label: "Effort: Medium" },
  { value: "high", label: "Effort: High" },
  { value: "max", label: "Effort: Max" },
];

interface ModelSelectorProps {
  onChange?: (state: ModelSelectorState) => void;
}

export function ModelSelector(props: ModelSelectorProps) {
  var [model, setModel] = useState<string>("default");
  var [effort, setEffort] = useState<string>("medium");

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    var val = e.currentTarget.value;
    setModel(val);
    if (props.onChange) {
      props.onChange({ model: val, effort });
    }
  }

  function handleEffortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    var val = e.currentTarget.value;
    setEffort(val);
    if (props.onChange) {
      props.onChange({ model, effort: val });
    }
  }

  return (
    <div className="flex items-center gap-0.5 font-mono text-[10px]">
      <select
        value={model}
        onChange={handleModelChange}
        title="Select model"
        aria-label="Model"
        className={
          "select select-xs select-ghost font-mono text-[10px] min-h-0 h-6 min-w-0 w-auto " +
          (model === "default" ? "text-base-content/40" : "text-primary")
        }
      >
        {MODEL_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <span className="text-base-content/20">·</span>
      <select
        value={effort}
        onChange={handleEffortChange}
        title="Select effort"
        aria-label="Effort level"
        className={
          "select select-xs select-ghost font-mono text-[10px] min-h-0 h-6 min-w-0 w-auto " +
          (effort === "medium" ? "text-base-content/40" : "text-primary")
        }
      >
        {EFFORT_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
