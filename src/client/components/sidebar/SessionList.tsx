import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Clock, MessageSquare, Cpu, DollarSign, Pencil, Trash2 } from "lucide-react";
import { ContextMenu, useContextMenu } from "../ui/ContextMenu";
import type { SessionSummary, SessionPreview, SessionListMessage, SessionCreatedMessage, SessionPreviewMessage } from "#shared";
import type { ServerMessage } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useTimeTick } from "../../hooks/useTimeTick";
import { markSessionHasUpdates, sessionHasUpdates, markSessionRead } from "../../stores/session";
import { formatSessionTitle } from "../../utils/formatSessionTitle";

const PAGE_SIZE = 40;

interface SessionGroup {
  label: string;
  sessions: SessionSummary[];
}

function groupByTime(sessions: SessionSummary[]): SessionGroup[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayMs = yesterdayStart.getTime();
  const weekMs = todayMs - 6 * 86400000;
  const monthMs = todayMs - 29 * 86400000;

  const groups: Record<string, SessionSummary[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    "This Month": [],
    Older: [],
  };

  for (let i = 0; i < sessions.length; i++) {
    const ts = sessions[i].updatedAt;
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

  const order = ["Today", "Yesterday", "This Week", "This Month", "Older"];
  const result: SessionGroup[] = [];
  for (let j = 0; j < order.length; j++) {
    if (groups[order[j]].length > 0) {
      result.push({ label: order[j], sessions: groups[order[j]] });
    }
  }
  return result;
}

const knownUpdatedAt = new Map<string, number>();

export interface DateRange {
  from?: number;
  to?: number;
}

interface SessionListProps {
  projectSlug: string | null;
  activeSessionId: string | null;
  onSessionActivate: (session: SessionSummary) => void;
  onSessionDeactivate?: () => void;
  filter?: string;
  dateRange?: DateRange;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 86400000;

  if (diff < day && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDuration(ms: number): string {
  if (ms < 60000) return Math.round(ms / 1000) + "s";
  if (ms < 3600000) return Math.round(ms / 60000) + "m";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return hours + "h " + mins + "m";
}

function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  return "$" + cost.toFixed(2);
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

function PreviewPopover(props: { preview: SessionPreview | null; anchorRect: DOMRect | null }) {
  if (!props.anchorRect) return null;

  let top = props.anchorRect.top;
  let left = props.anchorRect.right + 8;

  const fitsRight = left + 280 < window.innerWidth;
  if (!fitsRight) {
    left = props.anchorRect.left - 288;
  }

  const fitsBelow = top + 160 < window.innerHeight;
  if (!fitsBelow) {
    top = Math.max(8, props.anchorRect.bottom - 160);
  }

  const content = (
    <div
      className="fixed z-[9999] w-[270px] bg-base-300 border border-base-content/15 rounded-lg shadow-xl p-3 pointer-events-none"
      style={{ top, left }}
    >
      {props.preview ? (
        <>
          <div className="text-[11px] text-base-content/50 leading-relaxed line-clamp-2 mb-2.5 italic">
            {props.preview.lastMessage || "No messages"}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <DollarSign className="!size-3 text-base-content/30 shrink-0" />
              <span className="text-[11px] text-base-content/60">{formatCost(props.preview.cost)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="!size-3 text-base-content/30 shrink-0" />
              <span className="text-[11px] text-base-content/60">{formatDuration(props.preview.durationMs)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="!size-3 text-base-content/30 shrink-0" />
              <span className="text-[11px] text-base-content/60">{props.preview.messageCount} msgs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="!size-3 text-base-content/30 shrink-0" />
              <span className="text-[11px] text-base-content/60">{props.preview.model || "unknown"}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-base-content/20 border-t-primary/50 rounded-full animate-spin" />
          <span className="text-[11px] text-base-content/40">Loading...</span>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

function loadCachedSessions(slug: string | null): SessionSummary[] {
  if (!slug) return [];
  try {
    const raw = localStorage.getItem("lattice:sessions:" + slug);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function cacheSessions(slug: string, sessions: SessionSummary[]): void {
  try {
    localStorage.setItem("lattice:sessions:" + slug, JSON.stringify(sessions.slice(0, 100)));
  } catch {}
}

export function SessionList(props: SessionListProps) {
  useTimeTick();
  const ws = useWebSocket();
  const [sessions, setSessions] = useState<SessionSummary[]>(function () { return loadCachedSessions(props.projectSlug); });
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const ctxMenu = useContextMenu<SessionSummary>();
  const [unreadTick, setUnreadTick] = useState<number>(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [previews, setPreviews] = useState<Map<string, SessionPreview>>(new Map());
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const handleRef = useRef<(msg: ServerMessage) => void>(function () {});
  const activeSessionIdRef = useRef<string | null>(props.activeSessionId);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<number>(0);
  const hasMoreRef = useRef<boolean>(true);
  activeSessionIdRef.current = props.activeSessionId;

  useEffect(function () {
    handleRef.current = function (msg: ServerMessage) {
      if (msg.type === "session:list") {
        const listMsg = msg as SessionListMessage;
        if (listMsg.projectSlug === props.projectSlug) {
          const incoming = listMsg.sessions.slice().sort(function (a: typeof listMsg.sessions[number], b: typeof listMsg.sessions[number]) { return b.updatedAt - a.updatedAt; });
          const listOffset = listMsg.offset || 0;
          const listTotal = listMsg.totalCount || incoming.length;

          if (listOffset > 0) {
            setSessions(function (prev) {
              const existingIds = new Set(prev.map(function (s: typeof prev[number]) { return s.id; }));
              const newSessions = incoming.filter(function (s: typeof incoming[number]) { return !existingIds.has(s.id); });
              return prev.concat(newSessions);
            });
            setLoadingMore(false);
          } else {
            let hadChanges = false;
            for (let i = 0; i < incoming.length; i++) {
              const s = incoming[i];
              const prev = knownUpdatedAt.get(s.id);
              if (prev !== undefined && s.updatedAt > prev && s.id !== activeSessionIdRef.current) {
                markSessionHasUpdates(s.id);
                hadChanges = true;
              }
              knownUpdatedAt.set(s.id, s.updatedAt);
            }
            setSessions(function (existing) {
              if (existing.length <= PAGE_SIZE) return incoming;
              const incomingIds = new Set(incoming.map(function (s: typeof incoming[number]) { return s.id; }));
              const kept = existing.filter(function (s: typeof existing[number]) { return !incomingIds.has(s.id); });
              return incoming.concat(kept).sort(function (a: typeof incoming[number], b: typeof incoming[number]) { return b.updatedAt - a.updatedAt; });
            });
            setLoading(false);
            if (hadChanges) {
              setUnreadTick(function (t) { return t + 1; });
            }
          }

          setTotalCount(listTotal);
          offsetRef.current = listOffset + incoming.length;
          if (props.projectSlug && listOffset === 0) {
            cacheSessions(props.projectSlug, incoming);
          }
          hasMoreRef.current = listOffset + incoming.length < listTotal;
        }
      } else if (msg.type === "session:created") {
        const createdMsg = msg as SessionCreatedMessage;
        if (createdMsg.session.projectSlug === props.projectSlug) {
          knownUpdatedAt.set(createdMsg.session.id, createdMsg.session.updatedAt);
          setSessions(function (prev2) {
            return [createdMsg.session, ...prev2];
          });
          setTotalCount(function (t) { return t + 1; });
          props.onSessionActivate(createdMsg.session);
        }
      } else if (msg.type === "session:preview") {
        const previewMsg = msg as SessionPreviewMessage;
        setPreviews(function (prev3) {
          const next = new Map(prev3);
          if (next.size >= 100 && !next.has(previewMsg.sessionId)) {
            const oldest = next.keys().next().value;
            if (oldest !== undefined) next.delete(oldest);
          }
          next.set(previewMsg.sessionId, previewMsg.preview);
          return next;
        });
      }
    };
  });

  useEffect(function () {
    function handler(msg: ServerMessage) {
      handleRef.current(msg);
    }
    ws.subscribe("session:list", handler);
    ws.subscribe("session:created", handler);
    ws.subscribe("session:preview", handler);
    return function () {
      ws.unsubscribe("session:list", handler);
      ws.unsubscribe("session:created", handler);
      ws.unsubscribe("session:preview", handler);
    };
  }, [ws]);

  const sendRef = useRef(ws.send);
  sendRef.current = ws.send;

  useEffect(function () {
    if (props.projectSlug && ws.status === "connected") {
      const cached = loadCachedSessions(props.projectSlug);
      setSessions(cached);
      setLoading(cached.length === 0);
      offsetRef.current = 0;
      hasMoreRef.current = true;
      sendRef.current({ type: "session:list_request", projectSlug: props.projectSlug, offset: 0, limit: PAGE_SIZE });
      const interval = setInterval(function () {
        if (props.projectSlug && ws.status === "connected") {
          sendRef.current({ type: "session:list_request", projectSlug: props.projectSlug, offset: 0, limit: PAGE_SIZE });
        }
      }, 120000);
      return function () { clearInterval(interval); };
    }
  }, [props.projectSlug, ws.status]);

  const loadMore = useCallback(function () {
    if (!props.projectSlug || loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    sendRef.current({
      type: "session:list_request",
      projectSlug: props.projectSlug,
      offset: offsetRef.current,
      limit: PAGE_SIZE,
    });
  }, [props.projectSlug, loadingMore]);

  useEffect(function () {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { root: scrollContainerRef.current, rootMargin: "100px" });

    observer.observe(sentinel);
    return function () { observer.disconnect(); };
  }, [loadMore]);

  useEffect(function () {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  function handleActivate(session: SessionSummary) {
    if (!props.projectSlug) {
      return;
    }
    if (sessionHasUpdates(session.id)) {
      markSessionRead(session.id, 0);
      setUnreadTick(function (t) { return t + 1; });
    }
    setHoveredId(null);
    props.onSessionActivate(session);
  }

  function handleContextMenu(e: React.MouseEvent, session: SessionSummary) {
    ctxMenu.open(e, session);
  }

  function handleRenameStart(session: SessionSummary) {
    ctxMenu.close();
    setRenameId(session.id);
    setRenameValue(session.title);
  }

  function handleRenameCommit() {
    if (renameId && renameValue.trim()) {
      const originalSession = sessions.find(function (s) { return s.id === renameId; });
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
    ctxMenu.close();
    ws.send({ type: "session:delete", sessionId: session.id });
    setSessions(function (prev) {
      return prev.filter(function (s) { return s.id !== session.id; });
    });
    setTotalCount(function (t) { return Math.max(0, t - 1); });
    if (props.activeSessionId === session.id && props.onSessionDeactivate) {
      props.onSessionDeactivate();
    }
  }

  function handleMouseEnter(session: SessionSummary, e: React.PointerEvent | React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(function () {
      setHoveredId(session.id);
      setHoveredRect(rect);
      if (!previews.has(session.id) && props.projectSlug) {
        ws.send({ type: "session:preview_request", projectSlug: props.projectSlug, sessionId: session.id });
      }
    }, 300);
  }

  function handleMouseLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredId(null);
    setHoveredRect(null);
  }

  const grouped = useMemo(function () {
    let displayed = sessions;
    if (props.filter) {
      const term = props.filter.toLowerCase();
      if (term.startsWith("*")) {
        const idSuffix = term.slice(1);
        displayed = displayed.filter(function (s) {
          return s.id.toLowerCase().endsWith(idSuffix) || s.id.toLowerCase().includes(idSuffix);
        });
      } else {
        displayed = displayed.filter(function (s) {
          return s.title.toLowerCase().includes(term) || s.id.toLowerCase().includes(term);
        });
      }
    }
    if (props.dateRange) {
      const from = props.dateRange.from;
      const to = props.dateRange.to;
      if (from !== undefined || to !== undefined) {
        displayed = displayed.filter(function (s) {
          if (from !== undefined && s.updatedAt < from) return false;
          if (to !== undefined && s.updatedAt > to) return false;
          return true;
        });
      }
    }
    return groupByTime(displayed);
  }, [sessions, props.filter, props.dateRange]);

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

  const activePreview = hoveredId ? (previews.get(hoveredId) || null) : null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hidden py-0.5 pb-16">
        {grouped.length === 0 ? (
          <div className="px-4 py-6 text-center">
            {props.filter ? (
              <div className="text-[12px] text-base-content/30">No sessions match your search</div>
            ) : (
              <>
                <div className="text-[12px] text-base-content/30 mb-1">No sessions yet</div>
                <div className="text-[11px] text-base-content/20">Click + above to start a conversation with Claude</div>
              </>
            )}
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
                    const isActive = props.activeSessionId === session.id;
                    const isRenaming = renameId === session.id;
                    const isUnread = !isActive && sessionHasUpdates(session.id);
                    return (
                      <button
                        key={session.id}
                        type="button"
                        aria-label={"Session: " + session.title}
                        aria-current={isActive ? "true" : undefined}
                        onClick={function () { handleActivate(session); }}
                        onContextMenu={function (e) { handleContextMenu(e, session); }}
                        onPointerEnter={function (e) { handleMouseEnter(session, e); }}
                        onPointerLeave={handleMouseLeave}
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
                              {formatSessionTitle(session.title)}
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

        {hasMoreRef.current && (
          <div ref={sentinelRef} className="py-3 flex justify-center">
            {loadingMore && (
              <div className="flex items-center gap-2 text-[11px] text-base-content/30">
                <span className="w-3 h-3 border-2 border-base-content/20 border-t-primary/50 rounded-full animate-spin" />
                Loading...
              </div>
            )}
          </div>
        )}
      </div>
      {hoveredId && (
        <PreviewPopover preview={activePreview} anchorRect={hoveredRect} />
      )}
      {ctxMenu.state !== null && (
        <ContextMenu
          x={ctxMenu.state.x}
          y={ctxMenu.state.y}
          items={[
            { label: "Rename", icon: <Pencil size={14} />, onClick: function () { handleRenameStart(ctxMenu.state!.data); } },
            { label: "Delete", icon: <Trash2 size={14} />, onClick: function () { handleDeleteSession(ctxMenu.state!.data); }, danger: true },
          ]}
          onClose={ctxMenu.close}
          label="Session actions"
        />
      )}
    </div>
  );
}
