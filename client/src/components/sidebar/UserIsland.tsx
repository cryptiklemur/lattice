import { useState } from "react";
import { Sun, Moon, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { Settings } from "../settings/Settings";

interface UserIslandProps {
  nodeName: string;
  onSettingsClick: () => void;
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var [settingsOpen, setSettingsOpen] = useState(false);

  function handleSettingsClick() {
    setSettingsOpen(true);
    props.onSettingsClick();
  }

  var initial = props.nodeName.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="avatar placeholder flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-content text-[12px] font-bold flex items-center justify-center">
          <span>{initial}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-base-content truncate">
          {props.nodeName}
        </div>
        <div className="text-[11px] text-base-content/40">
          v0.0.1
        </div>
      </div>

      <button
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggleMode}
        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content flex-shrink-0"
      >
        {mode === "dark" ? (
          <Sun size={14} />
        ) : (
          <Moon size={14} />
        )}
      </button>

      <button
        aria-label="Settings"
        onClick={handleSettingsClick}
        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content flex-shrink-0"
      >
        <SettingsIcon size={14} />
      </button>

      <Settings isOpen={settingsOpen} onClose={function () { setSettingsOpen(false); }} />
    </div>
  );
}
