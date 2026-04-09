import { useState, useEffect, useMemo } from "react";
import { X, Plus, AlertTriangle } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import { findDuplicateKeys } from "../../utils/findDuplicateKeys";
import type { ServerMessage, SettingsDataMessage } from "#shared";

interface EnvEntry {
  id: string;
  key: string;
  value: string;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function Environment() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const save = useSaveState();

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      const data = msg as SettingsDataMessage;
      const env = data.config.globalEnv ?? {};

      if (save.savingRef.current) {
        save.confirmSave();
      }

      const rows = Object.entries(env).map(function ([k, v]) {
        return { id: genId(), key: k, value: String(v) };
      });
      setEntries(rows);
      if (!save.savingRef.current) {
        save.resetFromServer();
      }
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
    save.markDirty();
  }

  function handleDelete(id: string) {
    setEntries(function (prev) {
      return prev.filter(function (e) { return e.id !== id; });
    });
    save.markDirty();
  }

  function handleKeyChange(id: string, key: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, key } : e;
      });
    });
    save.markDirty();
  }

  function handleValueChange(id: string, value: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, value } : e;
      });
    });
    save.markDirty();
  }

  function handleSave() {
    const env: Record<string, string> = {};
    entries.forEach(function (e) {
      if (e.key.trim()) {
        env[e.key.trim()] = e.value;
      }
    });
    save.startSave();
    send({
      type: "settings:update",
      settings: { globalEnv: env },
    });
  }

  const duplicateKeys = useMemo(function () { return findDuplicateKeys(entries); }, [entries]);
  const hasDuplicates = duplicateKeys.size > 0;

  return (
    <div className="py-2">
      <div className="flex flex-col gap-3 sm:gap-1.5 mb-3">
        {entries.length === 0 && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No environment variables configured.
          </div>
        )}
        {entries.map(function (entry, idx) {
          const isDupe = entry.key.trim() !== "" && duplicateKeys.has(entry.key.trim());
          return (
            <div
              key={entry.id}
              className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto] gap-1.5 sm:items-center"
            >
              <div className="relative">
                <input
                  type="text"
                  value={entry.key}
                  onChange={function (e) { handleKeyChange(entry.id, e.target.value); }}
                  placeholder="VARIABLE_NAME"
                  aria-label={"Variable name for row " + (idx + 1)}
                  aria-invalid={isDupe}
                  className={
                    "w-full h-9 sm:h-7 px-3 bg-base-300 border rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms] " +
                    (isDupe ? "border-warning" : "border-base-content/15")
                  }
                />
                {isDupe && (
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-warning sm:absolute sm:-bottom-3.5 sm:left-0" role="alert">
                    <AlertTriangle size={9} />
                    Duplicate key
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={entry.value}
                  onChange={function (e) { handleValueChange(entry.id, e.target.value); }}
                  placeholder="value"
                  aria-label={"Value for " + (entry.key || "row " + (idx + 1))}
                  className="w-full h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
                />
                <button
                  onClick={function () { handleDelete(entry.id); }}
                  aria-label={"Delete " + (entry.key || "row " + (idx + 1))}
                  title="Delete"
                  className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error w-9 h-9 flex-shrink-0 sm:hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={14} />
                </button>
              </div>
              <button
                onClick={function () { handleDelete(entry.id); }}
                aria-label={"Delete " + (entry.key || "row " + (idx + 1))}
                title="Delete"
                className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error w-7 h-7 hidden sm:flex focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={handleAddRow}
        className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-xl border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100"
      >
        <Plus size={12} />
        Add Variable
      </button>
      <SaveFooter
        dirty={save.dirty}
        saving={save.saving}
        saveState={save.saveState}
        onSave={handleSave}
        extraStatus={hasDuplicates ? "Duplicate keys will be merged" : undefined}
      />
    </div>
  );
}
