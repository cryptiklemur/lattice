import { useState, useEffect, useRef } from "react";
import { IconPicker } from "../ui/IconPicker";
import type { ProjectSettings, ProjectIcon } from "@lattice/shared";

interface ProjectGeneralProps {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}

export function ProjectGeneral({ settings, updateSection }: ProjectGeneralProps) {
  var [title, setTitle] = useState(settings.title);
  var [icon, setIcon] = useState<ProjectIcon | undefined>(settings.icon);
  var [dirty, setDirty] = useState(false);
  var [saving, setSaving] = useState(false);
  var [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  var saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    if (saving) {
      setSaving(false);
      setSaveState("saved");
      setDirty(false);
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(function () { setSaveState("idle"); }, 1800);
    } else {
      setTitle(settings.title);
      setIcon(settings.icon);
      setDirty(false);
    }
  }, [settings]);

  useEffect(function () {
    return function () {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    markDirty();
  }

  function handleIconChange(value: ProjectIcon) {
    setIcon(value);
    markDirty();
  }

  function handleSave() {
    setSaving(true);
    setSaveState("idle");
    updateSection("general", { title, icon });

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(function () {
      if (saving) {
        setSaving(false);
        setSaveState("error");
        setTimeout(function () { setSaveState("idle"); }, 3000);
      }
    }, 5000);
  }

  return (
    <div className="py-2">
      <div className="mb-5">
        <label htmlFor="project-title" className="block text-[12px] font-semibold text-base-content/40 mb-2 font-mono">
          Display Name
        </label>
        <input
          id="project-title"
          type="text"
          value={title}
          onChange={function (e) { handleTitleChange(e.target.value); }}
          className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        />
      </div>

      <div className="mb-5">
        <div className="block text-[12px] font-semibold text-base-content/40 mb-2 font-mono">
          Icon
        </div>
        <IconPicker value={icon} onChange={handleIconChange} />
      </div>

      <div className="mb-6">
        <div className="block text-[12px] font-semibold text-base-content/40 mb-2 font-mono">
          Project Path
        </div>
        <div className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content/60 text-[12px] font-mono flex items-center select-all">
          {settings.path}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && saveState === "idle" && !saving && (
          <div className="text-[11px] text-warning/70">Unsaved changes</div>
        )}
        {saveState === "error" && (
          <div className="text-[11px] text-error">Save failed — try again</div>
        )}
        <button
          onClick={handleSave}
          disabled={saving || (!dirty && saveState !== "error")}
          className={
            "btn btn-sm " +
            (saveState === "saved" ? "btn-success" : saveState === "error" ? "btn-error" : "btn-primary") +
            ((saving || (!dirty && saveState !== "error")) ? " opacity-50 cursor-not-allowed" : "")
          }
        >
          {saving ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Retry" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
