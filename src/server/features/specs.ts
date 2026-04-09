import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, watch } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import type { Spec, SpecStatus, SpecPriority, SpecEffort, SpecSection, SpecActivityType } from "#shared";

let specsFile = "";
let specs: Spec[] = [];
let lastSaveTime = 0;
let onReloadCallback: (() => void) | null = null;

function getSpecsPath(): string {
  if (!specsFile) {
    specsFile = join(getLatticeHome(), "specs.json");
  }
  return specsFile;
}

export function loadSpecs(): void {
  const path = getSpecsPath();
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8");
      specs = JSON.parse(raw) as Spec[];
    } catch (err) {
      console.error("[specs] Failed to load specs:", err);
      specs = [];
    }
  } else {
    specs = [];
  }
  watchSpecsFile();
}

export function onSpecsReloaded(callback: () => void): void {
  onReloadCallback = callback;
}

let watcher: ReturnType<typeof watch> | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function reloadFromDisk(): void {
  const path = getSpecsPath();
  try {
    const raw = readFileSync(path, "utf-8");
    specs = JSON.parse(raw) as Spec[];
    if (onReloadCallback) onReloadCallback();
  } catch (err) {
    console.error("[specs] Failed to reload specs:", err);
  }
}

function watchSpecsFile(): void {
  if (watcher) return;
  const path = getSpecsPath();
  const dir = dirname(path);
  const filename = path.slice(dir.length + 1);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  try {
    watcher = watch(dir, function (_eventType, changedFile) {
      if (changedFile && changedFile !== filename && changedFile !== filename + ".tmp") return;
      if (Date.now() - lastSaveTime < 500) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(function () {
        reloadTimer = null;
        if (!existsSync(path)) return;
        console.log("[specs] External change detected, reloading");
        reloadFromDisk();
      }, 300);
    });
  } catch {}
}

function saveSpecs(): void {
  const path = getSpecsPath();
  const dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const tmp = path + ".tmp";
  try {
    lastSaveTime = Date.now();
    writeFileSync(tmp, JSON.stringify(specs, null, 2));
    renameSync(tmp, path);
  } catch (err) {
    console.error("[specs] Failed to save specs:", err);
  }
}

export function listSpecs(projectSlug?: string): Spec[] {
  if (!projectSlug) return specs.slice();
  return specs.filter(function (s) { return s.projectSlug === projectSlug; });
}

export function getSpec(id: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id === id) return specs[i];
  }
  return null;
}

export function createSpec(opts: {
  projectSlug: string;
  title: string;
  tagline?: string;
  author?: string;
  priority?: SpecPriority;
  estimatedEffort?: SpecEffort;
  tags?: string[];
}): Spec {
  const now = Date.now();
  const spec: Spec = {
    id: "spec_" + now + "_" + randomBytes(3).toString("hex"),
    projectSlug: opts.projectSlug,
    title: opts.title,
    tagline: opts.tagline || "",
    status: "draft",
    priority: opts.priority || "medium",
    estimatedEffort: opts.estimatedEffort || "medium",
    author: opts.author || "",
    tags: opts.tags || [],
    requires: [],
    blockedBy: [],
    sections: {
      summary: "",
      currentState: "",
      requirements: "",
      implementationPlan: "",
      migrationMap: "",
      testing: "",
    },
    linkedSessions: [],
    activity: [{
      timestamp: now,
      type: "created",
      detail: "Spec created",
    }],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
  specs.push(spec);
  saveSpecs();
  return spec;
}

export function updateSpec(id: string, updates: {
  title?: string;
  tagline?: string;
  status?: SpecStatus;
  priority?: SpecPriority;
  estimatedEffort?: SpecEffort;
  author?: string;
  tags?: string[];
  requires?: string[];
  blockedBy?: string[];
  sections?: Partial<SpecSection>;
}): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id !== id) continue;
    const spec = specs[i];
    const now = Date.now();

    if (updates.status && updates.status !== spec.status) {
      spec.activity.push({
        timestamp: now,
        type: "status-change",
        detail: spec.status + " -> " + updates.status,
      });
      if (updates.status === "completed") {
        spec.resolvedAt = now;
      }
    }

    if (updates.title !== undefined) spec.title = updates.title;
    if (updates.tagline !== undefined) spec.tagline = updates.tagline;
    if (updates.status !== undefined) spec.status = updates.status;
    if (updates.priority !== undefined) spec.priority = updates.priority;
    if (updates.estimatedEffort !== undefined) spec.estimatedEffort = updates.estimatedEffort;
    if (updates.author !== undefined) spec.author = updates.author;
    if (updates.tags !== undefined) spec.tags = updates.tags;
    if (updates.requires !== undefined) spec.requires = updates.requires;
    if (updates.blockedBy !== undefined) spec.blockedBy = updates.blockedBy;
    if (updates.sections) {
      const keys = Object.keys(updates.sections) as (keyof SpecSection)[];
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        if (updates.sections[key] !== undefined) {
          spec.sections[key] = updates.sections[key]!;
        }
      }
    }

    spec.updatedAt = now;
    saveSpecs();
    return spec;
  }
  return null;
}

export function deleteSpec(id: string): boolean {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id === id) {
      specs.splice(i, 1);
      saveSpecs();
      return true;
    }
  }
  return false;
}

export function populateSpec(id: string, fields: Record<string, unknown>, sessionId?: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id !== id) continue;
    const spec = specs[i];
    if (fields.title && typeof fields.title === "string") spec.title = fields.title;
    if (fields.tagline && typeof fields.tagline === "string") spec.tagline = fields.tagline;
    if (fields.priority && typeof fields.priority === "string") spec.priority = fields.priority as SpecPriority;
    if (fields.estimatedEffort && typeof fields.estimatedEffort === "string") spec.estimatedEffort = fields.estimatedEffort as SpecEffort;
    if (fields.tags && Array.isArray(fields.tags)) spec.tags = fields.tags;
    if (fields.summary && typeof fields.summary === "string") spec.sections.summary = fields.summary;
    if (fields.currentState && typeof fields.currentState === "string") spec.sections.currentState = fields.currentState;
    if (fields.requirements && typeof fields.requirements === "string") spec.sections.requirements = fields.requirements;
    if (fields.implementationPlan && typeof fields.implementationPlan === "string") spec.sections.implementationPlan = fields.implementationPlan;
    if (fields.testing && typeof fields.testing === "string") spec.sections.testing = fields.testing;
    spec.updatedAt = Date.now();
    spec.activity.push({
      timestamp: Date.now(),
      type: "ai-note",
      detail: "Spec populated from brainstorm session",
      sessionId,
    });
    saveSpecs();
    return spec;
  }
  return null;
}

export function parseSpecPopulate(text: string): Record<string, unknown> | null {
  const startTag = "<spec-populate>";
  const endTag = "</spec-populate>";
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  const jsonStr = text.slice(startIdx + startTag.length, endIdx).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function parsePlanContent(text: string): string | null {
  const startTag = "<plan-content>";
  const endTag = "</plan-content>";
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return text.slice(startIdx + startTag.length, endIdx).trim();
}

export function parseSpecActivity(text: string): { type: string; detail: string } | null {
  const startTag = "<spec-activity>";
  const endTag = "</spec-activity>";
  const startIdx = text.indexOf(startTag);
  const endIdx = text.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  const jsonStr = text.slice(startIdx + startTag.length, endIdx).trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function findSpecBySession(sessionId: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    for (let j = 0; j < specs[i].linkedSessions.length; j++) {
      if (specs[i].linkedSessions[j].sessionId === sessionId) return specs[i];
    }
  }
  return null;
}

export function linkSession(specId: string, sessionId: string, note?: string, sessionType?: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    const spec = specs[i];
    const now = Date.now();
    spec.linkedSessions.push({
      sessionId,
      linkedAt: now,
      note,
      sessionType,
    });
    spec.activity.push({
      timestamp: now,
      type: "session-linked",
      detail: "Linked session " + sessionId,
      sessionId,
    });
    spec.updatedAt = now;
    saveSpecs();
    return spec;
  }
  return null;
}

export function unlinkSession(specId: string, sessionId: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    const spec = specs[i];
    let idx = -1;
    for (let j = 0; j < spec.linkedSessions.length; j++) {
      if (spec.linkedSessions[j].sessionId === sessionId) {
        idx = j;
        break;
      }
    }
    if (idx === -1) return spec;
    spec.linkedSessions.splice(idx, 1);
    spec.updatedAt = Date.now();
    saveSpecs();
    return spec;
  }
  return null;
}

export function addActivity(specId: string, activityType: SpecActivityType, detail: string, sessionId?: string): Spec | null {
  for (let i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    const spec = specs[i];
    const now = Date.now();
    spec.activity.push({
      timestamp: now,
      type: activityType,
      detail,
      sessionId,
    });
    spec.updatedAt = now;
    saveSpecs();
    return spec;
  }
  return null;
}
