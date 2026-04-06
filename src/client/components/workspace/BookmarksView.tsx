import { useEffect, useMemo } from "react";
import { Bookmark, MessageSquare, ExternalLink } from "lucide-react";
import { useBookmarks } from "../../hooks/useBookmarks";
import { useSession } from "../../hooks/useSession";
import { useProjects } from "../../hooks/useProjects";
import { openTab } from "../../stores/workspace";
import type { MessageBookmark } from "#shared";

function relativeTime(ts: number): string {
  var diff = Date.now() - ts;
  var seconds = Math.floor(diff / 1000);
  if (seconds < 60) return seconds + "s ago";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  return days + "d ago";
}

interface GroupedBookmarks {
  projectSlug: string;
  sessions: Array<{
    sessionId: string;
    bookmarks: MessageBookmark[];
  }>;
}

export function BookmarksView() {
  var { allBookmarks, requestAllBookmarks } = useBookmarks();
  var { activateSession } = useSession();
  var { projects } = useProjects();

  useEffect(function () {
    requestAllBookmarks();
  }, []);

  var grouped = useMemo(function () {
    var projectMap = new Map<string, Map<string, MessageBookmark[]>>();
    for (var i = 0; i < allBookmarks.length; i++) {
      var bm = allBookmarks[i];
      if (!projectMap.has(bm.projectSlug)) {
        projectMap.set(bm.projectSlug, new Map());
      }
      var sessionMap = projectMap.get(bm.projectSlug)!;
      if (!sessionMap.has(bm.sessionId)) {
        sessionMap.set(bm.sessionId, []);
      }
      sessionMap.get(bm.sessionId)!.push(bm);
    }
    var result: GroupedBookmarks[] = [];
    projectMap.forEach(function (sessionMap, projectSlug) {
      var sessions: GroupedBookmarks["sessions"] = [];
      sessionMap.forEach(function (bookmarks, sessionId) {
        sessions.push({ sessionId, bookmarks });
      });
      sessions.sort(function (a, b) {
        return b.bookmarks[0].createdAt - a.bookmarks[0].createdAt;
      });
      result.push({ projectSlug, sessions });
    });
    result.sort(function (a, b) {
      var aLatest = a.sessions[0]?.bookmarks[0]?.createdAt ?? 0;
      var bLatest = b.sessions[0]?.bookmarks[0]?.createdAt ?? 0;
      return bLatest - aLatest;
    });
    return result;
  }, [allBookmarks]);

  function getProjectTitle(slug: string): string {
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].slug === slug) return projects[i].title;
    }
    return slug;
  }

  function handleBookmarkClick(bm: MessageBookmark) {
    activateSession(bm.projectSlug, bm.sessionId);
    openTab("chat");
    setTimeout(function () {
      var el = document.getElementById("msg-" + bm.messageUuid);
      if (el) {
        el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        el.classList.add("ring-2", "ring-warning/40");
        setTimeout(function () { el!.classList.remove("ring-2", "ring-warning/40"); }, 2000);
      }
    }, 500);
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-base-content/10 bg-base-100 flex-shrink-0">
        <Bookmark size={16} className="text-warning" />
        <span className="text-sm font-semibold text-base-content">Bookmarks</span>
        <span className="text-[10px] font-mono text-base-content/30 ml-auto">{allBookmarks.length} total</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {allBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/30 gap-3">
            <Bookmark size={32} className="text-base-content/15" />
            <div className="text-[13px] font-mono">No bookmarks yet</div>
            <div className="text-[11px] text-base-content/20 max-w-[260px] text-center">
              Bookmark messages in chat to quickly find them later.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(function (group) {
              return (
                <div key={group.projectSlug}>
                  <div className="text-[10px] uppercase tracking-widest text-base-content/40 font-mono font-bold mb-2">
                    {getProjectTitle(group.projectSlug)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.sessions.map(function (session) {
                      return (
                        <div key={session.sessionId} className="bg-base-200/50 border border-base-content/8 rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-base-content/5">
                            <MessageSquare size={11} className="text-base-content/30" />
                            <span className="text-[11px] font-mono text-base-content/40 truncate">{session.sessionId.slice(0, 12)}...</span>
                          </div>
                          <div className="flex flex-col">
                            {session.bookmarks.map(function (bm) {
                              return (
                                <button
                                  key={bm.id}
                                  type="button"
                                  onClick={function () { handleBookmarkClick(bm); }}
                                  className="flex items-start gap-2 px-3 py-2 hover:bg-base-content/5 transition-colors text-left w-full"
                                >
                                  <Bookmark size={10} className="text-warning/60 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[12px] text-base-content/70 line-clamp-2">{bm.messageText}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] text-base-content/25 font-mono">{bm.messageType}</span>
                                      <span className="text-[9px] text-base-content/20 font-mono">{relativeTime(bm.createdAt)}</span>
                                    </div>
                                  </div>
                                  <ExternalLink size={10} className="text-base-content/20 mt-1 flex-shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
