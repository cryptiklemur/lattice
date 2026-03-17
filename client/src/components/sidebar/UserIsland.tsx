import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";

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
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1v1M8 14v1M1 8h1M14 8h1M3.05 3.05l.7.7M12.25 12.25l.7.7M12.25 3.75l-.7.7M3.75 12.25l-.7.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M8 10a2 2 0 100-4 2 2 0 000 4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.3 7a5.3 5.3 0 00-.1-1l1.1-.9a.3.3 0 000-.4l-1-1.7a.3.3 0 00-.4-.1l-1.3.5a5 5 0 00-.9-.5L10.5 1.7a.3.3 0 00-.3-.2H8.2a.3.3 0 00-.3.2L7.6 3a5 5 0 00-.9.5L5.4 3a.3.3 0 00-.4.1L4 4.8a.3.3 0 000 .4L5 6.1A5.3 5.3 0 005 7v.5l-1.1.8a.3.3 0 000 .4l1 1.7a.3.3 0 00.4.1l1.3-.5a5 5 0 00.9.5L7.8 12a.3.3 0 00.3.2h2a.3.3 0 00.3-.2l.3-1.5a5 5 0 00.9-.5l1.3.5a.3.3 0 00.4-.1l1-1.7a.3.3 0 000-.4L13.4 7.5A5.3 5.3 0 0013.3 7z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {settingsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={function () { setSettingsOpen(false); }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              minWidth: "320px",
              color: "var(--text-primary)",
            }}
            onClick={function (e) { e.stopPropagation(); }}
          >
            <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Settings</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Settings panel coming soon.</div>
            <button
              onClick={function () { setSettingsOpen(false); }}
              style={{
                marginTop: "20px",
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-overlay)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                transition: "background var(--transition-fast)",
              }}
              onMouseEnter={function (e) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--border-default)";
              }}
              onMouseLeave={function (e) {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
