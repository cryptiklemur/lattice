import { Store } from "@tanstack/react-store";
import type { MessageBookmark } from "@lattice/shared";

export interface BookmarkState {
  bookmarks: MessageBookmark[];
  allBookmarks: MessageBookmark[];
}

var bookmarkStore = new Store<BookmarkState>({
  bookmarks: [],
  allBookmarks: [],
});

export function getBookmarkStore(): Store<BookmarkState> {
  return bookmarkStore;
}

export function setBookmarks(bookmarks: MessageBookmark[]): void {
  bookmarkStore.setState(function (state) {
    return { ...state, bookmarks };
  });
}

export function setAllBookmarks(bookmarks: MessageBookmark[]): void {
  bookmarkStore.setState(function (state) {
    return { ...state, allBookmarks: bookmarks };
  });
}

export function getBookmarkedUuids(): Set<string> {
  var set = new Set<string>();
  var bms = bookmarkStore.state.bookmarks;
  for (var i = 0; i < bms.length; i++) {
    set.add(bms[i].messageUuid);
  }
  return set;
}

export function findBookmarkByUuid(uuid: string): MessageBookmark | undefined {
  var bms = bookmarkStore.state.bookmarks;
  for (var i = 0; i < bms.length; i++) {
    if (bms[i].messageUuid === uuid) return bms[i];
  }
  return undefined;
}
