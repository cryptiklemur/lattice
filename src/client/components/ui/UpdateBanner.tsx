import { useState, useEffect } from "react";
import { ArrowUpCircle, X, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage } from "#shared";

interface UpdateState {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export function UpdateBanner() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(function () {
    function handleStatus(msg: ServerMessage) {
      if (msg.type !== "update:status") return;
      const data = msg as UpdateState & { type: string };
      setUpdate({ currentVersion: data.currentVersion, latestVersion: data.latestVersion, updateAvailable: data.updateAvailable, releaseUrl: data.releaseUrl });
      if (data.updateAvailable) setDismissed(false);
    }

    function handleApplyResult(msg: ServerMessage) {
      if (msg.type !== "update:apply_result") return;
      const data = msg as { type: string; success: boolean; message?: string };
      setApplying(false);
      setApplyResult({ success: data.success, message: data.message ?? "" });
    }

    subscribe("update:status", handleStatus);
    subscribe("update:apply_result", handleApplyResult);
    send({ type: "update:check" } as any);

    return function () {
      unsubscribe("update:status", handleStatus);
      unsubscribe("update:apply_result", handleApplyResult);
    };
  }, []);

  if (!update || !update.updateAvailable || dismissed) return null;

  if (applyResult) {
    return (
      <div className={
        "flex items-center gap-2 px-4 py-2 text-[12px] border-b " +
        (applyResult.success
          ? "bg-success/10 border-success/20 text-success"
          : "bg-error/10 border-error/20 text-error")
      }>
        <span className="flex-1">{applyResult.message}</span>
        {applyResult.success && (
          <button
            onClick={function () { window.location.reload(); }}
            className="flex items-center gap-1 text-[11px] font-mono font-bold hover:underline"
          >
            <RefreshCw size={11} />
            Reload
          </button>
        )}
        <button onClick={function () { setDismissed(true); }} className="btn btn-ghost btn-xs btn-square opacity-50 hover:opacity-100">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/8 border-b border-primary/15 text-[12px] text-base-content/70">
      <ArrowUpCircle size={14} className="text-primary flex-shrink-0" />
      <span className="flex-1">
        <span className="font-semibold text-base-content">v{update.latestVersion}</span>
        {" "}available
        <span className="text-base-content/40 ml-1">(current: v{update.currentVersion})</span>
      </span>
      {update.releaseUrl && (
        <a
          href={update.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[11px] text-primary/50 hover:text-primary transition-colors"
        >
          <ExternalLink size={10} />
          Notes
        </a>
      )}
      {applying ? (
        <Loader2 size={12} className="text-primary animate-spin" />
      ) : (
        <button
          onClick={function () { setApplying(true); send({ type: "update:apply" } as any); }}
          className="btn btn-primary btn-xs"
        >
          Update
        </button>
      )}
      <button
        onClick={function () { setDismissed(true); }}
        aria-label="Dismiss update"
        className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content"
      >
        <X size={12} />
      </button>
    </div>
  );
}
