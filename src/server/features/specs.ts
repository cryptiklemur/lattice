import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { getLatticeHome } from "../config";
import type { Spec, SpecStatus, SpecPriority, SpecEffort, SpecSection, SpecActivityType } from "#shared";

var specsFile = "";
var specs: Spec[] = [];

function getSpecsPath(): string {
  if (!specsFile) {
    specsFile = join(getLatticeHome(), "specs.json");
  }
  return specsFile;
}

export function loadSpecs(): void {
  var path = getSpecsPath();
  if (!existsSync(path)) {
    specs = [];
    return;
  }
  try {
    var raw = readFileSync(path, "utf-8");
    specs = JSON.parse(raw) as Spec[];
  } catch (err) {
    console.error("[specs] Failed to load specs:", err);
    specs = [];
  }
}

function saveSpecs(): void {
  var path = getSpecsPath();
  var dir = join(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  var tmp = path + ".tmp";
  try {
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
  for (var i = 0; i < specs.length; i++) {
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
  var now = Date.now();
  var spec: Spec = {
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
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].id !== id) continue;
    var spec = specs[i];
    var now = Date.now();

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
      var keys = Object.keys(updates.sections) as (keyof SpecSection)[];
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
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
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].id === id) {
      specs.splice(i, 1);
      saveSpecs();
      return true;
    }
  }
  return false;
}

export function linkSession(specId: string, sessionId: string, note?: string): Spec | null {
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    var spec = specs[i];
    var now = Date.now();
    spec.linkedSessions.push({
      sessionId,
      linkedAt: now,
      note,
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
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    var spec = specs[i];
    var idx = -1;
    for (var j = 0; j < spec.linkedSessions.length; j++) {
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
  for (var i = 0; i < specs.length; i++) {
    if (specs[i].id !== specId) continue;
    var spec = specs[i];
    var now = Date.now();
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
