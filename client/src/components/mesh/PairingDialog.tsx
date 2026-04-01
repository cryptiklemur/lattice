import { useState, useEffect, useCallback, useRef, memo } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useMesh } from "../../hooks/useMesh";
import { clearInvite } from "../../stores/mesh";
import type { ServerMessage } from "@lattice/shared";

type Tab = "generate" | "enter";
type PairStatus = "idle" | "connecting" | "paired" | "failed";

interface PairingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export var PairingDialog = memo(function PairingDialog(props: PairingDialogProps) {
  var ws = useWebSocket();
  var mesh = useMesh();
  var [tab, setTab] = useState<Tab>("generate");
  var [pairCode, setPairCode] = useState("");
  var [pairStatus, setPairStatus] = useState<PairStatus>("idle");
  var [pairError, setPairError] = useState<string | null>(null);
  var [copied, setCopied] = useState(false);
  var [generating, setGenerating] = useState(false);
  var [addresses, setAddresses] = useState<Array<{ name: string; address: string }>>([]);
  var [selectedAddress, setSelectedAddress] = useState("");
  var modalRef = useRef<HTMLDivElement>(null);
  var inputRef = useRef<HTMLInputElement>(null);
  var pairTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    if (!props.isOpen) {
      clearInvite();
      setPairCode("");
      setPairStatus("idle");
      setPairError(null);
      setCopied(false);
      setGenerating(false);
      setAddresses([]);
      setSelectedAddress("");
      setTab("generate");
      if (pairTimeoutRef.current) { clearTimeout(pairTimeoutRef.current); pairTimeoutRef.current = null; }
      return;
    }

    function handleAddresses(msg: ServerMessage) {
      if ((msg as any).type !== "mesh:addresses_result") return;
      var data = msg as any as { addresses: Array<{ name: string; address: string }> };
      setAddresses(data.addresses);
      if (data.addresses.length > 0) {
        setSelectedAddress(data.addresses[0].address);
      }
    }

    ws.subscribe("mesh:addresses_result", handleAddresses);
    ws.send({ type: "mesh:addresses" } as any);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () {
      document.removeEventListener("keydown", handleKeyDown);
      ws.unsubscribe("mesh:addresses_result", handleAddresses);
    };
  }, [props.isOpen]);

  useEffect(function () {
    function handleInvite(msg: ServerMessage) {
      if (msg.type === "mesh:invite_code") {
        setGenerating(false);
      }
    }

    function handlePaired(msg: ServerMessage) {
      if (msg.type === "mesh:paired") {
        setPairStatus("paired");
        setPairError(null);
        setTimeout(function () { props.onClose(); }, 3000);
      }
    }

    function handlePairFailed(msg: ServerMessage) {
      if (msg.type !== "mesh:pair_failed") return;
      var data = msg as { type: string; message: string };
      setPairStatus("failed");
      setPairError(data.message);
    }

    ws.subscribe("mesh:invite_code", handleInvite);
    ws.subscribe("mesh:paired", handlePaired);
    ws.subscribe("mesh:pair_failed", handlePairFailed);
    return function () {
      ws.unsubscribe("mesh:invite_code", handleInvite);
      ws.unsubscribe("mesh:paired", handlePaired);
      ws.unsubscribe("mesh:pair_failed", handlePairFailed);
    };
  }, []);

  function handleGenerateInvite() {
    clearInvite();
    setGenerating(true);
    ws.send({ type: "mesh:generate_invite", address: selectedAddress } as any);
  }

  function handlePair() {
    var trimmed = pairCode.trim();
    if (!trimmed) {
      return;
    }
    setPairStatus("connecting");
    setPairError(null);

    if (pairTimeoutRef.current) clearTimeout(pairTimeoutRef.current);
    pairTimeoutRef.current = setTimeout(function () {
      setPairStatus(function (prev) {
        if (prev === "connecting") {
          setPairError("Pairing timed out. Check the code and try again.");
          return "failed";
        }
        return prev;
      });
    }, 30000);

    ws.send({ type: "mesh:pair", code: trimmed });
  }

  function handleCopyCode() {
    if (!mesh.inviteCode) {
      return;
    }
    navigator.clipboard.writeText(mesh.inviteCode).then(function () {
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2000);
    });
  }

  if (!props.isOpen) {
    return null;
  }

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pair a node"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <div
        className="w-[440px] max-w-[calc(100vw-24px)] rounded-xl border border-base-300 bg-base-200 overflow-hidden shadow-2xl"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div className="text-[14px] font-semibold text-base-content">Pair a Node</div>
          <button
            onClick={props.onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex border-b border-base-300">
          {(["generate", "enter"] as Tab[]).map(function (t) {
            var label = t === "generate" ? "Generate Invite" : "Enter Code";
            var isActive = tab === t;
            return (
              <button
                key={t}
                onClick={function () { setTab(t); }}
                className={
                  "flex-1 px-4 py-2.5 text-[13px] cursor-pointer transition-colors duration-[120ms] border-b-2 " +
                  (isActive
                    ? "font-semibold text-base-content border-primary"
                    : "font-normal text-base-content/40 border-transparent hover:text-base-content/70")
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {tab === "generate" && (
            <div>
              <div className="text-[12px] text-base-content/40 mb-4 leading-relaxed">
                Generate an invite code on this machine and share it with the other node.
                The code encodes this node&apos;s address and a one-time auth token.
              </div>

              {!mesh.inviteCode && !generating && addresses.length > 1 && (
                <div className="mb-3">
                  <label className="text-[11px] font-mono text-base-content/35 uppercase tracking-wider mb-1.5 block">
                    Network interface
                  </label>
                  <select
                    value={selectedAddress}
                    onChange={function (e) { setSelectedAddress(e.target.value); }}
                    className="select select-bordered select-sm w-full bg-base-100 text-base-content text-[13px] font-mono"
                  >
                    {addresses.map(function (a) {
                      return (
                        <option key={a.address} value={a.address}>
                          {a.address} ({a.name})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {!mesh.inviteCode && !generating && (
                <button
                  onClick={handleGenerateInvite}
                  disabled={!selectedAddress && addresses.length > 0}
                  className="btn btn-primary btn-sm"
                >
                  Generate Invite Code
                </button>
              )}

              {generating && !mesh.inviteCode && (
                <div className="flex items-center gap-2 text-[13px] text-base-content/40">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  Generating invite code...
                </div>
              )}

              {mesh.inviteCode && (
                <div>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded bg-base-100 border border-base-300 mb-4">
                    <code className="flex-1 font-mono text-[14px] font-semibold text-base-content tracking-[0.08em] break-all">
                      {mesh.inviteCode}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      title="Copy code"
                      className={
                        "btn btn-xs gap-1 flex-shrink-0 " +
                        (copied ? "btn-success" : "btn-ghost border border-base-300")
                      }
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  <button
                    onClick={handleGenerateInvite}
                    className="text-[12px] text-base-content/40 underline cursor-pointer"
                  >
                    Generate new code
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "enter" && (
            <div>
              <div className="text-[12px] text-base-content/40 mb-4 leading-relaxed">
                Paste the invite code generated on the other node to pair with it.
              </div>

              <input
                ref={inputRef}
                type="text"
                value={pairCode}
                onChange={function (e) {
                  var raw = e.target.value.replace(/[^A-Za-z0-9]/g, "");
                  var upper = raw.toUpperCase();
                  if (upper.startsWith("LTCE")) raw = raw.slice(4);
                  if (raw.length > 16) raw = raw.slice(0, 16);
                  var chunks: string[] = [];
                  for (var i = 0; i < raw.length; i += 4) {
                    chunks.push(raw.slice(i, i + 4));
                  }
                  var formatted = chunks.length > 0 ? "LTCE-" + chunks.join("-") : "";
                  setPairCode(formatted);
                  if (pairStatus !== "idle") {
                    setPairStatus("idle");
                    setPairError(null);
                  }
                }}
                onKeyDown={function (e) {
                  if (e.key === "Enter") {
                    handlePair();
                  }
                }}
                placeholder="LTCE-XXXX-XXXX-XXXX-XXXX"
                maxLength={24}
                autoFocus
                disabled={pairStatus === "connecting" || pairStatus === "paired"}
                className="input input-bordered w-full bg-base-100 text-base-content font-mono text-[14px] tracking-[0.06em] mb-3 focus:border-primary"
              />

              {pairStatus === "idle" && (
                <button
                  onClick={handlePair}
                  disabled={!pairCode.trim()}
                  className={
                    "btn btn-sm " +
                    (pairCode.trim() ? "btn-primary" : "btn-ghost border border-base-300 cursor-not-allowed")
                  }
                >
                  Pair
                </button>
              )}

              {pairStatus === "connecting" && (
                <div className="flex items-center gap-2 text-[13px] text-base-content/40">
                  <span
                    className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent inline-block"
                    style={{ animation: "spin 0.6s linear infinite" }}
                  />
                  Connecting...
                </div>
              )}

              {pairStatus === "paired" && (
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                  <Check size={14} />
                  Paired successfully!
                </div>
              )}

              {pairStatus === "failed" && pairError && (
                <div className="text-[12px] text-error mt-2">{pairError}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
