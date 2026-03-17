import { useEffect, useRef, useState } from "react";
import type { SessionSummary, SessionListMessage, SessionCreatedMessage } from "@lattice/shared";
import type { ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";

interface ContextMenu {
  x: number;
  y: number;
  session: SessionSummary;
}

interface SessionListProps {
  projectSlug: string | null;
  activeSessionId: string | null;
  onSessionActivate: (session: SessionSummary) => void;
  filter?: string;
}

function formatDate(ts: number): string {
  var d = new Date(ts);
  var now = new Date();
  var diff = now.getTime() - d.getTime();
  var day = 86400000;

  if (diff < day && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionList(props: SessionListProps) {
  var ws = useWebSocket();
  var [sessions, setSessions] = useState<SessionSummary[]>([]);
  var [renameId, setRenameId] = useState<string | null>(null);
  var [renameValue, setRenameValue] = useState<string>("");
  var [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  var renameInputRef = useRef<HTMLInputElement | null>(null);
  var handleRef = useRef<(msg: ServerMessage) => void>(function () {});

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "session:list") {
        var listMsg = msg as SessionListMessage;
        if (listMsg.projectSlug === props.projectSlug) {
          setSessions(listMsg.sessions.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }));
        }
      } else if (msg.type === "session:created") {
        var createdMsg = msg as SessionCreatedMessage;
        if (createdMsg.session.projectSlug === props.projectSlug) {
          setSessions(function (prev) {
            return [createdMsg.session, ...prev];
          });
        }
      }
    };
  });

  useEffect(function () {
    function handler(msg: ServerMessage) {
      handleRef.current(msg);
    }
    ws.subscribe("session:list", handler);
    ws.subscribe("session:created", handler);
    return function () {
      ws.unsubscribe("session:list", handler);
      ws.unsubscribe("session:created", handler);
    };
  }, [ws]);

  useEffect(function () {
    if (props.projectSlug && ws.status === "connected") {
      setSessions([]);
    }
  }, [props.projectSlug, ws.status]);

  useEffect(function () {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  useEffect(function () {
    if (!contextMenu) {
      return;
    }
    function dismiss() {
      setContextMenu(null);
    }
    document.addEventListener("mousedown", dismiss);
    return function () {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [contextMenu]);

  function handleActivate(session: SessionSummary) {
    if (!props.projectSlug) {
      return;
    }
    props.onSessionActivate(session);
    ws.send({ type: "session:activate", projectSlug: props.projectSlug, sessionId: session.id });
  }

  function handleContextMenu(e: React.MouseEvent, session: SessionSummary) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, session });
  }

  function handleRenameStart(session: SessionSummary) {
    setContextMenu(null);
    setRenameId(session.id);
    setRenameValue(session.title);
  }

  function handleRenameCommit() {
    if (renameId && renameValue.trim()) {
      ws.send({ type: "session:rename", sessionId: renameId, title: renameValue.trim() });
      setSessions(function (prev) {
        return prev.map(function (s) {
          return s.id === renameId ? { ...s, title: renameValue.trim() } : s;
        });
      });
    }
    setRenameId(null);
    setRenameValue("");
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleRenameCommit();
    } else if (e.key === "Escape") {
      setRenameId(null);
      setRenameValue("");
    }
  }

  function handleDeleteSession(session: SessionSummary) {
    setContextMenu(null);
    ws.send({ type: "session:delete", sessionId: session.id });
    setSessions(function (prev) {
      return prev.filter(function (s) { return s.id !== session.id; });
    });
  }

  if (!props.projectSlug) {
    return (
      <div className="flex-1 flex items-start px-3 py-1.5">
        <span className="text-[13px] text-base-content/40 italic">Select a project</span>
      </div>
    );
  }

  var displayed = props.filter
    ? sessions.filter(function (s) {
        return s.title.toLowerCase().includes(props.filter!.toLowerCase());
      })
    : sessions;

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto py-0.5">
        {displayed.length === 0 ? (
          <div className="px-3 py-1.5 text-[13px] text-base-content/40 italic">
            No sessions yet
          </div>
        ) : (
          displayed.map(function (session) {
            var isActive = props.activeSessionId === session.id;
            var isRenaming = renameId === session.id;
            return (
              <div
                key={session.id}
                onClick={function () { handleActivate(session); }}
                onContextMenu={function (e) { handleContextMenu(e, session); }}
                className={
                  "flex flex-col px-2.5 py-[5px] mx-1 rounded w-[calc(100%-8px)] cursor-pointer select-none transition-colors duration-[120ms] " +
                  (isActive ? "bg-base-300" : "hover:bg-base-300/50")
                }
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={function (e) { setRenameValue(e.target.value); }}
                    onBlur={handleRenameCommit}
                    onKeyDown={handleRenameKeyDown}
                    onClick={function (e) { e.stopPropagation(); }}
                    className="input input-xs input-bordered w-full text-[13px]"
                  />
                ) : (
                  <span
                    className={
                      "text-[13px] truncate leading-snug " +
                      (isActive ? "font-semibold text-base-content" : "text-base-content/70")
                    }
                  >
                    {session.title}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-base-content/40">
                    {formatDate(session.updatedAt)}
                  </span>
                  <span className="text-[11px] text-base-content/40">&middot;</span>
                  <span className="text-[11px] text-base-content/40">
                    {session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu !== null && (
        <div
          onMouseDown={function (e) { e.stopPropagation(); }}
          className="fixed z-[9999] bg-base-200 border border-base-content/20 rounded-md shadow-xl p-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={function () { handleRenameStart(contextMenu!.session); }}
            className="block w-full px-2.5 py-1.5 rounded text-[13px] text-base-content/70 text-left hover:bg-base-300 hover:text-base-content transition-colors duration-[120ms] cursor-pointer"
          >
            Rename
          </button>
          <button
            onClick={function () { handleDeleteSession(contextMenu!.session); }}
            className="block w-full px-2.5 py-1.5 rounded text-[13px] text-error text-left hover:bg-base-300 transition-colors duration-[120ms] cursor-pointer"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
