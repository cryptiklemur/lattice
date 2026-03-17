import { useState, useEffect } from "react";
import { Download, X, Check, Loader } from "lucide-react";
import type { ImportableSession, ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";

interface ImportPanelProps {
  projectSlug: string;
  onClose: () => void;
  onImported: () => void;
}

export function ImportPanel(props: ImportPanelProps) {
  var ws = useWebSocket();
  var [sessions, setSessions] = useState<ImportableSession[]>([]);
  var [loading, setLoading] = useState<boolean>(true);
  var [manualId, setManualId] = useState<string>("");
  var [importing, setImporting] = useState<string | null>(null);

  useEffect(function () {
    function handleList(msg: ServerMessage) {
      if (msg.type === "session:importable_list") {
        var listMsg = msg as { type: string; projectSlug: string; sessions: ImportableSession[] };
        if (listMsg.projectSlug === props.projectSlug) {
          setSessions(listMsg.sessions);
          setLoading(false);
        }
      }
    }
    ws.subscribe("session:importable_list", handleList);
    ws.send({ type: "session:list_importable", projectSlug: props.projectSlug });
    return function () { ws.unsubscribe("session:importable_list", handleList); };
  }, [props.projectSlug, ws]);

  function handleImport(sessionId: string) {
    setImporting(sessionId);
    ws.send({ type: "session:import", projectSlug: props.projectSlug, sessionId: sessionId });
  }

  function handleManualImport() {
    var id = manualId.trim();
    if (id.length > 0) {
      handleImport(id);
      setManualId("");
    }
  }

  return (
    <div className="border-t border-base-300 bg-base-300 flex flex-col max-h-[50%] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <span className="text-[11px] font-bold tracking-wider uppercase text-base-content/40">
          Import Sessions
        </span>
        <button onClick={props.onClose} className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content">
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader size={16} className="animate-spin text-base-content/30" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-3 text-[12px] text-base-content/40 italic">
            No Claude Code sessions found for this project
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sessions.map(function (session) {
              return (
                <button
                  key={session.id}
                  disabled={session.alreadyImported || importing === session.id}
                  onClick={function () { handleImport(session.id); }}
                  className={
                    "flex flex-col items-start gap-0.5 px-2.5 py-2 rounded-md text-left transition-colors duration-[120ms] w-full " +
                    (session.alreadyImported
                      ? "opacity-40 cursor-default"
                      : "hover:bg-base-200 cursor-pointer")
                  }
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[12px] font-medium text-base-content truncate flex-1">
                      {session.title}
                    </span>
                    {session.alreadyImported && (
                      <Check size={11} className="text-success flex-shrink-0" />
                    )}
                    {importing === session.id && (
                      <Loader size={11} className="animate-spin text-primary flex-shrink-0" />
                    )}
                  </div>
                  <span className="text-[11px] text-base-content/40 truncate w-full">
                    {session.context}
                  </span>
                  <span className="text-[10px] text-base-content/25">
                    {session.messageCount} msgs
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-2 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualId}
            onChange={function (e) { setManualId(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") { handleManualImport(); } }}
            placeholder="Session ID..."
            className="input input-xs input-bordered flex-1 bg-base-200 text-[12px] font-mono"
            spellCheck={false}
          />
          <button
            onClick={handleManualImport}
            disabled={manualId.trim().length === 0}
            className="btn btn-primary btn-xs"
          >
            <Download size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
