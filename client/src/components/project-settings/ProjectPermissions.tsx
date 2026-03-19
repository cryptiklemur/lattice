import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { ProjectSettings } from "@lattice/shared";

function RuleList({
  rules,
  onDelete,
  readOnly,
}: {
  rules: string[];
  onDelete?: (index: number) => void;
  readOnly?: boolean;
}) {
  if (rules.length === 0) {
    return (
      <div className="py-3 text-center text-[13px] text-base-content/30">
        No rules defined.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rules.map(function (rule, idx) {
        return (
          <div
            key={idx}
            className={
              "flex items-center gap-2 h-9 sm:h-7 px-3 rounded-xl border font-mono text-[12px] " +
              (readOnly
                ? "bg-base-300/50 border-base-content/10 text-base-content/40"
                : "bg-base-300 border-base-content/15 text-base-content")
            }
          >
            <span className="flex-1 truncate">{rule}</span>
            {readOnly && (
              <span className="text-[10px] uppercase tracking-wider text-base-content/30 flex-shrink-0">
                global
              </span>
            )}
            {!readOnly && onDelete && (
              <button
                onClick={function () { onDelete(idx); }}
                aria-label={"Delete rule: " + rule}
                title="Delete"
                className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddRuleRow({ onAdd }: { onAdd: (rule: string) => void }) {
  var [value, setValue] = useState("");

  function handleAdd() {
    var trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <input
        type="text"
        value={value}
        onChange={function (e) { setValue(e.target.value); }}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Bash(curl:*)"
        className="flex-1 h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
      />
      <button
        onClick={handleAdd}
        disabled={!value.trim()}
        className={
          "flex items-center gap-1.5 px-3 h-9 sm:h-7 rounded-xl border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] cursor-pointer focus-visible:ring-2 focus-visible:ring-primary" +
          (!value.trim() ? " opacity-50 cursor-not-allowed" : "")
        }
      >
        <Plus size={12} />
        Add
      </button>
    </div>
  );
}

export function ProjectPermissions({
  settings,
  updateSection,
}: {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}) {
  var [allow, setAllow] = useState<string[]>(function () {
    return [...(settings.permissions.allow ?? [])];
  });
  var [deny, setDeny] = useState<string[]>(function () {
    return [...(settings.permissions.deny ?? [])];
  });
  var [dirty, setDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function handleDeleteAllow(idx: number) {
    setAllow(function (prev) {
      var next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    markDirty();
  }

  function handleDeleteDeny(idx: number) {
    setDeny(function (prev) {
      var next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    markDirty();
  }

  function handleAddAllow(rule: string) {
    setAllow(function (prev) { return [...prev, rule]; });
    markDirty();
  }

  function handleAddDeny(rule: string) {
    setDeny(function (prev) { return [...prev, rule]; });
    markDirty();
  }

  function handleSave() {
    setSaving(true);
    updateSection("permissions", { allow, deny });
    setSaving(false);
    setSaveState("saved");
    setDirty(false);
    setTimeout(function () { setSaveState("idle"); }, 1800);
  }

  var globalAllow = settings.global.permissions?.allow ?? [];
  var globalDeny = settings.global.permissions?.deny ?? [];

  return (
    <div className="py-2">
      <div className="mb-6">
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Allow Rules
        </h2>
        <RuleList rules={allow} onDelete={handleDeleteAllow} />
        <AddRuleRow onAdd={handleAddAllow} />
      </div>

      <div className="mb-6">
        <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
          Deny Rules
        </h2>
        <RuleList rules={deny} onDelete={handleDeleteDeny} />
        <AddRuleRow onAdd={handleAddDeny} />
      </div>

      <div className="flex items-center justify-end gap-3 mb-8">
        {dirty && saveState === "idle" && !saving && (
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

      {(globalAllow.length > 0 || globalDeny.length > 0) && (
        <div>
          <h2 className="text-[13px] font-mono font-semibold text-base-content/60 uppercase tracking-wider mb-3">
            Global Permissions
          </h2>
          {globalAllow.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5">Allow</div>
              <RuleList rules={globalAllow} readOnly />
            </div>
          )}
          {globalDeny.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5">Deny</div>
              <RuleList rules={globalDeny} readOnly />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
