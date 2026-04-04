import { useState, useEffect } from "react";
import { IconPicker } from "../ui/IconPicker";
import { SaveFooter } from "../ui/SaveFooter";
import { useSaveState } from "../../hooks/useSaveState";
import type { ProjectSettings, ProjectIcon } from "@lattice/shared";

interface ProjectGeneralProps {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}

export function ProjectGeneral({ settings, updateSection }: ProjectGeneralProps) {
  var [title, setTitle] = useState(settings.title);
  var [icon, setIcon] = useState<ProjectIcon | undefined>(settings.icon);
  var save = useSaveState();

  useEffect(function () {
    if (save.savingRef.current) {
      save.confirmSave();
    } else {
      setTitle(settings.title);
      setIcon(settings.icon);
      save.resetFromServer();
    }
  }, [settings]);

  function handleTitleChange(value: string) {
    setTitle(value);
    save.markDirty();
  }

  function handleIconChange(value: ProjectIcon) {
    setIcon(value);
    save.markDirty();
  }

  function handleSave() {
    save.startSave();
    updateSection("general", { title, icon });
  }

  return (
    <div className="py-2">
      <div className="mb-5">
        <label htmlFor="project-title" className="block text-[12px] font-semibold text-base-content/40 mb-2">
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
        <div className="block text-[12px] font-semibold text-base-content/40 mb-2">
          Icon
        </div>
        <IconPicker value={icon} onChange={handleIconChange} />
      </div>

      <div className="mb-6">
        <div className="block text-[12px] font-semibold text-base-content/40 mb-2">
          Project Path
        </div>
        <div className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content/60 text-[12px] font-mono flex items-center select-all">
          {settings.path}
        </div>
      </div>

      <SaveFooter dirty={save.dirty} saving={save.saving} saveState={save.saveState} onSave={handleSave} />
    </div>
  );
}
