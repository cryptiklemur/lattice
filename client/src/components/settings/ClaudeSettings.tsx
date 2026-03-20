import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import type { ServerMessage, SettingsDataMessage, SettingsUpdateMessage } from "@lattice/shared";

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

export function ClaudeSettings() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [claudeMd, setClaudeMd] = useState("");
  var [model, setModel] = useState(CLAUDE_MODELS[0].id);
  var [effort, setEffort] = useState("normal");
  var save = useSaveState();

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      var data = msg as SettingsDataMessage;
      var cfg = data.config as unknown as Record<string, unknown>;

      var newClaudeMd = cfg.claudeMd ? String(cfg.claudeMd) : "";
      var newModel = cfg.defaultModel ? String(cfg.defaultModel) : CLAUDE_MODELS[0].id;
      var newEffort = cfg.defaultEffort ? String(cfg.defaultEffort) : "normal";

      if (save.saving) {
        save.confirmSave();
      } else {
        setClaudeMd(newClaudeMd);
        setModel(newModel);
        setEffort(newEffort);
        save.resetFromServer();
      }
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function handleModelChange(value: string) {
    setModel(value);
    save.markDirty();
  }

  function handleEffortChange(value: string) {
    setEffort(value);
    save.markDirty();
  }

  function handleClaudeMdChange(value: string) {
    setClaudeMd(value);
    save.markDirty();
  }

  function handleSave() {
    save.startSave();
    var updateMsg: SettingsUpdateMessage = {
      type: "settings:update",
      settings: { claudeMd, defaultModel: model, defaultEffort: effort } as SettingsUpdateMessage["settings"],
    };
    send(updateMsg);
  }

  return (
    <div className="py-2">
      <div className="mb-5">
        <label htmlFor="claude-default-model" className="block text-[12px] font-semibold text-base-content/40 mb-2">Default Model</label>
        <select
          id="claude-default-model"
          value={model}
          onChange={function (e) { handleModelChange(e.target.value); }}
          className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        >
          {CLAUDE_MODELS.map(function (m) {
            return (
              <option key={m.id} value={m.id} className="bg-base-300">
                {m.label}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mb-6" role="radiogroup" aria-label="Default Effort">
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Default Effort</div>
        <div className="flex gap-2">
          {EFFORT_LEVELS.map(function (e) {
            var active = effort === e.id;
            return (
              <button
                key={e.id}
                role="radio"
                aria-checked={active}
                onClick={function () { handleEffortChange(e.id); }}
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

      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="claude-global-md" className="text-[12px] font-semibold text-base-content/40">Global CLAUDE.md</label>
          <div className="text-[11px] text-base-content/30 font-mono">~/.claude/CLAUDE.md</div>
        </div>
        <textarea
          id="claude-global-md"
          value={claudeMd}
          onChange={function (e) { handleClaudeMdChange(e.target.value); }}
          placeholder={"# Global instructions for Claude\n\nAdd your global instructions here..."}
          rows={14}
          className="w-full px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[12px] font-mono leading-relaxed resize-y focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        />
      </div>

      <SaveFooter
        dirty={save.dirty}
        saving={save.saving}
        saveState={save.saveState}
        onSave={handleSave}
      />
    </div>
  );
}
