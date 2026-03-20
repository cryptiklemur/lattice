import { Sun, Moon, Settings, Download } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useSidebar } from "../../hooks/useSidebar";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import pkg from "../../../package.json";

interface UserIslandProps {
  nodeName: string;
  onClick: () => void;
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var sidebar = useSidebar();
  var { canInstall, install } = useInstallPrompt();

  var initial = props.nodeName.charAt(0).toUpperCase();

  return (
    <div
      role="group"
      aria-label="User controls"
      className="flex items-center gap-2 px-3 py-2"
    >
      <button
        onClick={props.onClick}
        className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-1 py-1 -mx-1 hover:bg-base-content/5 transition-colors duration-[120ms] cursor-pointer"
        aria-label="Node info"
      >
        <div className="w-7 h-7 rounded-full bg-primary text-primary-content text-[12px] font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[13px] font-semibold text-base-content truncate">
            {props.nodeName}
          </div>
          <div className="text-[10px] text-base-content/30 font-mono">
            {"v" + pkg.version}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {canInstall && (
          <button
            aria-label="Install Lattice"
            onClick={install}
            className="btn btn-ghost btn-xs btn-square text-primary/60 hover:text-primary transition-colors"
          >
            <Download size={14} />
          </button>
        )}
        <button
          aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={function (e) { e.stopPropagation(); toggleMode(); }}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors"
        >
          {mode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button
          aria-label="Global settings"
          onClick={function () { sidebar.openSettings("appearance"); }}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content transition-colors"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
