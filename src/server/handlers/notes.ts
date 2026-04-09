import type {
  ClientMessage,
  NotesListMessage,
  NotesCreateMessage,
  NotesUpdateMessage,
  NotesDeleteMessage,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { listNotes, createNote, updateNote, deleteNote } from "../features/sticky-notes";

registerHandler("notes", function (clientId: string, message: ClientMessage) {
  if (message.type === "notes:list") {
    const listMsg = message as NotesListMessage;
    sendTo(clientId, { type: "notes:list_result", notes: listNotes(listMsg.projectSlug) });
    return;
  }

  if (message.type === "notes:create") {
    const createMsg = message as NotesCreateMessage;
    const note = createNote(createMsg.content, createMsg.projectSlug);
    broadcast({ type: "notes:created", note });
    return;
  }

  if (message.type === "notes:update") {
    const updateMsg = message as NotesUpdateMessage;
    const updated = updateNote(updateMsg.id, updateMsg.content);
    if (!updated) {
      sendTo(clientId, { type: "chat:error", message: "Note not found" });
      return;
    }
    broadcast({ type: "notes:updated", note: updated });
    return;
  }

  if (message.type === "notes:delete") {
    const deleteMsg = message as NotesDeleteMessage;
    const deleted = deleteNote(deleteMsg.id);
    if (!deleted) {
      sendTo(clientId, { type: "chat:error", message: "Note not found" });
      return;
    }
    broadcast({ type: "notes:deleted", id: deleteMsg.id });
    return;
  }
});
