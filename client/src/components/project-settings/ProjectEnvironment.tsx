import { useState, useMemo } from "react";
import { X, Plus, AlertTriangle } from "lucide-react";
import type { ProjectSettings } from "@lattice/shared";

interface EnvEntry {
  id: string;
  key: string;
  value: string;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function findDuplicateKeys(entries: EnvEntry[]): Set<string> {
  var seen = new Map<string, number>();
  var dupes = new Set<string>();
  for (var i = 0; i < entries.length; i++) {
    var k = entries[i].key.trim();
    if (!k) continue;
    var count = (seen.get(k) || 0) + 1;
    seen.set(k, count);
    if (count > 1) dupes.add(k);
  }
  return dupes;
}

export function ProjectEnvironment({
  settings,
  updateSection,
}: {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}) {
  var globalEnv = settings.global.env ?? {};
  var globalEntries = Object.entries(globalEnv);

  var [entries, setEntries] = useState<EnvEntry[]>(function () {
    return Object.entries(settings.env ?? {}).map(function ([k, v]) {
      return { id: genId(), key: k, value: v };
    });
  });
  var [dirty, setDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  var globalKeySet = useMemo(function () {
    return new Set(Object.keys(globalEnv));
  }, [globalEnv]);

  var duplicateKeys = useMemo(function () {
    return findDuplicateKeys(entries);
  }, [entries]);
  var hasDuplicates = duplicateKeys.size > 0;

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function handleAddRow() {
    setEntries(function (prev) {
      return [...prev, { id: genId(), key: "", value: "" }];
    });
    markDirty();
  }

  function handleDelete(id: string) {
    setEntries(function (prev) {
      return prev.filter(function (e) { return e.id !== id; });
    });
    markDirty();
  }

  function handleKeyChange(id: string, key: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, key } : e;
      });
    });
    markDirty();
  }

  function handleValueChange(id: string, value: string) {
    setEntries(function (prev) {
      return prev.map(function (e) {
        return e.id === id ? { ...e, value } : e;
      });
    });
    markDirty();
  }

  function handleSave() {
    var env: Record<string, string> = {};
    entries.forEach(function (e) {
      if (e.key.trim()) {
        env[e.key.trim()] = e.value;
      }
    });
    setSaving(true);
    updateSection("environment", { env });
    setSaving(false);
    setSaveState("saved");
    setDirty(false);
    setTimeout(function () { setSaveState("idle"); }, 1800);
  }

  var inputClass = "w-full h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]";

  return (
    <div className="py-2">
      <div className="mb-6">
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Global Variables
        </h2>
        {globalEntries.length === 0 && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global environment variables.
          </div>
        )}
        {globalEntries.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {globalEntries.map(function ([k, v]) {
              return (
                <div
                  key={k}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_1fr_auto] gap-1.5 sm:items-center"
                >
                  <div className="h-9 sm:h-7 px-3 bg-base-300/50 border border-base-content/10 rounded-xl flex items-center font-mono text-[12px] text-base-content/40">
                    {k}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div className="h-9 sm:h-7 px-3 bg-base-300/50 border border-base-content/10 rounded-xl flex items-center font-mono text-[12px] text-base-content/40 w-full">
                      {v}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-base-content/30 w-7 text-center hidden sm:block">
                    global
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Project Variables
        </h2>
        <div className="flex flex-col gap-3 sm:gap-1.5 mb-3">
          {entries.length === 0 && (
            <div className="py-4 text-center text-[13px] text-base-content/30">
              No project environment variables.
            </div>
          )}
          {entries.map(function (entry, idx) {
            var isDupe = entry.key.trim() !== "" && duplicateKeys.has(entry.key.trim());
            var overridesGlobal = entry.key.trim() !== "" && globalKeySet.has(entry.key.trim());
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
                  {!isDupe && overridesGlobal && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-warning/70 sm:absolute sm:-bottom-3.5 sm:left-0">
                      overrides global
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
                    className={inputClass}
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
          className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100"
        >
          <Plus size={12} />
          Add Variable
        </button>

        <div className="flex items-center justify-end gap-3">
          {hasDuplicates && (
            <div className="text-[11px] text-warning/70">Duplicate keys will be merged</div>
          )}
          {dirty && saveState === "idle" && !saving && !hasDuplicates && (
            <div className="text-[11px] text-warning/70">Unsaved changes</div>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && saveState !== "idle")}
            className={
              "btn btn-sm " +
              (saveState === "saved" ? "btn-success" : "btn-primary") +
              ((saving || !dirty) ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            {saving ? "Saving..." : saveState === "saved" ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
