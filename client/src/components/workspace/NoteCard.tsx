import { useState, useRef } from "react";
import { Trash2 } from "lucide-react";
import type { StickyNote } from "@lattice/shared";

interface NoteCardProps {
  note: StickyNote;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function NoteCard(props: NoteCardProps) {
  var { note, onUpdate, onDelete } = props;
  var [editing, setEditing] = useState(false);
  var [draft, setDraft] = useState(note.content);
  var [confirming, setConfirming] = useState(false);
  var originalRef = useRef(note.content);

  function handleClick() {
    if (!editing) {
      originalRef.current = note.content;
      setDraft(note.content);
      setEditing(true);
    }
  }

  function handleBlur() {
    if (editing) {
      if (draft.trim() && draft.trim() !== originalRef.current) {
        onUpdate(note.id, draft.trim());
      }
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setDraft(originalRef.current);
      setEditing(false);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleBlur();
    }
  }

  var updatedDate = new Date(note.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="card bg-base-200 border border-base-content/15 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
      tabIndex={editing ? undefined : 0}
      role={editing ? undefined : "button"}
      onClick={editing ? undefined : handleClick}
      onKeyDown={editing ? undefined : function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{ cursor: editing ? "default" : "pointer" }}
    >
      <div className="card-body p-3">
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={function (e) { setDraft(e.target.value); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="textarea textarea-bordered w-full min-h-[80px] bg-base-300 text-base-content text-[13px] resize-y leading-relaxed"
          />
        ) : (
          <div className="text-[13px] text-base-content whitespace-pre-wrap break-words leading-relaxed min-h-12">
            {note.content}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-base-content/40">{updatedDate}</span>
          {confirming ? (
            <div className="flex gap-1.5">
              <button
                onClick={function (e) { e.stopPropagation(); onDelete(note.id); }}
                className="btn btn-error btn-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
              >
                Confirm
              </button>
              <button
                onClick={function (e) { e.stopPropagation(); setConfirming(false); }}
                className="btn btn-ghost btn-xs border border-base-content/15 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={function (e) { e.stopPropagation(); setConfirming(true); }}
              className="btn btn-ghost btn-xs border border-base-content/15 text-base-content/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
              aria-label="Delete note"
            >
              <Trash2 className="!size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
