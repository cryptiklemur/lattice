import type {
  ClientMessage,
  BookmarkListMessage,
  BookmarkAddMessage,
  BookmarkRemoveMessage,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import { listBookmarks, addBookmark, removeBookmark } from "../project/bookmarks";

registerHandler("bookmark", function (clientId: string, message: ClientMessage) {
  if (message.type === "bookmark:list") {
    const listMsg = message as BookmarkListMessage;
    const isSessionScoped = Boolean(listMsg.sessionId);
    sendTo(clientId, {
      type: "bookmark:list_result",
      scope: isSessionScoped ? "session" : "all",
      bookmarks: listBookmarks(listMsg.projectSlug, listMsg.sessionId),
    });
    return;
  }

  if (message.type === "bookmark:add") {
    const addMsg = message as BookmarkAddMessage;
    addBookmark({
      sessionId: addMsg.sessionId,
      projectSlug: addMsg.projectSlug,
      messageUuid: addMsg.messageUuid,
      messageText: addMsg.messageText,
      messageType: addMsg.messageType,
    });
    sendTo(clientId, {
      type: "bookmark:list_result",
      scope: "session",
      bookmarks: listBookmarks(addMsg.projectSlug, addMsg.sessionId),
    });
    return;
  }

  if (message.type === "bookmark:remove") {
    const removeMsg = message as BookmarkRemoveMessage;
    removeBookmark(removeMsg.id);
    sendTo(clientId, {
      type: "bookmark:list_result",
      scope: "all",
      bookmarks: listBookmarks(),
    });
    return;
  }
});
