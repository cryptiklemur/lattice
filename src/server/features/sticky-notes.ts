import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import type { StickyNote } from "@lattice/shared";

var notesFile = "";
var notes: StickyNote[] = [];

function getNotesPath(): string {
  if (!notesFile) {
    notesFile = join(getLatticeHome(), "notes.jsonl");
  }
  return notesFile;
}

export function loadNotes(): void {
  var path = getNotesPath();
  if (!existsSync(path)) {
    notes = [];
    return;
  }
  try {
    var raw = readFileSync(path, "utf-8");
    var lines = raw.trim().split("\n");
    notes = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        var note = JSON.parse(line) as StickyNote;
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
  var path = getNotesPath();
  var dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  var tmp = path + ".tmp";
  try {
    var lines: string[] = [];
    for (var i = 0; i < notes.length; i++) {
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
  var now = Date.now();
  var note: StickyNote = {
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
  for (var i = 0; i < notes.length; i++) {
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
  for (var i = 0; i < notes.length; i++) {
    if (notes[i].id === id) {
      notes.splice(i, 1);
      saveNotes();
      return true;
    }
  }
  return false;
}
