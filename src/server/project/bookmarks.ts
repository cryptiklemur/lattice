import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import type { MessageBookmark } from "#shared";

let bookmarksFile = "";
let bookmarks: MessageBookmark[] = [];

function getBookmarksPath(): string {
  if (!bookmarksFile) {
    bookmarksFile = join(getLatticeHome(), "bookmarks.json");
  }
  return bookmarksFile;
}

export function loadBookmarks(): void {
  const path = getBookmarksPath();
  if (!existsSync(path)) {
    bookmarks = [];
    return;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    bookmarks = JSON.parse(raw) as MessageBookmark[];
  } catch (err) {
    console.error("[bookmarks] Failed to load bookmarks:", err);
    bookmarks = [];
  }
}

function saveBookmarks(): void {
  const path = getBookmarksPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmp = path + ".tmp";
  try {
    writeFileSync(tmp, JSON.stringify(bookmarks, null, 2));
    renameSync(tmp, path);
  } catch (err) {
    console.error("[bookmarks] Failed to save bookmarks:", err);
  }
}

export function listBookmarks(projectSlug?: string, sessionId?: string): MessageBookmark[] {
  let result = bookmarks;
  if (projectSlug) {
    result = result.filter(function (b) { return b.projectSlug === projectSlug; });
  }
  if (sessionId) {
    result = result.filter(function (b) { return b.sessionId === sessionId; });
  }
  return result.slice();
}

export function addBookmark(bookmark: Omit<MessageBookmark, "id" | "createdAt">): MessageBookmark {
  const now = Date.now();
  const entry: MessageBookmark = {
    id: "bm_" + now + "_" + randomBytes(3).toString("hex"),
    sessionId: bookmark.sessionId,
    projectSlug: bookmark.projectSlug,
    messageUuid: bookmark.messageUuid,
    messageText: bookmark.messageText.slice(0, 100),
    messageType: bookmark.messageType,
    createdAt: now,
  };
  bookmarks.push(entry);
  saveBookmarks();
  return entry;
}

export function removeBookmark(id: string): boolean {
  for (let i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].id === id) {
      bookmarks.splice(i, 1);
      saveBookmarks();
      return true;
    }
  }
  return false;
}
