import { useCallback, useEffect, useState } from "react";
import type { StickyNote, ServerMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";

interface NoteCardProps {
  note: StickyNote;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function NoteCard(props: NoteCardProps) {
  var { note, onEdit, onDelete } = props;
  return (
    <div className="card bg-base-200 border border-base-300">
      <div className="card-body p-3">
        <div className="text-[13px] text-base-content whitespace-pre-wrap break-words leading-relaxed min-h-12">
          {note.content}
        </div>
        <div className="flex gap-1.5 justify-end mt-2">
          <button
            onClick={function () { onEdit(note.id); }}
            className="btn btn-ghost btn-xs border border-base-300"
          >
            Edit
          </button>
          <button
            onClick={function () { onDelete(note.id); }}
            className="btn btn-ghost btn-xs border border-base-300 text-base-content/60"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditModalProps {
  initial: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

function EditModal(props: EditModalProps) {
  var { initial, onSave, onCancel } = props;
  var [content, setContent] = useState(initial);

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Edit note">
      <div className="card bg-base-200 border border-base-300 w-[400px] max-w-[90vw] shadow-2xl">
        <div className="card-body p-5">
          <div className="text-[13px] font-semibold text-base-content mb-3">Edit Note</div>
          <textarea
            autoFocus
            value={content}
            onChange={function (e) { setContent(e.target.value); }}
            className="textarea textarea-bordered w-full min-h-[120px] bg-base-300 text-base-content text-[13px] resize-y"
          />
          <div className="flex gap-2 justify-end mt-3">
            <button
              onClick={onCancel}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={function () { onSave(content); }}
              className="btn btn-primary btn-sm"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StickyNotes() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [notes, setNotes] = useState<StickyNote[]>([]);
  var [editingId, setEditingId] = useState<string | null>(null);
  var [creating, setCreating] = useState(false);

  var editingNote = editingId ? notes.find(function (n) { return n.id === editingId; }) : null;

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
    send({ type: "notes:list" });
    return function () {
      unsubscribe("notes:list_result", handleMessage);
      unsubscribe("notes:created", handleMessage);
      unsubscribe("notes:updated", handleMessage);
      unsubscribe("notes:deleted", handleMessage);
    };
  }, [send, subscribe, unsubscribe, handleMessage]);

  function handleCreate(content: string) {
    if (content.trim()) {
      send({ type: "notes:create", content: content.trim() });
    }
    setCreating(false);
  }

  function handleEdit(content: string) {
    if (editingId && content.trim()) {
      send({ type: "notes:update", id: editingId, content: content.trim() });
    }
    setEditingId(null);
  }

  function handleDelete(id: string) {
    send({ type: "notes:delete", id });
  }

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <span className="text-[13px] font-semibold text-base-content">Sticky Notes</span>
        <button
          onClick={function () { setCreating(true); }}
          className="btn btn-primary btn-xs"
        >
          New Note
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2.5">
        {notes.length === 0 && (
          <div className="text-base-content/50 text-[13px] text-center mt-10">
            No notes yet. Create one to get started.
          </div>
        )}
        {notes.map(function (note) {
          return (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={setEditingId}
              onDelete={handleDelete}
            />
          );
        })}
      </div>

      {creating && (
        <EditModal
          initial=""
          onSave={handleCreate}
          onCancel={function () { setCreating(false); }}
        />
      )}

      {editingNote && (
        <EditModal
          initial={editingNote.content}
          onSave={handleEdit}
          onCancel={function () { setEditingId(null); }}
        />
      )}
    </div>
  );
}
