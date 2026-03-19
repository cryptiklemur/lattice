import { useRef } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import pkg from "../../../package.json";

interface UserIslandProps {
  nodeName: string;
  onClick: () => void;
}

export function UserIsland(props: UserIslandProps) {
  var { mode, toggleMode } = useTheme();
  var containerRef = useRef<HTMLDivElement>(null);

  var initial = props.nodeName.charAt(0).toUpperCase();

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="User controls"
      className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-base-300/30 transition-colors"
      onClick={props.onClick}
      onKeyDown={function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
      tabIndex={0}
    >
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
          {"v" + pkg.version}
        </div>
      </div>

      <button
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={function (e) { e.stopPropagation(); toggleMode(); }}
        className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content flex-shrink-0"
      >
        {mode === "dark" ? (
          <Sun size={14} />
        ) : (
          <Moon size={14} />
        )}
      </button>
    </div>
  );
}
