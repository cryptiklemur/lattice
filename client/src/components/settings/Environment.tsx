import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "@lattice/shared";

interface EnvEntry {
  id: string;
  key: string;
  value: string;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function Environment() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [entries, setEntries] = useState<EnvEntry[]>([]);
  var [saving, setSaving] = useState(false);
  var [saved, setSaved] = useState(false);

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      var data = msg as SettingsDataMessage;
      var env = data.config.globalEnv ?? {};
      var rows = Object.entries(env).map(function ([k, v]) {
        return { id: genId(), key: k, value: v };
      });
      setEntries(rows);
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function handleAddRow() {
    setEntries(function (prev) {
      return [...prev, { id: genId(), key: "", value: "" }];
    });
  }

  function handleDelete(id: string) {
    setEntries(function (prev) {
      return prev.filter(function (e) { return e.id !== id; });
    });
  }

  function handleKeyChange(id: string, key: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, key } : e;
      });
    });
  }

  function handleValueChange(id: string, value: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, value } : e;
      });
    });
  }

  function handleSave() {
    var env: Record<string, string> = {};
    entries.forEach(function (e) {
      if (e.key.trim()) {
        env[e.key.trim()] = e.value;
      }
    });
    setSaving(true);
    send({
      type: "settings:update",
      settings: { globalEnv: env },
    });
    setTimeout(function () {
      setSaving(false);
      setSaved(true);
      setTimeout(function () { setSaved(false); }, 1800);
    }, 400);
  }

  var inputBase: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border-default)",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    outline: "none",
    width: "100%",
    transition: "border-color var(--transition-fast)",
  };

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
        Environment Variables
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          marginBottom: "16px",
          lineHeight: "1.5",
        }}
      >
        Global environment variables passed to all Claude sessions.
      </div>

      {entries.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: "6px",
            marginBottom: "10px",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 2px" }}>
            Key
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 2px" }}>
            Value
          </div>
          <div style={{ width: "28px" }} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
        {entries.map(function (entry) {
          return (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr auto",
                gap: "6px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={entry.key}
                onChange={function (e) { handleKeyChange(entry.id, e.target.value); }}
                placeholder="VARIABLE_NAME"
                style={inputBase}
                onFocus={function (e) {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--blue)";
                }}
                onBlur={function (e) {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-default)";
                }}
              />
              <input
                type="text"
                value={entry.value}
                onChange={function (e) { handleValueChange(entry.id, e.target.value); }}
                placeholder="value"
                style={inputBase}
                onFocus={function (e) {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--blue)";
                }}
                onBlur={function (e) {
                  (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-default)";
                }}
              />
              <button
                onClick={function () { handleDelete(entry.id); }}
                aria-label="Delete row"
                title="Delete"
                style={{
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  transition: "color var(--transition-fast), background var(--transition-fast)",
                }}
                onMouseEnter={function (e) {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--red)";
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
                }}
                onMouseLeave={function (e) {
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleAddRow}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px dashed var(--border-default)",
          background: "transparent",
          color: "var(--text-muted)",
          fontSize: "12px",
          transition: "color var(--transition-fast), border-color var(--transition-fast)",
          marginBottom: "20px",
        }}
        onMouseEnter={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
        }}
        onMouseLeave={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add Variable
      </button>

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
