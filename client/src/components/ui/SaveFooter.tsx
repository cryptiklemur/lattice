import type { SaveState } from "../../hooks/useSaveState";

interface SaveFooterProps {
  dirty: boolean;
  saving: boolean;
  saveState: SaveState;
  onSave: () => void;
  extraStatus?: string;
}

export function SaveFooter({ dirty, saving, saveState, onSave, extraStatus }: SaveFooterProps) {
  var disabled = saving || (!dirty && saveState !== "error");

  return (
    <div className="flex items-center justify-end gap-3">
      {extraStatus && (
        <div className="text-[11px] text-warning/70">{extraStatus}</div>
      )}
      {!extraStatus && dirty && saveState === "idle" && !saving && (
        <div className="text-[11px] text-warning/70">Unsaved changes</div>
      )}
      {saveState === "error" && (
        <div className="text-[11px] text-error">Save failed — try again</div>
      )}
      <button
        onClick={onSave}
        disabled={disabled}
        className={
          "btn btn-sm " +
          (saveState === "saved" ? "btn-success" : saveState === "error" ? "btn-error" : "btn-primary") +
          (disabled ? " opacity-50 cursor-not-allowed" : "")
        }
      >
        {saving ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Retry" : "Save Changes"}
      </button>
    </div>
  );
}
