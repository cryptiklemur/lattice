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
      if ((data.config as Record<string, unknown>).claudeMd) {
        setClaudeMd(String((data.config as Record<string, unknown>).claudeMd));
      }
      if ((data.config as Record<string, unknown>).defaultModel) {
        setModel(String((data.config as Record<string, unknown>).defaultModel));
      }
      if ((data.config as Record<string, unknown>).defaultEffort) {
        setEffort(String((data.config as Record<string, unknown>).defaultEffort));
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
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Claude Settings
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: "8px",
          }}
        >
          Default Model
        </div>
        <select
          value={model}
          onChange={function (e) { setModel(e.target.value); }}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            fontSize: "13px",
            fontFamily: "var(--font-ui)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {CLAUDE_MODELS.map(function (m) {
            return (
              <option key={m.id} value={m.id} style={{ background: "var(--bg-tertiary)" }}>
                {m.label}
              </option>
            );
          })}
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-secondary)",
            marginBottom: "8px",
          }}
        >
          Default Effort
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {EFFORT_LEVELS.map(function (e) {
            var active = effort === e.id;
            return (
              <button
                key={e.id}
                onClick={function () { setEffort(e.id); }}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  borderRadius: "var(--radius-sm)",
                  border: active
                    ? "1.5px solid var(--blue)"
                    : "1.5px solid var(--border-default)",
                  background: active ? "var(--bg-overlay)" : "var(--bg-tertiary)",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 400,
                  transition: "all var(--transition-fast)",
                }}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Global CLAUDE.md
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            ~/.claude/CLAUDE.md
          </div>
        </div>
        <textarea
          value={claudeMd}
          onChange={function (e) { setClaudeMd(e.target.value); }}
          placeholder="# Global instructions for Claude&#10;&#10;Add your global instructions here..."
          rows={14}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            lineHeight: "1.6",
            resize: "vertical",
            outline: "none",
            transition: "border-color var(--transition-fast)",
          }}
          onFocus={function (e) {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--blue)";
          }}
          onBlur={function (e) {
            (e.currentTarget as HTMLTextAreaElement).style.borderColor = "var(--border-default)";
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "7px 18px",
            borderRadius: "var(--radius-sm)",
            background: saved ? "var(--green)" : "var(--blue)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            transition: "background var(--transition-default)",
          }}
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
