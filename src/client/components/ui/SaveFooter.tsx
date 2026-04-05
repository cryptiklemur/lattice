import { useEffect, useRef } from "react";
import { Loader2, Check, X } from "lucide-react";
import type { SaveState } from "../../hooks/useSaveState";
import { showToast } from "./Toast";

interface SaveFooterProps {
  dirty: boolean;
  saving: boolean;
  saveState: SaveState;
  onSave: () => void;
  extraStatus?: string;
}

export function SaveFooter({ dirty, saving, saveState, onSave, extraStatus }: SaveFooterProps) {
  var disabled = saving || (!dirty && saveState !== "error");
  var prevStateRef = useRef<SaveState>("idle");

  useEffect(function () {
    if (prevStateRef.current !== saveState) {
      if (saveState === "saved") {
        showToast("Settings saved", "info");
      } else if (saveState === "error") {
        showToast("Failed to save settings — server did not respond within 5 seconds", "error");
      }
      prevStateRef.current = saveState;
    }
  }, [saveState]);

  return (
    <div className="flex items-center justify-end gap-3">
      {extraStatus && (
        <div className="text-[11px] text-warning/70">{extraStatus}</div>
      )}
      {!extraStatus && dirty && saveState === "idle" && !saving && (
        <div className="text-[11px] text-warning/70">Unsaved changes</div>
      )}
      {saveState === "error" && (
        <div className="flex items-center gap-1.5 text-[11px] text-error">
          <X size={11} />
          Save failed — server did not respond
        </div>
      )}
      {saveState === "saved" && (
        <div className="flex items-center gap-1.5 text-[11px] text-success/70">
          <Check size={11} />
          Saved
        </div>
      )}
      <button
        onClick={onSave}
        disabled={disabled}
        className={
          "btn btn-sm gap-1.5 " +
          (saveState === "saved" ? "btn-success" : saveState === "error" ? "btn-error" : "btn-primary") +
          (disabled ? " opacity-50 cursor-not-allowed" : "")
        }
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        {saving ? "Saving..." : saveState === "error" ? "Retry" : "Save Changes"}
      </button>
    </div>
  );
}
