import { useState, useRef, useEffect } from "react";

export type SaveState = "idle" | "saved" | "error";

export interface UseSaveStateReturn {
  dirty: boolean;
  saving: boolean;
  saveState: SaveState;
  markDirty: () => void;
  startSave: () => void;
  confirmSave: () => void;
  resetFromServer: () => void;
}

export function useSaveState(): UseSaveStateReturn {
  var [dirty, setDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [saveState, setSaveState] = useState<SaveState>("idle");
  var saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    return function () {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function startSave() {
    setSaving(true);
    setSaveState("idle");

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(function () {
      setSaving(false);
      setSaveState("error");
      setTimeout(function () { setSaveState("idle"); }, 3000);
    }, 5000);
  }

  function confirmSave() {
    setSaving(false);
    setSaveState("saved");
    setDirty(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(function () { setSaveState("idle"); }, 1800);
  }

  function resetFromServer() {
    setDirty(false);
    setSaveState("idle");
    setSaving(false);
  }

  return { dirty, saving, saveState, markDirty, startSave, confirmSave, resetFromServer };
}
