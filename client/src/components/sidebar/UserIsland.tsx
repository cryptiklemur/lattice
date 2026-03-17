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
    <div
      style={{
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "var(--accent-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          fontFamily: "var(--font-ui)",
        }}
      >
        {initial}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {props.nodeName}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          v0.0.1
        </div>
      </div>

      <button
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggleMode}
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          flexShrink: 0,
          transition: "color var(--transition-fast), background var(--transition-fast)",
        }}
        onMouseEnter={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
        }}
        onMouseLeave={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
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
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          flexShrink: 0,
          transition: "color var(--transition-fast), background var(--transition-fast)",
        }}
        onMouseEnter={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
        }}
        onMouseLeave={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
      >
        <SettingsIcon size={14} />
      </button>

      <Settings isOpen={settingsOpen} onClose={function () { setSettingsOpen(false); }} />
    </div>
  );
}
