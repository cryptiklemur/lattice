import { useState, useEffect, useCallback } from "react";
import { X, Copy, Check } from "lucide-react";
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


export function PairingDialog(props: PairingDialogProps) {
  var ws = useWebSocket();
  var mesh = useMesh();
  var [tab, setTab] = useState<Tab>("generate");
  var [pairCode, setPairCode] = useState("");
  var [pairStatus, setPairStatus] = useState<PairStatus>("idle");
  var [pairError, setPairError] = useState<string | null>(null);
  var [copied, setCopied] = useState(false);

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

  useEffect(function () {
    if (!props.isOpen) {
      clearInvite();
      setPairCode("");
      setPairStatus("idle");
      setPairError(null);
      setCopied(false);
      setTab("generate");
    }
  }, [props.isOpen]);

  useEffect(function () {
    if (pairStatus !== "connecting") {
      return;
    }

    function handler(msg: ServerMessage) {
      if (msg.type === "mesh:paired") {
        setPairStatus("paired");
        setPairError(null);
      }
    }

    ws.subscribe("mesh:paired", handler);
    return function () {
      ws.unsubscribe("mesh:paired", handler);
    };
  }, [ws, pairStatus]);

  function handleGenerateInvite() {
    clearInvite();
    mesh.generateInvite();
  }

  function handlePair() {
    var trimmed = pairCode.trim();
    if (!trimmed) {
      return;
    }
    setPairStatus("connecting");
    setPairError(null);

    var timeout = setTimeout(function () {
      setPairStatus(function (prev) {
        if (prev === "connecting") {
          setPairError("Pairing timed out. Check the code and try again.");
          return "failed";
        }
        return prev;
      });
    }, 30000);

    ws.send({ type: "mesh:pair", code: trimmed });

    return function () {
      clearTimeout(timeout);
    };
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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: "440px",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
            Pair a Node
          </div>
          <button
            onClick={props.onClose}
            aria-label="Close"
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
            display: "flex",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {(["generate", "enter"] as Tab[]).map(function (t) {
            var label = t === "generate" ? "Generate Invite" : "Enter Code";
            var isActive = tab === t;
            return (
              <button
                key={t}
                onClick={function () { setTab(t); }}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "color var(--transition-fast)",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "20px" }}>
          {tab === "generate" && (
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.5" }}>
                Generate an invite code on this machine and share it with the other node.
                The code encodes this node&apos;s address and a one-time auth token.
              </div>

              {!mesh.inviteCode && (
                <button
                  onClick={handleGenerateInvite}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--accent)",
                    background: "var(--accent)",
                    color: "var(--accent-fg, #fff)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity var(--transition-fast)",
                  }}
                  onMouseEnter={function (e) {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
                  }}
                  onMouseLeave={function (e) {
                    (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                  }}
                >
                  Generate Invite Code
                </button>
              )}

              {mesh.inviteCode && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-default)",
                      marginBottom: "16px",
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-mono)",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        letterSpacing: "0.08em",
                        wordBreak: "break-all",
                      }}
                    >
                      {mesh.inviteCode}
                    </code>
                    <button
                      onClick={handleCopyCode}
                      title="Copy code"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        background: copied ? "var(--green)" : "var(--bg-overlay)",
                        color: copied ? "#fff" : "var(--text-muted)",
                        fontSize: "11px",
                        cursor: "pointer",
                        transition: "background var(--transition-fast), color var(--transition-fast)",
                        flexShrink: 0,
                      }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {mesh.inviteQr && (
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                      <img
                        src={mesh.inviteQr}
                        alt="QR code for invite"
                        style={{
                          width: "160px",
                          height: "160px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                          imageRendering: "pixelated",
                        }}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleGenerateInvite}
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Generate new code
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "enter" && (
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.5" }}>
                Paste the invite code generated on the other node to pair with it.
              </div>

              <input
                type="text"
                value={pairCode}
                onChange={function (e) {
                  setPairCode(e.target.value);
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
                placeholder="LTCE-XXXX-XXXX"
                disabled={pairStatus === "connecting" || pairStatus === "paired"}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  letterSpacing: "0.06em",
                  marginBottom: "12px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
                onFocus={function (e) {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={function (e) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                }}
              />

              {pairStatus === "idle" && (
                <button
                  onClick={handlePair}
                  disabled={!pairCode.trim()}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--accent)",
                    background: pairCode.trim() ? "var(--accent)" : "var(--bg-overlay)",
                    color: pairCode.trim() ? "var(--accent-fg, #fff)" : "var(--text-muted)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: pairCode.trim() ? "pointer" : "not-allowed",
                    transition: "background var(--transition-fast), color var(--transition-fast)",
                  }}
                >
                  Pair
                </button>
              )}

              {pairStatus === "connecting" && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      border: "2px solid var(--accent)",
                      borderTopColor: "transparent",
                      display: "inline-block",
                      animation: "spin 0.6s linear infinite",
                    }}
                  />
                  Connecting...
                </div>
              )}

              {pairStatus === "paired" && (
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--green)",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Check size={14} />
                  Paired successfully!
                </div>
              )}

              {pairStatus === "failed" && pairError && (
                <div style={{ fontSize: "12px", color: "var(--red)", marginTop: "8px" }}>
                  {pairError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
