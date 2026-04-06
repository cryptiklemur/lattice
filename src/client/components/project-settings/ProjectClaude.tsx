import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SaveFooter } from "../ui/SaveFooter";
import { useSaveState } from "../../hooks/useSaveState";
import type { ProjectSettings, ThinkingConfig } from "#shared";

var CLAUDE_MODELS = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
];

var EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
  { id: "max", label: "Max" },
];

var THINKING_MODES = [
  { id: "adaptive", label: "Adaptive" },
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" },
];

var PERMISSION_MODES = [
  { id: "default", label: "Default" },
  { id: "acceptEdits", label: "Accept Edits" },
  { id: "plan", label: "Plan" },
  { id: "dontAsk", label: "Don't Ask" },
];

function thinkingLabel(t?: ThinkingConfig): string {
  if (!t) return "Adaptive";
  if (t.type === "adaptive") return "Adaptive";
  if (t.type === "enabled") return "Enabled";
  return "Disabled";
}

function modelLabel(id: string): string {
  var found = CLAUDE_MODELS.find(function (m) { return m.id === id; });
  return found ? found.label : id;
}

interface ProjectClaudeProps {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}

export function ProjectClaude({ settings, updateSection }: ProjectClaudeProps) {
  var [claudeMd, setClaudeMd] = useState(settings.claudeMd ?? "");
  var [defaultModel, setDefaultModel] = useState<string | undefined>(settings.defaultModel);
  var [defaultEffort, setDefaultEffort] = useState<string | undefined>(settings.defaultEffort);
  var [thinking, setThinking] = useState<ThinkingConfig | undefined>(settings.thinking);
  var [permissionMode, setPermissionMode] = useState<string | undefined>(settings.permissionMode);
  var [budgetTokens, setBudgetTokens] = useState<number>(
    settings.thinking?.type === "enabled" ? (settings.thinking.budgetTokens ?? 10000) : 10000,
  );
  var [showGlobalMd, setShowGlobalMd] = useState(false);
  var save = useSaveState();

  useEffect(function () {
    if (save.savingRef.current) {
      save.confirmSave();
    } else {
      setClaudeMd(settings.claudeMd ?? "");
      setDefaultModel(settings.defaultModel);
      setDefaultEffort(settings.defaultEffort);
      setThinking(settings.thinking);
      setPermissionMode(settings.permissionMode);
      if (settings.thinking?.type === "enabled") {
        setBudgetTokens(settings.thinking.budgetTokens ?? 10000);
      }
      save.resetFromServer();
    }
  }, [settings]);

  function handleSave() {
    save.startSave();
    var thinkingValue: ThinkingConfig | undefined = thinking;
    if (thinkingValue?.type === "enabled") {
      thinkingValue = { type: "enabled", budgetTokens };
    }
    updateSection("claude", {
      claudeMd: claudeMd || undefined,
      defaultModel,
      defaultEffort,
      thinking: thinkingValue,
      permissionMode,
    });
  }

  var globalModel = settings.global.defaultModel || CLAUDE_MODELS[0].id;
  var globalEffort = settings.global.defaultEffort || "normal";

  return (
    <div className="py-2 space-y-6">
      <div>
        <label htmlFor="project-claude-md" className="block text-[12px] font-semibold text-base-content/40 mb-2">
          Project CLAUDE.md
        </label>
        <textarea
          id="project-claude-md"
          value={claudeMd}
          onChange={function (e) { setClaudeMd(e.target.value); save.markDirty(); }}
          placeholder="# Project-specific instructions for Claude..."
          rows={10}
          className="w-full px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[12px] font-mono leading-relaxed resize-y focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        />
        {(function () {
          var lineCount = claudeMd ? claudeMd.split("\n").length : 0;
          var overLimit = lineCount > 200;
          return (
            <div className="flex items-center justify-between mt-1.5">
              <div className={"text-[11px] " + (overLimit ? "text-warning" : "text-base-content/25")}>
                {lineCount} line{lineCount !== 1 ? "s" : ""}{overLimit ? " — consider moving content to rules or imports" : ""}
              </div>
              {overLimit && (
                <div className="text-[10px] text-warning/70">soft limit: 200 lines</div>
              )}
            </div>
          );
        })()}
        <button
          type="button"
          onClick={function () { setShowGlobalMd(!showGlobalMd); }}
          className="flex items-center gap-1.5 mt-2 text-[11px] text-base-content/40 hover:text-base-content/60 transition-colors"
        >
          {showGlobalMd
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />}
          Global CLAUDE.md (inherited)
        </button>
        {showGlobalMd && (
          <textarea
            readOnly
            value={settings.global.claudeMd}
            rows={8}
            className="w-full mt-2 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl text-base-content/30 text-[12px] font-mono leading-relaxed resize-y cursor-default focus-visible:outline-none"
          />
        )}
      </div>

      <div>
        <label htmlFor="project-default-model" className="block text-[12px] font-semibold text-base-content/40 mb-2">
          Default Model
        </label>
        <select
          id="project-default-model"
          value={defaultModel ?? ""}
          onChange={function (e) {
            var val = e.target.value || undefined;
            setDefaultModel(val);
            save.markDirty();
          }}
          className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        >
          <option value="" className="bg-base-300">
            Use global default ({modelLabel(globalModel)})
          </option>
          {CLAUDE_MODELS.map(function (m) {
            return (
              <option key={m.id} value={m.id} className="bg-base-300">
                {m.label}
              </option>
            );
          })}
        </select>
        {defaultModel && (
          <button
            type="button"
            onClick={function () { setDefaultModel(undefined); save.markDirty(); }}
            className="mt-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            Clear override
          </button>
        )}
      </div>

      <div role="radiogroup" aria-label="Default Effort">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Default Effort</div>
        <div className="flex gap-2">
          <button
            role="radio"
            aria-checked={defaultEffort === undefined}
            onClick={function () { setDefaultEffort(undefined); save.markDirty(); }}
            className={
              "flex-1 py-2.5 sm:py-1.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
              (defaultEffort === undefined
                ? "border-primary bg-base-300 text-base-content font-semibold"
                : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
            }
          >
            Global ({globalEffort})
          </button>
          {EFFORT_LEVELS.map(function (e) {
            var active = defaultEffort === e.id;
            return (
              <button
                key={e.id}
                role="radio"
                aria-checked={active}
                onClick={function () { setDefaultEffort(e.id); save.markDirty(); }}
                className={
                  "flex-1 py-2.5 sm:py-1.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
                  (active
                    ? "border-primary bg-base-300 text-base-content font-semibold"
                    : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
                }
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label="Thinking Mode">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Thinking Mode</div>
        <div className="flex gap-2">
          <button
            role="radio"
            aria-checked={thinking === undefined}
            onClick={function () { setThinking(undefined); save.markDirty(); }}
            className={
              "flex-1 py-2.5 sm:py-1.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
              (thinking === undefined
                ? "border-primary bg-base-300 text-base-content font-semibold"
                : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
            }
          >
            Global ({thinkingLabel(settings.global.thinking)})
          </button>
          {THINKING_MODES.map(function (t) {
            var active = thinking?.type === t.id;
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={active}
                onClick={function () {
                  var cfg: ThinkingConfig = t.id === "enabled"
                    ? { type: "enabled", budgetTokens }
                    : { type: t.id as "adaptive" | "disabled" };
                  setThinking(cfg);
                  save.markDirty();
                }}
                className={
                  "flex-1 py-2.5 sm:py-1.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
                  (active
                    ? "border-primary bg-base-300 text-base-content font-semibold"
                    : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {thinking?.type === "enabled" && (
          <div className="mt-3">
            <label htmlFor="budget-tokens" className="block text-[11px] text-base-content/40 mb-1.5">
              Budget Tokens
            </label>
            <input
              id="budget-tokens"
              type="number"
              min={1000}
              step={1000}
              value={budgetTokens}
              onChange={function (e) {
                var val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setBudgetTokens(val);
                  setThinking({ type: "enabled", budgetTokens: val });
                  save.markDirty();
                }
              }}
              className="w-48 h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            />
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label="Permission Mode">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Permission Mode</div>
        <div className="flex gap-2">
          {PERMISSION_MODES.map(function (p) {
            var active = (permissionMode ?? "default") === p.id;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={active}
                onClick={function () {
                  setPermissionMode(p.id === "default" ? undefined : p.id);
                  save.markDirty();
                }}
                className={
                  "flex-1 py-2.5 sm:py-1.5 rounded-lg border text-[12px] transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 " +
                  (active
                    ? "border-primary bg-base-300 text-base-content font-semibold"
                    : "border-base-content/15 bg-base-300 text-base-content/40 hover:border-base-content/30 hover:text-base-content/60")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <SaveFooter dirty={save.dirty} saving={save.saving} saveState={save.saveState} onSave={handleSave} />
    </div>
  );
}
