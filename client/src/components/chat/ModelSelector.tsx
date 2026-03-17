import { useState } from "react";

interface ModelSelectorState {
  model: string;
  effort: string;
}

var MODEL_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { value: "claude-opus-4", label: "Claude Opus 4" },
  { value: "claude-sonnet-4-0", label: "Claude Sonnet 4" },
  { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
];

var EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
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
    <div className="flex items-center gap-1 text-[11px] text-base-content/40">
      <select
        value={model}
        onChange={handleModelChange}
        title="Select model"
        className="select select-ghost select-xs text-[11px] text-base-content/40 bg-transparent border-none outline-none focus:outline-none h-auto min-h-0 py-0 px-0.5 cursor-pointer appearance-none"
      >
        {MODEL_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value} className="bg-base-200 text-base-content">
              {opt.label}
            </option>
          );
        })}
      </select>
      <span className="text-base-content/20">|</span>
      <select
        value={effort}
        onChange={handleEffortChange}
        title="Select effort"
        className="select select-ghost select-xs text-[11px] text-base-content/40 bg-transparent border-none outline-none focus:outline-none h-auto min-h-0 py-0 px-0.5 cursor-pointer appearance-none"
      >
        {EFFORT_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value} className="bg-base-200 text-base-content">
              {opt.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
