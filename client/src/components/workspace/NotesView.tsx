import { useCallback, useEffect, useState } from "react";
import type { StickyNote, ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSession } from "../../hooks/useSession";
import { NoteCard } from "./NoteCard";

export function NotesView() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { activeProjectSlug } = useSession();
  var [notes, setNotes] = useState<StickyNote[]>([]);

  var handleMessage = useCallback(function (msg: ServerMessage) {
    if (msg.type === "notes:list_result") {
      setNotes(msg.notes);
      return;
    }
    if (msg.type === "notes:created") {
      setNotes(function (prev) { return [...prev, msg.note]; });
      return;
    }
    if (msg.type === "notes:updated") {
      setNotes(function (prev) {
        return prev.map(function (n) { return n.id === msg.note.id ? msg.note : n; });
      });
      return;
    }
    if (msg.type === "notes:deleted") {
      setNotes(function (prev) { return prev.filter(function (n) { return n.id !== msg.id; }); });
      return;
    }
  }, []);

  useEffect(function () {
    subscribe("notes:list_result", handleMessage);
    subscribe("notes:created", handleMessage);
    subscribe("notes:updated", handleMessage);
    subscribe("notes:deleted", handleMessage);
    send({ type: "notes:list", projectSlug: activeProjectSlug ?? undefined });
    return function () {
      unsubscribe("notes:list_result", handleMessage);
      unsubscribe("notes:created", handleMessage);
      unsubscribe("notes:updated", handleMessage);
      unsubscribe("notes:deleted", handleMessage);
    };
  }, [send, subscribe, unsubscribe, handleMessage, activeProjectSlug]);

  function handleCreate() {
    send({ type: "notes:create", content: "", projectSlug: activeProjectSlug ?? undefined });
  }

  function handleUpdate(id: string, content: string) {
    send({ type: "notes:update", id, content });
  }

  function handleDelete(id: string) {
    send({ type: "notes:delete", id });
  }

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/15">
        <span className="text-[13px] font-semibold text-base-content">Notes</span>
        <button
          onClick={handleCreate}
          className="btn btn-primary btn-xs"
        >
          New Note
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {notes.length === 0 ? (
          <div className="text-base-content/40 text-[13px] text-center mt-10">
            No notes yet. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {notes.map(function (note) {
              return (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
