import { Store } from "@tanstack/react-store";
import type { MessageBookmark } from "#shared";

export interface BookmarkState {
  bookmarks: MessageBookmark[];
  allBookmarks: MessageBookmark[];
}

const bookmarkStore = new Store<BookmarkState>({
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
  const set = new Set<string>();
  const bms = bookmarkStore.state.bookmarks;
  for (let i = 0; i < bms.length; i++) {
    set.add(bms[i].messageUuid);
  }
  return set;
}

export function findBookmarkByUuid(uuid: string): MessageBookmark | undefined {
  const bms = bookmarkStore.state.bookmarks;
  for (let i = 0; i < bms.length; i++) {
    if (bms[i].messageUuid === uuid) return bms[i];
  }
  return undefined;
}
