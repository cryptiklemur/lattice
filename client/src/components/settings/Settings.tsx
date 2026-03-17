import { useState, useEffect, useCallback } from "react";
import { Clock, Palette, FileText, Terminal, Network, RefreshCw, Power, X } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { Status } from "./Status";
import { Appearance } from "./Appearance";
import { ClaudeSettings } from "./ClaudeSettings";
import { Environment } from "./Environment";
import { MeshStatus } from "./MeshStatus";

type Section = "status" | "appearance" | "claude" | "environment" | "mesh" | "restart" | "shutdown";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
}

var NAV_ITEMS: NavItem[] = [
  { id: "status", label: "Status", icon: <Clock size={14} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
  { id: "claude", label: "Claude Settings", icon: <FileText size={14} /> },
  { id: "environment", label: "Environment", icon: <Terminal size={14} /> },
  { id: "mesh", label: "Mesh", icon: <Network size={14} /> },
  { id: "restart", label: "Restart", icon: <RefreshCw size={14} /> },
  { id: "shutdown", label: "Shutdown", icon: <Power size={14} /> },
];

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

function RestartSection({ onClose }: { onClose: () => void }) {
  var { send } = useWebSocket();
  var [confirming, setConfirming] = useState(false);

  function handleRestart() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    send({ type: "settings:restart" });
    onClose();
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Restart Daemon
      </div>

      <div
        style={{
          padding: "16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-tertiary)",
          marginBottom: "20px",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500 }}>
          Restart the Lattice daemon
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          The daemon will restart immediately. Your browser will reconnect automatically.
          Active Claude sessions will be interrupted.
        </div>
      </div>

      <button
        onClick={handleRestart}
        style={{
          padding: "8px 18px",
          borderRadius: "var(--radius-sm)",
          border: confirming ? "1px solid var(--yellow)" : "1px solid var(--border-default)",
          background: confirming ? "var(--yellow)" : "var(--bg-overlay)",
          color: confirming ? "#000" : "var(--text-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all var(--transition-fast)",
          cursor: "pointer",
        }}
      >
        {confirming ? "Click again to confirm restart" : "Restart Daemon"}
      </button>

      {confirming && (
        <button
          onClick={function () { setConfirming(false); }}
          style={{
            marginLeft: "10px",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

function ShutdownSection({ onClose }: { onClose: () => void }) {
  var [confirming, setConfirming] = useState(false);

  function handleShutdown() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    fetch("/api/shutdown", { method: "POST" }).catch(function () {});
    onClose();
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Shutdown Daemon
      </div>

      <div
        style={{
          padding: "16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-tertiary)",
          marginBottom: "20px",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500 }}>
          Stop the Lattice daemon
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5" }}>
          All active sessions will be terminated. Run <code style={{ fontFamily: "var(--font-mono)", color: "var(--blue)" }}>lattice</code> to start it again.
        </div>
      </div>

      <button
        onClick={handleShutdown}
        style={{
          padding: "8px 18px",
          borderRadius: "var(--radius-sm)",
          border: confirming ? "1px solid var(--red)" : "1px solid var(--border-default)",
          background: confirming ? "var(--red)" : "var(--bg-overlay)",
          color: confirming ? "#fff" : "var(--text-secondary)",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all var(--transition-fast)",
          cursor: "pointer",
        }}
      >
        {confirming ? "Click again to confirm shutdown" : "Shutdown Daemon"}
      </button>

      {confirming && (
        <button
          onClick={function () { setConfirming(false); }}
          style={{
            marginLeft: "10px",
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

export function Settings(props: SettingsProps) {
  var [section, setSection] = useState<Section>("status");

  var handleKeyDown = useCallback(function (e: KeyboardEvent) {
    if (e.key === "Escape") {
      props.onClose();
    }
  }, [props.onClose]);

  useEffect(function () {
    if (!props.isOpen) {
      return;
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [props.isOpen, handleKeyDown]);

  if (!props.isOpen) {
    return null;
  }

  function renderContent() {
    if (section === "status") {
      return <Status />;
    }
    if (section === "appearance") {
      return <Appearance />;
    }
    if (section === "claude") {
      return <ClaudeSettings />;
    }
    if (section === "environment") {
      return <Environment />;
    }
    if (section === "mesh") {
      return <MeshStatus />;
    }
    if (section === "restart") {
      return <RestartSection onClose={props.onClose} />;
    }
    if (section === "shutdown") {
      return <ShutdownSection onClose={props.onClose} />;
    }
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "stretch",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          position: "absolute",
          inset: "5%",
          display: "flex",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-default)",
          background: "var(--bg-secondary)",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div
          style={{
            width: "200px",
            flexShrink: 0,
            borderRight: "1px solid var(--border-subtle)",
            background: "var(--bg-primary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 16px 12px",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-secondary)",
              letterSpacing: "0.04em",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            Settings
          </div>

          <nav style={{ flex: 1, overflow: "auto", padding: "8px 6px" }}>
            {NAV_ITEMS.map(function (item) {
              var active = section === item.id;
              var isDanger = item.id === "shutdown";
              return (
                <button
                  key={item.id}
                  onClick={function () { setSection(item.id); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--bg-overlay)" : "transparent",
                    color: active
                      ? "var(--text-primary)"
                      : isDanger
                      ? "var(--red)"
                      : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 400,
                    textAlign: "left",
                    marginBottom: "1px",
                    transition: "background var(--transition-fast), color var(--transition-fast)",
                  }}
                  onMouseEnter={function (e) {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
                    }
                  }}
                  onMouseLeave={function (e) {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }
                  }}
                >
                  <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 20px",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              {NAV_ITEMS.find(function (i) { return i.id === section; })?.label ?? "Settings"}
            </div>

            <button
              onClick={props.onClose}
              aria-label="Close settings"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-muted)",
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
              <X size={14} />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px 24px",
            }}
          >
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
