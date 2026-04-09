import { useState, useRef, useEffect } from "react";

export type SaveState = "idle" | "saved" | "error";

export interface UseSaveStateReturn {
  dirty: boolean;
  saving: boolean;
  savingRef: React.RefObject<boolean>;
  saveState: SaveState;
  markDirty: () => void;
  startSave: () => void;
  confirmSave: () => void;
  resetFromServer: () => void;
}

export function useSaveState(): UseSaveStateReturn {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

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
    savingRef.current = true;
    setSaveState("idle");

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(function () {
      setSaving(false);
      savingRef.current = false;
      setSaveState("error");
      setTimeout(function () { setSaveState("idle"); }, 3000);
    }, 5000);
  }

  function confirmSave() {
    setSaving(false);
    savingRef.current = false;
    setSaveState("saved");
    setDirty(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(function () { setSaveState("idle"); }, 1800);
  }

  function resetFromServer() {
    setDirty(false);
    setSaveState("idle");
    setSaving(false);
    savingRef.current = false;
  }

  return { dirty, saving, savingRef, saveState, markDirty, startSave, confirmSave, resetFromServer };
}
