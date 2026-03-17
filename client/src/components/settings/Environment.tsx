import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
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

  return (
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Environment Variables
      </div>

      <div className="text-[12px] text-base-content/40 mb-4 leading-relaxed">
        Global environment variables passed to all Claude sessions.
      </div>

      {entries.length > 0 && (
        <div className="grid gap-1.5 mb-2.5" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
          <div className="text-[11px] text-base-content/40 font-semibold tracking-[0.06em] uppercase px-0.5">Key</div>
          <div className="text-[11px] text-base-content/40 font-semibold tracking-[0.06em] uppercase px-0.5">Value</div>
          <div className="w-7" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-3">
        {entries.map(function (entry) {
          return (
            <div
              key={entry.id}
              className="grid gap-1.5 items-center"
              style={{ gridTemplateColumns: "1fr 1fr auto" }}
            >
              <input
                type="text"
                value={entry.key}
                onChange={function (e) { handleKeyChange(entry.id, e.target.value); }}
                placeholder="VARIABLE_NAME"
                className="input input-bordered input-xs bg-base-300 text-base-content font-mono text-[12px] focus:border-info"
              />
              <input
                type="text"
                value={entry.value}
                onChange={function (e) { handleValueChange(entry.id, e.target.value); }}
                placeholder="value"
                className="input input-bordered input-xs bg-base-300 text-base-content font-mono text-[12px] focus:border-info"
              />
              <button
                onClick={function () { handleDelete(entry.id); }}
                aria-label="Delete row"
                title="Delete"
                className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error w-7 h-7"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleAddRow}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer"
      >
        <Plus size={12} />
        Add Variable
      </button>

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
