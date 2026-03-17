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
import { homedir } from "node:os";
import type { HistoryMessage, ImportableSession, SessionSummary } from "@lattice/shared";
import { getLatticeHome, loadConfig } from "../config";

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

export function listImportableSessions(projectSlug: string): ImportableSession[] {
  var projectConfig = loadConfig().projects.find(function (p) { return p.slug === projectSlug; });
  if (!projectConfig) {
    return [];
  }

  var claudeDir = join(homedir(), ".claude", "projects");

  if (!existsSync(claudeDir)) {
    return [];
  }

  var projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(claudeDir);
  } catch {
    return [];
  }

  var sessionsDir = getSessionsDir(projectSlug);
  var existingSessionIds = new Set<string>();
  try {
    var existingFiles = readdirSync(sessionsDir);
    for (var i = 0; i < existingFiles.length; i++) {
      if (existingFiles[i].endsWith(".jsonl")) {
        existingSessionIds.add(existingFiles[i].replace(".jsonl", ""));
      }
    }
  } catch {
    // sessions dir may not exist yet
  }

  var results: ImportableSession[] = [];

  for (var d = 0; d < projectDirs.length; d++) {
    var hashDir = join(claudeDir, projectDirs[d]);
    var sessDir = join(hashDir, "sessions");
    if (!existsSync(sessDir)) {
      continue;
    }

    var sessionFiles: string[] = [];
    try {
      sessionFiles = readdirSync(sessDir);
    } catch {
      continue;
    }

    for (var f = 0; f < sessionFiles.length; f++) {
      var file = sessionFiles[f];
      if (!file.endsWith(".jsonl") && !file.endsWith(".json")) {
        continue;
      }

      var sessionId = file.replace(/\.(jsonl|json)$/, "");
      var filePath = join(sessDir, file);

      try {
        var content = readFileSync(filePath, "utf-8");
        var lines = content.trim().split("\n").filter(function (l) { return l.trim().length > 0; });
        if (lines.length === 0) {
          continue;
        }

        var title = "Session " + sessionId.slice(0, 8);
        var context = "";
        var messageCount = 0;
        var createdAt = 0;

        for (var li = 0; li < lines.length; li++) {
          try {
            var parsed = JSON.parse(lines[li]);
            messageCount++;
            if (li === 0 && parsed.timestamp) {
              createdAt = parsed.timestamp;
            }
            if (!context && parsed.type === "user" && parsed.text) {
              context = parsed.text.slice(0, 120);
            }
            if (parsed.type === "meta" && parsed.title) {
              title = parsed.title;
            }
          } catch {
            continue;
          }
        }

        if (messageCount > 0) {
          results.push({
            id: sessionId,
            title: title,
            context: context || "(no preview available)",
            createdAt: createdAt || Date.now(),
            messageCount: messageCount,
            alreadyImported: existingSessionIds.has(sessionId),
          });
        }
      } catch {
        continue;
      }
    }
  }

  results.sort(function (a, b) { return b.createdAt - a.createdAt; });

  return results;
}

export function importSession(projectSlug: string, claudeSessionId: string): SessionSummary | null {
  var projectConfig = loadConfig().projects.find(function (p) { return p.slug === projectSlug; });
  if (!projectConfig) {
    return null;
  }

  var claudeDir = join(homedir(), ".claude", "projects");

  if (!existsSync(claudeDir)) {
    return null;
  }

  var projectDirs: string[] = [];
  try {
    projectDirs = readdirSync(claudeDir);
  } catch {
    return null;
  }

  var sourceFile: string | null = null;
  for (var d = 0; d < projectDirs.length; d++) {
    var candidate = join(claudeDir, projectDirs[d], "sessions", claudeSessionId + ".jsonl");
    if (existsSync(candidate)) {
      sourceFile = candidate;
      break;
    }
    var candidateJson = join(claudeDir, projectDirs[d], "sessions", claudeSessionId + ".json");
    if (existsSync(candidateJson)) {
      sourceFile = candidateJson;
      break;
    }
  }

  if (!sourceFile) {
    return null;
  }

  var content = readFileSync(sourceFile, "utf-8");
  var lines = content.trim().split("\n").filter(function (l) { return l.trim().length > 0; });

  var title = "Imported: " + claudeSessionId.slice(0, 8);
  var messages: HistoryMessage[] = [];
  var firstTimestamp = Date.now();

  for (var i = 0; i < lines.length; i++) {
    try {
      var parsed = JSON.parse(lines[i]);
      if (parsed.type === "meta" && parsed.title) {
        title = parsed.title;
        continue;
      }
      if (parsed.timestamp && i === 0) {
        firstTimestamp = parsed.timestamp;
      }
      messages.push(parsed as HistoryMessage);
    } catch {
      continue;
    }
  }

  var sessionsDir = getSessionsDir(projectSlug);
  mkdirSync(sessionsDir, { recursive: true });

  var sessionId = claudeSessionId;
  var sessionFile = join(sessionsDir, sessionId + ".jsonl");

  var meta = JSON.stringify({
    type: "meta",
    title: title,
    createdAt: firstTimestamp,
    updatedAt: Date.now(),
  });
  writeFileSync(sessionFile, meta + "\n");

  for (var m = 0; m < messages.length; m++) {
    appendFileSync(sessionFile, JSON.stringify(messages[m]) + "\n");
  }

  return {
    id: sessionId,
    projectSlug: projectSlug,
    title: title,
    createdAt: firstTimestamp,
    updatedAt: Date.now(),
    messageCount: messages.length,
  };
}
