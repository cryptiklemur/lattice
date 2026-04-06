import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { X, Copy, Check } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMesh } from "../../hooks/useMesh";
import { useSaveState } from "../../hooks/useSaveState";
import { SaveFooter } from "../ui/SaveFooter";
import type { ServerMessage, SettingsDataMessage, LatticeConfig } from "#shared";

interface NodeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NodeSettingsModal({ isOpen, onClose }: NodeSettingsModalProps) {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { nodes } = useMesh();
  var save = useSaveState();

  var localNode = nodes.find(function (n) { return n.isLocal; });
  var nodeId = localNode ? localNode.id : "";

  var [config, setConfig] = useState<LatticeConfig | null>(null);
  var [name, setName] = useState("");
  var [port, setPort] = useState(7654);
  var [tls, setTls] = useState(false);
  var [debug, setDebug] = useState(false);
  var [copied, setCopied] = useState(false);
  var [wsl, setWsl] = useState<boolean | "auto">("auto");
  var copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  var modalRef = useRef<HTMLDivElement>(null);
  var stableOnClose = useCallback(function () { onClose(); }, [onClose]);
  useFocusTrap(modalRef, stableOnClose, isOpen);

  useEffect(function () {
    if (!isOpen) return;

    function handleData(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config;
      setConfig(cfg);

      if (save.saving) {
        save.confirmSave();
      } else {
        setName(cfg.name);
        setPort(cfg.port);
        setTls(cfg.tls);
        setDebug(cfg.debug);
        setWsl(cfg.wsl ?? "auto");
        save.resetFromServer();
      }
    }

    subscribe("settings:data", handleData);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleData);
    };
  }, [isOpen]);

  useEffect(function () {
    return function () {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  function handleSave() {
    save.startSave();
    send({
      type: "settings:update",
      settings: { name, port, tls, debug, wsl },
    } as any);
  }

  function handleCopyId() {
    if (!nodeId) return;
    navigator.clipboard.writeText(nodeId);
    setCopied(true);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(function () { setCopied(false); }, 2000);
  }

  if (!isOpen) return null;

  var inputClass = "w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]";

  return (
    <div ref={modalRef} className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Node Settings">
      <div className="absolute inset-0 bg-base-content/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15">
          <h2 className="text-[15px] font-mono font-bold text-base-content">Node Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label htmlFor="node-id" className="block text-[12px] font-semibold text-base-content/40 mb-1.5">Node ID</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 px-3 bg-base-300/50 border border-base-content/10 rounded-xl font-mono text-[11px] text-base-content/50 flex items-center truncate select-all">
                {nodeId || "Loading..."}
              </div>
              <button
                onClick={handleCopyId}
                disabled={!nodeId}
                aria-label="Copy node ID"
                className="btn btn-ghost btn-sm btn-square text-base-content/30 hover:text-base-content flex-shrink-0"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="node-name" className="block text-[12px] font-semibold text-base-content/40 mb-1.5">Node Name</label>
            <input
              id="node-name"
              type="text"
              value={name}
              onChange={function (e) { setName(e.target.value); save.markDirty(); }}
              placeholder="My Node"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="node-port" className="block text-[12px] font-semibold text-base-content/40 mb-1.5">Port</label>
            <input
              id="node-port"
              type="number"
              value={port}
              onChange={function (e) {
                var val = parseInt(e.target.value, 10);
                if (!isNaN(val)) { setPort(val); save.markDirty(); }
              }}
              min={1}
              max={65535}
              className={inputClass + " font-mono"}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-[12px] font-semibold text-base-content/40">TLS</div>
              <div className="text-[11px] text-base-content/30">Encrypt connections between nodes</div>
            </div>
            <input
              type="checkbox"
              checked={tls}
              onChange={function (e) { setTls(e.target.checked); save.markDirty(); }}
              className="toggle toggle-sm toggle-primary"
              aria-label="Enable TLS"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-[12px] font-semibold text-base-content/40">Debug Mode</div>
              <div className="text-[11px] text-base-content/30">Enable verbose logging</div>
            </div>
            <input
              type="checkbox"
              checked={debug}
              onChange={function (e) { setDebug(e.target.checked); save.markDirty(); }}
              className="toggle toggle-sm toggle-primary"
              aria-label="Enable debug mode"
            />
          </div>

          <div>
            <div className="text-[12px] font-semibold text-base-content/40 mb-1.5">WSL Mode</div>
            <div className="text-[11px] text-base-content/30 mb-2">Convert file paths for Windows editors when running under WSL</div>
            <select
              value={String(wsl)}
              onChange={function (e) {
                var val = e.target.value;
                if (val === "true") { setWsl(true); }
                else if (val === "false") { setWsl(false); }
                else { setWsl("auto"); }
                save.markDirty();
              }}
              className={inputClass}
            >
              <option value="auto">Auto-detect</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-base-content/15">
          <SaveFooter dirty={save.dirty} saving={save.saving} saveState={save.saveState} onSave={handleSave} />
        </div>
      </div>
    </div>
  );
}
