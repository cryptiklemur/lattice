import { existsSync, readFileSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Spec } from "#shared";
import { log } from "../logger";

var TRACKED_SKILLS = [
  "brainstorming",
  "writing-plans",
  "subagent-driven-development",
  "executing-plans",
];

var installed = false;
var version: string | null = null;
var installPath: string | null = null;
var skillContent = new Map<string, string>();
var watcher: FSWatcher | null = null;

function getPluginsFilePath(): string {
  return join(homedir(), ".claude", "plugins", "installed_plugins.json");
}

function detectSuperpowers(): void {
  var pluginsFile = getPluginsFilePath();
  if (!existsSync(pluginsFile)) {
    installed = false;
    version = null;
    installPath = null;
    skillContent.clear();
    return;
  }

  try {
    var raw = readFileSync(pluginsFile, "utf-8");
    var data = JSON.parse(raw);
    var plugins = data.plugins || {};

    var found = false;
    for (var key of Object.keys(plugins)) {
      if (key.startsWith("superpowers@")) {
        var entries = plugins[key];
        if (Array.isArray(entries) && entries.length > 0) {
          var entry = entries[0];
          installed = true;
          version = entry.version || null;
          installPath = entry.installPath || null;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      installed = false;
      version = null;
      installPath = null;
      skillContent.clear();
      return;
    }

    loadSkills();
  } catch (err) {
    log.superpowers("Failed to read plugins file: %O", err);
    installed = false;
    version = null;
    installPath = null;
    skillContent.clear();
  }
}

function loadSkills(): void {
  skillContent.clear();
  if (!installPath) return;

  for (var name of TRACKED_SKILLS) {
    var skillPath = join(installPath, "skills", name, "SKILL.md");
    if (existsSync(skillPath)) {
      try {
        var content = readFileSync(skillPath, "utf-8");
        skillContent.set(name, content);
      } catch (err) {
        log.superpowers("Failed to read skill %s: %O", name, err);
      }
    }
  }

  log.superpowers("Superpowers v%s detected with %d skills", version, skillContent.size);
}

export function initSuperpowers(): void {
  detectSuperpowers();

  var pluginsDir = join(homedir(), ".claude", "plugins");
  if (existsSync(pluginsDir)) {
    try {
      watcher = watch(pluginsDir, function (_eventType, filename) {
        if (filename === "installed_plugins.json") {
          detectSuperpowers();
        }
      });
    } catch (err) {
      log.superpowers("Failed to watch plugins directory: %O", err);
    }
  }
}

export function isSuperpowersInstalled(): boolean {
  return installed;
}

export function getSuperpowersVersion(): string | null {
  return version;
}

export function getSkillContent(skillName: string): string | null {
  return skillContent.get(skillName) ?? null;
}

export function getAvailableSkills(): string[] {
  return Array.from(skillContent.keys());
}

export function buildBrainstormPrompt(spec: Spec, projectSlug: string): string {
  var content = getSkillContent("brainstorming");
  if (!content) return "";

  var append = content + "\n\n---\n\n";
  append += "## Lattice Integration Instructions\n\n";
  append += "You are helping design a spec in the Lattice project management tool.\n\n";
  append += "**Project:** " + projectSlug + "\n";
  append += "**Spec ID:** " + spec.id + "\n\n";
  append += "When you reach the 'write design doc' phase, instead of writing a file to disk, ";
  append += "output the design as a JSON block inside `<spec-populate>` tags. The JSON should contain ";
  append += "any of these fields that you have determined from the conversation:\n\n";
  append += "```json\n";
  append += '{\n  "title": "Spec title",\n  "tagline": "One-line summary",\n';
  append += '  "summary": "Full summary section content",\n';
  append += '  "currentState": "What exists today",\n';
  append += '  "requirements": "What needs to change",\n';
  append += '  "implementationPlan": "High-level approach",\n';
  append += '  "testing": "How to verify",\n';
  append += '  "priority": "high|medium|low",\n';
  append += '  "estimatedEffort": "small|medium|large|xl",\n';
  append += '  "tags": ["tag1", "tag2"]\n}\n```\n\n';
  append += "Lattice will automatically populate the spec fields from this output.\n";
  append += "After outputting the spec-populate block, suggest that the user can now write an implementation plan from the spec editor.\n";

  return append;
}

export function buildWritePlanPrompt(spec: Spec, projectSlug: string): string {
  var content = getSkillContent("writing-plans");
  if (!content) return "";

  var append = content + "\n\n---\n\n";
  append += "## Lattice Integration Instructions\n\n";
  append += "You are writing an implementation plan for a spec in Lattice.\n\n";
  append += "**Project:** " + projectSlug + "\n";
  append += "**Spec:** " + spec.title + "\n\n";
  append += "### Spec Content\n\n";
  if (spec.sections.summary) append += "**Summary:** " + spec.sections.summary + "\n\n";
  if (spec.sections.currentState) append += "**Current State:** " + spec.sections.currentState + "\n\n";
  if (spec.sections.requirements) append += "**Requirements:** " + spec.sections.requirements + "\n\n";
  if (spec.sections.testing) append += "**Testing:** " + spec.sections.testing + "\n\n";
  append += "When you have finished writing the plan, output it inside `<plan-content>` tags.\n";
  append += "Lattice will store it in the spec's implementation plan section.\n";

  return append;
}

export function buildExecutePrompt(spec: Spec, projectSlug: string): string {
  var content = getSkillContent("subagent-driven-development") || getSkillContent("executing-plans");
  if (!content) return "";

  var append = content + "\n\n---\n\n";
  append += "## Lattice Integration Instructions\n\n";
  append += "You are executing an implementation plan from a Lattice spec.\n\n";
  append += "**Project:** " + projectSlug + "\n";
  append += "**Spec:** " + spec.title + "\n\n";
  append += "### Implementation Plan\n\n";
  if (spec.sections.implementationPlan) {
    append += spec.sections.implementationPlan + "\n\n";
  }
  append += "As you complete milestones, report progress by outputting `<spec-activity>` blocks:\n";
  append += '```\n<spec-activity>{"type": "ai-note", "detail": "Completed task N: description"}</spec-activity>\n```\n';

  return append;
}
