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
  var store = getBookmarkStore();
  var state = useStore(store, function (s) { return s; });
  var { send, subscribe, unsubscribe } = useWebSocket();

  useEffect(function () {
    function handleBookmarkList(msg: ServerMessage) {
      if (msg.type !== "bookmark:list_result") return;
      var data = msg as BookmarkListResultMessage;
      if (data.scope === "session") {
        setBookmarks(data.bookmarks);
      } else {
        setAllBookmarks(data.bookmarks);
        var sessionState = getSessionStore().state;
        if (sessionState.activeSessionId) {
          var sessionBookmarks = data.bookmarks.filter(function (b: MessageBookmark) {
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
    var sessionState = getSessionStore().state;
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
