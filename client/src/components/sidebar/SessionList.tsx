import { useEffect, useRef, useState } from "react";
import type { SessionSummary, SessionListMessage, SessionCreatedMessage } from "@lattice/shared";
import type { ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { markSessionHasUpdates, sessionHasUpdates, markSessionRead } from "../../stores/session";

interface SessionGroup {
  label: string;
  sessions: SessionSummary[];
}

function groupByTime(sessions: SessionSummary[]): SessionGroup[] {
  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var todayMs = todayStart.getTime();
  var yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  var yesterdayMs = yesterdayStart.getTime();
  var weekMs = todayMs - 6 * 86400000;
  var monthMs = todayMs - 29 * 86400000;

  var groups: Record<string, SessionSummary[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  };

  for (var i = 0; i < sessions.length; i++) {
    var ts = sessions[i].updatedAt;
    if (ts >= todayMs) {
      groups["Today"].push(sessions[i]);
    } else if (ts >= yesterdayMs && ts < todayMs) {
      groups["Yesterday"].push(sessions[i]);
    } else if (ts >= weekMs) {
      groups["This Week"].push(sessions[i]);
    } else if (ts >= monthMs) {
      groups["This Month"].push(sessions[i]);
    } else {
      groups["Older"].push(sessions[i]);
    }
  }

  var order = ["Today", "Yesterday", "This Week", "This Month", "Older"];
  var result: SessionGroup[] = [];
  for (var j = 0; j < order.length; j++) {
    if (groups[order[j]].length > 0) {
      result.push({ label: order[j], sessions: groups[order[j]] });
    }
  }
  return result;
}

var knownUpdatedAt = new Map<string, number>();

interface ContextMenu {
  x: number;
  y: number;
  session: SessionSummary;
}

interface SessionListProps {
  projectSlug: string | null;
  activeSessionId: string | null;
  onSessionActivate: (session: SessionSummary) => void;
  onSessionDeactivate?: () => void;
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

function SessionSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="h-2 bg-base-content/10 rounded animate-pulse w-3/4" />
      <div className="h-2 bg-base-content/10 rounded animate-pulse w-1/2" />
      <div className="h-2 bg-base-content/10 rounded animate-pulse w-2/3" />
    </div>
  );
}

export function SessionList(props: SessionListProps) {
  var ws = useWebSocket();
  var [sessions, setSessions] = useState<SessionSummary[]>([]);
  var [loading, setLoading] = useState<boolean>(false);
  var [renameId, setRenameId] = useState<string | null>(null);
  var [renameValue, setRenameValue] = useState<string>("");
  var [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  var [unreadTick, setUnreadTick] = useState<number>(0);
  var renameInputRef = useRef<HTMLInputElement | null>(null);
  var handleRef = useRef<(msg: ServerMessage) => void>(function () {});
  var activeSessionIdRef = useRef<string | null>(props.activeSessionId);
  activeSessionIdRef.current = props.activeSessionId;

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "session:list") {
        var listMsg = msg as SessionListMessage;
        if (listMsg.projectSlug === props.projectSlug) {
          var sorted = listMsg.sessions.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
          var hadChanges = false;
          for (var i = 0; i < sorted.length; i++) {
            var s = sorted[i];
            var prev = knownUpdatedAt.get(s.id);
            if (prev !== undefined && s.updatedAt > prev && s.id !== activeSessionIdRef.current) {
              markSessionHasUpdates(s.id);
              hadChanges = true;
            }
            knownUpdatedAt.set(s.id, s.updatedAt);
          }
          setSessions(sorted);
          setLoading(false);
          if (hadChanges) {
            setUnreadTick(function (t) { return t + 1; });
          }
        }
      } else if (msg.type === "session:created") {
        var createdMsg = msg as SessionCreatedMessage;
        if (createdMsg.session.projectSlug === props.projectSlug) {
          knownUpdatedAt.set(createdMsg.session.id, createdMsg.session.updatedAt);
          setSessions(function (prev2) {
            return [createdMsg.session, ...prev2];
          });
          props.onSessionActivate(createdMsg.session);
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

  var sendRef = useRef(ws.send);
  sendRef.current = ws.send;

  useEffect(function () {
    if (props.projectSlug && ws.status === "connected") {
      setSessions([]);
      setLoading(true);
      sendRef.current({ type: "session:list_request", projectSlug: props.projectSlug });
      var interval = setInterval(function () {
        if (props.projectSlug) {
          sendRef.current({ type: "session:list_request", projectSlug: props.projectSlug });
        }
      }, 10000);
      return function () { clearInterval(interval); };
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
    if (sessionHasUpdates(session.id)) {
      markSessionRead(session.id, 0);
      setUnreadTick(function (t) { return t + 1; });
    }
    props.onSessionActivate(session);
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
      var originalSession = sessions.find(function (s) { return s.id === renameId; });
      if (originalSession && renameValue.trim() === originalSession.title) {
        setRenameId(null);
        setRenameValue("");
        return;
      }
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
    if (props.activeSessionId === session.id && props.onSessionDeactivate) {
      props.onSessionDeactivate();
    }
  }

  if (!props.projectSlug) {
    return (
      <div className="flex-1 flex items-start px-3 py-1.5">
        <span className="text-[13px] text-base-content/40 italic">Select a project</span>
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden py-0.5 pb-16">
          <SessionSkeleton />
        </div>
      </div>
    );
  }

  var displayed = props.filter
    ? sessions.filter(function (s) {
        return s.title.toLowerCase().includes(props.filter!.toLowerCase());
      })
    : sessions;

  var grouped = groupByTime(displayed);

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden py-0.5 pb-16">
        {grouped.length === 0 ? (
          <div className="px-3 py-2 text-sm text-base-content/40 italic">
            {props.filter ? "No matches" : "No sessions yet"}
          </div>
        ) : (
          grouped.map(function (group) {
            return (
              <div key={group.label}>
                <div className="text-[10px] uppercase tracking-widest text-base-content/30 px-3 pt-3 pb-1 select-none">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {group.sessions.map(function (session) {
                    var isActive = props.activeSessionId === session.id;
                    var isRenaming = renameId === session.id;
                    var isUnread = !isActive && sessionHasUpdates(session.id);
                    return (
                      <button
                        key={session.id}
                        type="button"
                        aria-label={"Session: " + session.title}
                        aria-current={isActive ? "true" : undefined}
                        onClick={function () { handleActivate(session); }}
                        onContextMenu={function (e) { handleContextMenu(e, session); }}
                        className={
                          "flex flex-row items-start gap-2 px-2.5 py-[5px] mx-1 rounded w-[calc(100%-8px)] min-w-0 overflow-hidden cursor-pointer select-none transition-colors duration-[120ms] text-left focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none " +
                          (isActive ? "bg-primary/20 text-base-content font-medium" : "hover:bg-base-300/50")
                        }
                      >
                        {isUnread && (
                          <span className="shrink-0 mt-[7px] w-2 h-2 rounded-full bg-primary" />
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
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
                                (isActive ? "" : isUnread ? "text-base-content font-semibold" : "text-base-content/55")
                              }
                            >
                              {session.title}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-base-content/40">
                              {formatDate(session.updatedAt)}
                            </span>
                            {session.messageCount != null && (
                              <>
                                <span className="text-[11px] text-base-content/40">&middot;</span>
                                <span className="text-[11px] text-base-content/40">
                                  {session.messageCount} msg{session.messageCount !== 1 ? "s" : ""}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {contextMenu !== null && (
        <div
          role="menu"
          aria-label="Session actions"
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
