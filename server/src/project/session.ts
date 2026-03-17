import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { HistoryMessage, SessionSummary } from "@lattice/shared";
import { getLatticeHome } from "../config";

interface MetaLine {
  type: "meta";
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export function getSessionsDir(projectSlug: string): string {
  var dir = join(getLatticeHome(), "sessions", projectSlug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSessionPath(projectSlug: string, sessionId: string): string {
  return join(getSessionsDir(projectSlug), `${sessionId}.jsonl`);
}

export function createSession(projectSlug: string, title?: string): SessionSummary {
  var sessionId = randomUUID();
  var now = Date.now();
  var sessionTitle = title || `Session ${new Date(now).toLocaleString()}`;

  var meta: MetaLine = {
    type: "meta",
    sessionId,
    title: sessionTitle,
    createdAt: now,
    updatedAt: now,
  };

  var filePath = getSessionPath(projectSlug, sessionId);
  writeFileSync(filePath, JSON.stringify(meta) + "\n", "utf-8");

  return {
    id: sessionId,
    projectSlug,
    title: sessionTitle,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

export function listSessions(projectSlug: string): SessionSummary[] {
  var dir = getSessionsDir(projectSlug);
  var files = readdirSync(dir).filter(function (f) {
    return f.endsWith(".jsonl");
  });

  var summaries: SessionSummary[] = [];

  for (var file of files) {
    var filePath = join(dir, file);
    try {
      var content = readFileSync(filePath, "utf-8");
      var lines = content.split("\n").filter(function (l) {
        return l.trim().length > 0;
      });
      if (lines.length === 0) {
        continue;
      }
      var meta = JSON.parse(lines[0]) as MetaLine;
      if (meta.type !== "meta") {
        continue;
      }
      summaries.push({
        id: meta.sessionId,
        projectSlug,
        title: meta.title,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        messageCount: lines.length - 1,
      });
    } catch {
      console.warn(`[lattice] Failed to parse session file: ${file}`);
    }
  }

  summaries.sort(function (a, b) {
    return b.updatedAt - a.updatedAt;
  });

  return summaries;
}

export function loadSessionHistory(projectSlug: string, sessionId: string): HistoryMessage[] {
  var filePath = getSessionPath(projectSlug, sessionId);
  if (!existsSync(filePath)) {
    return [];
  }

  var content = readFileSync(filePath, "utf-8");
  var lines = content.split("\n").filter(function (l) {
    return l.trim().length > 0;
  });

  var messages: HistoryMessage[] = [];

  for (var i = 1; i < lines.length; i++) {
    try {
      messages.push(JSON.parse(lines[i]) as HistoryMessage);
    } catch {
      console.warn(`[lattice] Failed to parse history line ${i} in session ${sessionId}`);
    }
  }

  return messages;
}

export function appendToSession(projectSlug: string, sessionId: string, message: HistoryMessage): void {
  var filePath = getSessionPath(projectSlug, sessionId);
  if (!existsSync(filePath)) {
    return;
  }

  appendFileSync(filePath, JSON.stringify(message) + "\n", "utf-8");

  var content = readFileSync(filePath, "utf-8");
  var lines = content.split("\n").filter(function (l) {
    return l.trim().length > 0;
  });

  try {
    var meta = JSON.parse(lines[0]) as MetaLine;
    meta.updatedAt = Date.now();
    lines[0] = JSON.stringify(meta);
    writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  } catch {
    console.warn(`[lattice] Failed to update meta in session ${sessionId}`);
  }
}

export function renameSession(projectSlug: string, sessionId: string, title: string): boolean {
  var filePath = getSessionPath(projectSlug, sessionId);
  if (!existsSync(filePath)) {
    return false;
  }

  var content = readFileSync(filePath, "utf-8");
  var lines = content.split("\n").filter(function (l) {
    return l.trim().length > 0;
  });

  if (lines.length === 0) {
    return false;
  }

  try {
    var meta = JSON.parse(lines[0]) as MetaLine;
    meta.title = title;
    meta.updatedAt = Date.now();
    lines[0] = JSON.stringify(meta);
    writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
    return true;
  } catch {
    console.warn(`[lattice] Failed to rename session ${sessionId}`);
    return false;
  }
}

export function deleteSession(projectSlug: string, sessionId: string): boolean {
  var filePath = getSessionPath(projectSlug, sessionId);
  if (!existsSync(filePath)) {
    return false;
  }
  unlinkSync(filePath);
  return true;
}

export function findProjectSlugForSession(sessionId: string): string | null {
  var sessionsRoot = join(getLatticeHome(), "sessions");
  if (!existsSync(sessionsRoot)) {
    return null;
  }
  var projectDirs = readdirSync(sessionsRoot);
  for (var projectSlug of projectDirs) {
    var filePath = join(sessionsRoot, projectSlug, `${sessionId}.jsonl`);
    if (existsSync(filePath)) {
      return projectSlug;
    }
  }
  return null;
}
