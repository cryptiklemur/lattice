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
    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 12px", position: "relative" }}>
      <div
        style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, minHeight: 48 }}
      >
        {note.content}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={function () { onEdit(note.id); }}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, padding: "2px 8px" }}
        >
          Edit
        </button>
        <button
          onClick={function () { onDelete(note.id); }}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 11, padding: "2px 8px" }}
        >
          Delete
        </button>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, width: 400, maxWidth: "90vw" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>Edit Note</div>
        <textarea
          autoFocus
          value={content}
          onChange={function (e) { setContent(e.target.value); }}
          style={{
            width: "100%",
            minHeight: 120,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-primary)",
            fontSize: 13,
            fontFamily: "inherit",
            padding: "8px 10px",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, padding: "5px 14px" }}
          >
            Cancel
          </button>
          <button
            onClick={function () { onSave(content); }}
            style={{ background: "var(--accent)", border: "none", borderRadius: 4, color: "var(--bg-primary)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "5px 14px" }}
          >
            Save
          </button>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Sticky Notes</span>
        <button
          onClick={function () { setCreating(true); }}
          style={{ background: "var(--accent)", border: "none", borderRadius: 4, color: "var(--bg-primary)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "4px 12px" }}
        >
          New Note
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {notes.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", marginTop: 40 }}>
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
