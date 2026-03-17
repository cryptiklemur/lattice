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

  function handleNewSession() {
    if (!props.projectSlug) {
      return;
    }
    ws.send({ type: "session:create", projectSlug: props.projectSlug });
  }

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
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          padding: "6px 12px",
        }}
      >
        <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
          Select a project
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div style={{ padding: "4px 6px 2px" }}>
        <button
          onClick={handleNewSession}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            width: "100%",
            padding: "5px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Session
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            No sessions yet
          </div>
        ) : (
          sessions.map(function (session) {
            var isActive = props.activeSessionId === session.id;
            var isRenaming = renameId === session.id;
            return (
              <div
                key={session.id}
                onClick={function () { handleActivate(session); }}
                onContextMenu={function (e) { handleContextMenu(e, session); }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "5px 10px",
                  margin: "1px 4px",
                  borderRadius: "var(--radius-sm)",
                  width: "calc(100% - 8px)",
                  background: isActive ? "var(--bg-overlay)" : "transparent",
                  cursor: "pointer",
                  transition: "background var(--transition-fast)",
                  userSelect: "none",
                }}
                onMouseEnter={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tertiary)";
                  }
                }}
                onMouseLeave={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }
                }}
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={function (e) { setRenameValue(e.target.value); }}
                    onBlur={handleRenameCommit}
                    onKeyDown={handleRenameKeyDown}
                    onClick={function (e) { e.stopPropagation(); }}
                    style={{
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 400,
                      color: "var(--text-primary)",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--accent-primary)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0 4px",
                      width: "100%",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {session.title}
                  </span>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "2px",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {formatDate(session.updatedAt)}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    &middot;
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
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
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            padding: "4px",
            minWidth: "140px",
          }}
        >
          <button
            onClick={function () { handleRenameStart(contextMenu.session); }}
            style={{
              display: "block",
              width: "100%",
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              color: "var(--text-secondary)",
              textAlign: "left",
              transition: "background var(--transition-fast), color var(--transition-fast)",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            Rename
          </button>
          <button
            onClick={function () { handleDeleteSession(contextMenu.session); }}
            style={{
              display: "block",
              width: "100%",
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              color: "var(--accent-danger)",
              textAlign: "left",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
