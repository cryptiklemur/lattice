import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from "node:fs";
import type { FSWatcher } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config";
import { broadcast } from "../ws/broadcast";
import { log } from "../logger";

interface ActiveBrainstorm {
  html: string;
  filename: string;
  sessionDir: string;
}

let activeBrainstorms: Record<string, ActiveBrainstorm> = {};
let watchers: FSWatcher[] = [];
let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debounce(key: string, fn: () => void, ms: number): void {
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }
  debounceTimers[key] = setTimeout(function () {
    delete debounceTimers[key];
    fn();
  }, ms);
}

function getMostRecentSessionDir(brainstormDir: string): string | null {
  if (!existsSync(brainstormDir)) {
    return null;
  }
  const entries: Array<{ name: string; mtime: number }> = [];
  try {
    const names = readdirSync(brainstormDir);
    for (let i = 0; i < names.length; i++) {
      const fullPath = join(brainstormDir, names[i]);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          entries.push({ name: names[i], mtime: stat.mtimeMs });
        }
      } catch {
        // skip
      }
    }
  } catch {
    return null;
  }
  if (entries.length === 0) {
    return null;
  }
  entries.sort(function (a, b) {
    return b.mtime - a.mtime;
  });
  return join(brainstormDir, entries[0].name);
}

function isWaitingFile(filename: string): boolean {
  return filename === "waiting.html" || filename.startsWith("waiting");
}

function handleContentFile(projectSlug: string, contentDir: string, sessionDir: string, filename: string): void {
  if (!filename.endsWith(".html")) {
    return;
  }
  if (isWaitingFile(filename)) {
    log.server("[brainstorm] waiting file detected for project %s", projectSlug);
    delete activeBrainstorms[projectSlug];
    broadcast({ type: "brainstorm:cleared" });
    return;
  }
  const filePath = join(contentDir, filename);
  if (!existsSync(filePath)) {
    return;
  }
  let html: string;
  try {
    html = readFileSync(filePath, "utf-8");
  } catch (err) {
    log.server("[brainstorm] failed to read %s: %s", filePath, err);
    return;
  }
  log.server("[brainstorm] broadcasting content %s for project %s", filename, projectSlug);
  activeBrainstorms[projectSlug] = { html, filename, sessionDir };
  broadcast({ type: "brainstorm:content", html, filename, sessionDir });
}

function handleStateFile(projectSlug: string, filename: string): void {
  if (filename === "server-stopped") {
    log.server("[brainstorm] server-stopped detected for project %s", projectSlug);
    delete activeBrainstorms[projectSlug];
    broadcast({ type: "brainstorm:cleared" });
  }
}

function watchSessionDir(projectSlug: string, sessionDir: string): void {
  const contentDir = join(sessionDir, "content");
  const stateDir = join(sessionDir, "state");

  if (!existsSync(contentDir)) {
    mkdirSync(contentDir, { recursive: true });
  }
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const alreadyStopped = existsSync(join(stateDir, "server-stopped"));
  if (!alreadyStopped) {
    let existingFiles: string[] = [];
    try {
      existingFiles = readdirSync(contentDir);
    } catch {
      // ok
    }
    for (let i = 0; i < existingFiles.length; i++) {
      const fname = existingFiles[i];
      if (fname.endsWith(".html") && !isWaitingFile(fname)) {
        handleContentFile(projectSlug, contentDir, sessionDir, fname);
      }
    }
  }

  try {
    const contentWatcher = watch(contentDir, function (eventType, filename) {
      if (!filename) {
        return;
      }
      debounce("content:" + sessionDir + ":" + filename, function () {
        handleContentFile(projectSlug, contentDir, sessionDir, filename as string);
      }, 50);
    });
    watchers.push(contentWatcher);
  } catch (err) {
    log.server("[brainstorm] failed to watch content dir %s: %s", contentDir, err);
  }

  try {
    const stateWatcher = watch(stateDir, function (eventType, filename) {
      if (!filename) {
        return;
      }
      debounce("state:" + sessionDir + ":" + filename, function () {
        handleStateFile(projectSlug, filename as string);
      }, 50);
    });
    watchers.push(stateWatcher);
  } catch (err) {
    log.server("[brainstorm] failed to watch state dir %s: %s", stateDir, err);
  }
}

function watchBrainstormDir(projectSlug: string, brainstormDir: string): void {
  const recentSession = getMostRecentSessionDir(brainstormDir);
  if (recentSession) {
    watchSessionDir(projectSlug, recentSession);
  }

  try {
    const dirWatcher = watch(brainstormDir, function (eventType, filename) {
      if (!filename) {
        return;
      }
      debounce("brainstorm:" + brainstormDir + ":" + filename, function () {
        const candidate = join(brainstormDir, filename as string);
        try {
          const stat = statSync(candidate);
          if (stat.isDirectory()) {
            log.server("[brainstorm] new session dir detected: %s", candidate);
            watchSessionDir(projectSlug, candidate);
          }
        } catch {
          // entry may have been removed
        }
      }, 50);
    });
    watchers.push(dirWatcher);
  } catch (err) {
    log.server("[brainstorm] failed to watch brainstorm dir %s: %s", brainstormDir, err);
  }
}

function watchProjectRoot(projectSlug: string, projectPath: string): void {
  const superpowersDir = join(projectPath, ".superpowers");
  const brainstormDir = join(superpowersDir, "brainstorm");

  if (existsSync(brainstormDir)) {
    watchBrainstormDir(projectSlug, brainstormDir);
    return;
  }

  if (existsSync(superpowersDir)) {
    watchForBrainstormDir(projectSlug, superpowersDir, brainstormDir);
    return;
  }

  try {
    const rootWatcher = watch(projectPath, function (eventType, filename) {
      if (filename !== ".superpowers") {
        return;
      }
      if (existsSync(superpowersDir)) {
        rootWatcher.close();
        watchForBrainstormDir(projectSlug, superpowersDir, brainstormDir);
      }
    });
    watchers.push(rootWatcher);
  } catch (err) {
    log.server("[brainstorm] failed to watch project root %s: %s", projectPath, err);
  }
}

function watchForBrainstormDir(projectSlug: string, superpowersDir: string, brainstormDir: string): void {
  if (existsSync(brainstormDir)) {
    watchBrainstormDir(projectSlug, brainstormDir);
    return;
  }

  try {
    const spWatcher = watch(superpowersDir, function (eventType, filename) {
      if (filename !== "brainstorm") {
        return;
      }
      if (existsSync(brainstormDir)) {
        spWatcher.close();
        watchBrainstormDir(projectSlug, brainstormDir);
      }
    });
    watchers.push(spWatcher);
  } catch (err) {
    log.server("[brainstorm] failed to watch .superpowers dir %s: %s", superpowersDir, err);
  }
}

export function startBrainstormWatchers(): void {
  const config = loadConfig();
  const projects = config.projects;
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    if (!project.path || !project.slug) {
      continue;
    }
    if (!existsSync(project.path)) {
      continue;
    }
    log.server("[brainstorm] setting up watcher for project %s at %s", project.slug, project.path);
    watchProjectRoot(project.slug, project.path);
  }
}

export function stopBrainstormWatchers(): void {
  for (let i = 0; i < watchers.length; i++) {
    try {
      watchers[i].close();
    } catch {
      // ignore
    }
  }
  watchers = [];
  activeBrainstorms = {};
  const keys = Object.keys(debounceTimers);
  for (let i = 0; i < keys.length; i++) {
    clearTimeout(debounceTimers[keys[i]]);
  }
  debounceTimers = {};
}

export function getActiveBrainstorm(projectSlug: string): ActiveBrainstorm | null {
  return activeBrainstorms[projectSlug] || null;
}

export function getAnyActiveBrainstorm(): ActiveBrainstorm | null {
  const keys = Object.keys(activeBrainstorms);
  if (keys.length === 0) return null;
  return activeBrainstorms[keys[0]];
}

export function stopBrainstorm(projectSlug?: string): void {
  const slugs = projectSlug ? [projectSlug] : Object.keys(activeBrainstorms);
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const active = activeBrainstorms[slug];
    if (!active) continue;
    const stateDir = join(active.sessionDir, "state");
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }
    const stoppedPath = join(stateDir, "server-stopped");
    if (!existsSync(stoppedPath)) {
      try {
        writeFileSync(stoppedPath, String(Date.now()));
      } catch (err) {
        log.server("[brainstorm] failed to write server-stopped: %s", err);
      }
    }
    delete activeBrainstorms[slug];
    log.server("[brainstorm] stopped brainstorm for project %s", slug);
  }
  broadcast({ type: "brainstorm:cleared" });
}

export function writeBrainstormEvent(sessionDir: string, event: object): void {
  const stateDir = join(sessionDir, "state");
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const eventsFile = join(stateDir, "events");
  try {
    appendFileSync(eventsFile, JSON.stringify(event) + "\n", "utf-8");
  } catch (err) {
    log.server("[brainstorm] failed to write event to %s: %s", eventsFile, err);
  }
}
