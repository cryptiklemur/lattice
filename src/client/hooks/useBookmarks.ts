import { useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import type { ServerMessage, BookmarkListResultMessage, MessageBookmark } from "#shared";
import { useWebSocket } from "./useWebSocket";
import { getBookmarkStore, setBookmarks, setAllBookmarks } from "../stores/bookmarks";
import { getSessionStore } from "../stores/session";
import type { BookmarkState } from "../stores/bookmarks";

export function useBookmarks(): BookmarkState & {
  requestSessionBookmarks: () => void;
  requestAllBookmarks: () => void;
} {
  const store = getBookmarkStore();
  const state = useStore(store, function (s) { return s; });
  const { send, subscribe, unsubscribe } = useWebSocket();

  useEffect(function () {
    function handleBookmarkList(msg: ServerMessage) {
      if (msg.type !== "bookmark:list_result") return;
      const data = msg as BookmarkListResultMessage;
      if (data.scope === "session") {
        setBookmarks(data.bookmarks);
      } else {
        setAllBookmarks(data.bookmarks);
        const sessionState = getSessionStore().state;
        if (sessionState.activeSessionId) {
          const sessionBookmarks = data.bookmarks.filter(function (b: MessageBookmark) {
            return b.sessionId === sessionState.activeSessionId;
          });
          setBookmarks(sessionBookmarks);
        }
      }
    }

    subscribe("bookmark:list_result", handleBookmarkList);
    return function () {
      unsubscribe("bookmark:list_result", handleBookmarkList);
    };
  }, [subscribe, unsubscribe]);

  function requestSessionBookmarks() {
    const sessionState = getSessionStore().state;
    if (!sessionState.activeSessionId || !sessionState.activeProjectSlug) return;
    send({ type: "bookmark:list", projectSlug: sessionState.activeProjectSlug, sessionId: sessionState.activeSessionId });
  }

  function requestAllBookmarks() {
    send({ type: "bookmark:list" });
  }

  return {
    bookmarks: state.bookmarks,
    allBookmarks: state.allBookmarks,
    requestSessionBookmarks,
    requestAllBookmarks,
  };
}
