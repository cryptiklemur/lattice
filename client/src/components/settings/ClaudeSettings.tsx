import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage, SettingsUpdateMessage } from "@lattice/shared";

var CLAUDE_MODELS = [
  { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "claude-opus-4", label: "Claude Opus 4" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
];

var EFFORT_LEVELS = [
  { id: "low", label: "Low" },
  { id: "normal", label: "Normal" },
  { id: "high", label: "High" },
];

export function ClaudeSettings() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [claudeMd, setClaudeMd] = useState("");
  var [model, setModel] = useState("claude-sonnet-4-5");
  var [effort, setEffort] = useState("normal");
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      var data = msg as SettingsDataMessage;
      var cfg = data.config as unknown as Record<string, unknown>;
      if (cfg.claudeMd) {
        setClaudeMd(String(cfg.claudeMd));
      }
      if (cfg.defaultModel) {
        setModel(String(cfg.defaultModel));
      }
      if (cfg.defaultEffort) {
        setEffort(String(cfg.defaultEffort));
      }
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function handleSave() {
    setSaving(true);
    var updateMsg: SettingsUpdateMessage = {
      type: "settings:update",
      settings: { claudeMd, defaultModel: model, defaultEffort: effort } as SettingsUpdateMessage["settings"],
    };
    send(updateMsg);
    setTimeout(function () {
      setSaving(false);
      setSaved(true);
      setTimeout(function () { setSaved(false); }, 1800);
    }, 400);
  }

  return (
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Claude Settings
      </div>

      <div className="mb-5">
        <div className="text-[12px] font-semibold text-base-content/60 mb-2">Default Model</div>
        <select
          value={model}
          onChange={function (e) { setModel(e.target.value); }}
          className="select select-bordered select-sm w-full bg-base-300 text-base-content text-[13px]"
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

      <div className="mb-6">
        <div className="text-[12px] font-semibold text-base-content/60 mb-2">Default Effort</div>
        <div className="flex gap-2">
          {EFFORT_LEVELS.map(function (e) {
            var active = effort === e.id;
            return (
              <button
                key={e.id}
                onClick={function () { setEffort(e.id); }}
                className={
                  "flex-1 py-1.5 rounded border text-[12px] transition-all duration-[120ms] cursor-pointer " +
                  (active
                    ? "border-info bg-base-300 text-base-content font-semibold"
                    : "border-base-300 bg-base-300 text-base-content/60 hover:border-base-content/30")
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
          <div className="text-[12px] font-semibold text-base-content/60">Global CLAUDE.md</div>
          <div className="text-[11px] text-base-content/40">~/.claude/CLAUDE.md</div>
        </div>
        <textarea
          value={claudeMd}
          onChange={function (e) { setClaudeMd(e.target.value); }}
          placeholder={"# Global instructions for Claude\n\nAdd your global instructions here..."}
          rows={14}
          className="textarea textarea-bordered w-full bg-base-300 text-base-content text-[12px] font-mono leading-relaxed resize-y focus:border-info"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={
            "btn btn-sm " +
            (saved ? "btn-success" : "btn-info") +
            (saving ? " opacity-70 cursor-not-allowed" : "")
          }
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
