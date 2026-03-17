import type {
  ClientMessage,
  NotesCreateMessage,
  NotesUpdateMessage,
  NotesDeleteMessage,
} from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo, broadcast } from "../ws/broadcast";
import { listNotes, createNote, updateNote, deleteNote } from "../features/sticky-notes";

registerHandler("notes", function (clientId: string, message: ClientMessage) {
  if (message.type === "notes:list") {
    sendTo(clientId, { type: "notes:list_result", notes: listNotes() });
    return;
  }

  if (message.type === "notes:create") {
    var createMsg = message as NotesCreateMessage;
    var note = createNote(createMsg.content);
    broadcast({ type: "notes:created", note });
    return;
  }

  if (message.type === "notes:update") {
    var updateMsg = message as NotesUpdateMessage;
    var updated = updateNote(updateMsg.id, updateMsg.content);
    if (!updated) {
      sendTo(clientId, { type: "chat:error", message: "Note not found" });
      return;
    }
    broadcast({ type: "notes:updated", note: updated });
    return;
  }

  if (message.type === "notes:delete") {
    var deleteMsg = message as NotesDeleteMessage;
    var deleted = deleteNote(deleteMsg.id);
    if (!deleted) {
      sendTo(clientId, { type: "chat:error", message: "Note not found" });
      return;
    }
    broadcast({ type: "notes:deleted", id: deleteMsg.id });
    return;
  }
});
