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

var selectStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-muted)",
  fontSize: "11px",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  padding: "0 2px",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
};

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

  var currentModel = MODEL_OPTIONS.find(function (o) {
    return o.value === model;
  });
  var currentEffort = EFFORT_OPTIONS.find(function (o) {
    return o.value === effort;
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        color: "var(--text-muted)",
      }}
    >
      <select
        value={model}
        onChange={handleModelChange}
        title="Select model"
        style={selectStyle}
      >
        {MODEL_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value} style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <span style={{ color: "var(--border-default)" }}>|</span>
      <select
        value={effort}
        onChange={handleEffortChange}
        title="Select effort"
        style={selectStyle}
      >
        {EFFORT_OPTIONS.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value} style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}>
              {opt.label}
            </option>
          );
        })}
      </select>
      {!currentModel && !currentEffort && null}
    </div>
  );
}
