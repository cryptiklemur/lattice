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
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Restart Daemon
      </div>

      <div className="p-4 rounded-md border border-base-300 bg-base-300 mb-5">
        <div className="text-[13px] text-base-content font-medium mb-2">
          Restart the Lattice daemon
        </div>
        <div className="text-[12px] text-base-content/50 leading-relaxed">
          The daemon will restart immediately. Your browser will reconnect automatically.
          Active Claude sessions will be interrupted.
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={handleRestart}
          className={
            "btn btn-sm " +
            (confirming ? "btn-warning" : "btn-ghost border border-base-300")
          }
        >
          {confirming ? "Click again to confirm restart" : "Restart Daemon"}
        </button>

        {confirming && (
          <button
            onClick={function () { setConfirming(false); }}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
        )}
      </div>
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
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Shutdown Daemon
      </div>

      <div className="p-4 rounded-md border border-base-300 bg-base-300 mb-5">
        <div className="text-[13px] text-base-content font-medium mb-2">
          Stop the Lattice daemon
        </div>
        <div className="text-[12px] text-base-content/50 leading-relaxed">
          All active sessions will be terminated. Run{" "}
          <code className="font-mono text-info">lattice</code> to start it again.
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={handleShutdown}
          className={
            "btn btn-sm " +
            (confirming ? "btn-error" : "btn-ghost border border-base-300")
          }
        >
          {confirming ? "Click again to confirm shutdown" : "Shutdown Daemon"}
        </button>

        {confirming && (
          <button
            onClick={function () { setConfirming(false); }}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
        )}
      </div>
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
      className="fixed inset-0 z-[9999] flex items-stretch bg-black/60 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        className="absolute inset-[5%] flex rounded-xl border border-base-300 bg-base-200 overflow-hidden shadow-2xl"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="w-[200px] flex-shrink-0 border-r border-base-300 bg-base-100 flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 text-[13px] font-bold text-base-content/60 tracking-[0.04em] border-b border-base-300 flex-shrink-0">
            Settings
          </div>

          <nav className="flex-1 overflow-auto p-2">
            {NAV_ITEMS.map(function (item) {
              var active = section === item.id;
              var isDanger = item.id === "shutdown";
              return (
                <button
                  key={item.id}
                  onClick={function () { setSection(item.id); }}
                  className={
                    "w-full flex items-center gap-2 px-2.5 py-[7px] rounded text-[13px] text-left mb-px transition-colors duration-[120ms] cursor-pointer " +
                    (active
                      ? "bg-base-300 text-base-content font-semibold"
                      : isDanger
                      ? "text-error hover:bg-base-200"
                      : "text-base-content/60 hover:bg-base-200 hover:text-base-content")
                  }
                >
                  <span className={active ? "opacity-100" : "opacity-70"}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 flex items-center justify-between px-5 border-b border-base-300 flex-shrink-0">
            <div className="text-[14px] font-semibold text-base-content">
              {NAV_ITEMS.find(function (i) { return i.id === section; })?.label ?? "Settings"}
            </div>

            <button
              onClick={props.onClose}
              aria-label="Close settings"
              className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-auto px-6 py-5">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
