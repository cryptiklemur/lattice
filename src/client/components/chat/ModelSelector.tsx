import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getAvailableModels, setAvailableModels, type ModelOption } from "../../stores/session";

interface ModelSelectorState {
  model: string;
  effort: string;
}

const FALLBACK_MODELS: ModelOption[] = [
  { value: "default", displayName: "Default" },
  { value: "opus", displayName: "Opus" },
  { value: "sonnet", displayName: "Sonnet" },
  { value: "haiku", displayName: "Haiku" },
];

const EFFORT_OPTIONS = [
  { value: "low", label: "Effort: Low" },
  { value: "medium", label: "Effort: Medium" },
  { value: "high", label: "Effort: High" },
  { value: "max", label: "Effort: Max" },
];

interface ModelSelectorProps {
  onChange?: (state: ModelSelectorState) => void;
}

export function ModelSelector(props: ModelSelectorProps) {
  const [model, setModel] = useState<string>("default");
  const [effort, setEffort] = useState<string>("medium");
  const [models, setModels] = useState<ModelOption[]>(function () {
    const warmup = getAvailableModels();
    return warmup.length > 0 ? warmup : FALLBACK_MODELS;
  });
  const ws = useWebSocket();

  useEffect(function () {
    function handleWarmupModels(msg: { type: string; models?: ModelOption[] }) {
      if (msg.type === "warmup:models" && msg.models && msg.models.length > 0) {
        setAvailableModels(msg.models);
        setModels(msg.models);
      }
    }
    ws.subscribe("warmup:models", handleWarmupModels as any);
    return function () {
      ws.unsubscribe("warmup:models", handleWarmupModels as any);
    };
  }, [ws]);

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.currentTarget.value;
    setModel(val);
    ws.send({ type: "chat:set_model", model: val } as any);
    if (props.onChange) {
      props.onChange({ model: val, effort });
    }
  }

  function handleEffortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.currentTarget.value;
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
        {models.map(function (opt) {
          return (
            <option key={opt.value} value={opt.value}>
              {"Model: " + opt.displayName}
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
