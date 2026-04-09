import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import type { StickyNote } from "#shared";

let notesFile = "";
let notes: StickyNote[] = [];

function getNotesPath(): string {
  if (!notesFile) {
    notesFile = join(getLatticeHome(), "notes.jsonl");
  }
  return notesFile;
}

export function loadNotes(): void {
  const path = getNotesPath();
  if (!existsSync(path)) {
    notes = [];
    return;
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const lines = raw.trim().split("\n");
    notes = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        const note = JSON.parse(line) as StickyNote;
        notes.push(note);
      } catch {
        // skip malformed line
      }
    }
  } catch (err) {
    console.error("[sticky-notes] Failed to load notes:", err);
    notes = [];
  }
}

function saveNotes(): void {
  const path = getNotesPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmp = path + ".tmp";
  try {
    const lines: string[] = [];
    for (let i = 0; i < notes.length; i++) {
      lines.push(JSON.stringify(notes[i]));
    }
    writeFileSync(tmp, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
    renameSync(tmp, path);
  } catch (err) {
    console.error("[sticky-notes] Failed to save notes:", err);
  }
}

export function listNotes(projectSlug?: string): StickyNote[] {
  if (!projectSlug) return notes.slice();
  return notes.filter(function (n) { return n.projectSlug === projectSlug; });
}

export function createNote(content: string, projectSlug?: string): StickyNote {
  const now = Date.now();
  const note: StickyNote = {
    id: "note_" + now + "_" + randomBytes(3).toString("hex"),
    content,
    createdAt: now,
    updatedAt: now,
    projectSlug,
  };
  notes.push(note);
  saveNotes();
  return note;
}

export function updateNote(id: string, content: string): StickyNote | null {
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].id === id) {
      notes[i].content = content;
      notes[i].updatedAt = Date.now();
      saveNotes();
      return notes[i];
    }
  }
  return null;
}

export function deleteNote(id: string): boolean {
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].id === id) {
      notes.splice(i, 1);
      saveNotes();
      return true;
    }
  }
  return false;
}
