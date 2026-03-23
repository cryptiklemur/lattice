import { existsSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig, saveConfig } from "../config";
import type { ProjectSummary } from "@lattice/shared";

export function listProjects(nodeId: string): ProjectSummary[] {
  var config = loadConfig();
  return config.projects.map(function(p: typeof config.projects[number]) {
    return {
      slug: p.slug,
      path: p.path,
      title: p.title,
      nodeId: nodeId,
    };
  });
}

export function addProject(path: string, title?: string): ProjectSummary | null {
  if (!existsSync(path)) return null;

  var config = loadConfig();

  if (config.projects.some(function(p: typeof config.projects[number]) { return p.path === path; })) return null;

  var slug = generateSlug(basename(path), config.projects.map(function(p: typeof config.projects[number]) { return p.slug; }));
  var project = { path: path, slug: slug, title: title || basename(path), env: {} };
  config.projects.push(project);
  saveConfig(config);

  return { slug: project.slug, path: project.path, title: project.title, nodeId: "" };
}

export function removeProject(slug: string): boolean {
  var config = loadConfig();
  var idx = config.projects.findIndex(function(p: typeof config.projects[number]) { return p.slug === slug; });
  if (idx === -1) return false;
  config.projects.splice(idx, 1);
  saveConfig(config);
  return true;
}

export function getProjectBySlug(slug: string): { path: string; slug: string; title: string; env: Record<string, string> } | undefined {
  var config = loadConfig();
  return config.projects.find(function(p: typeof config.projects[number]) { return p.slug === slug; });
}

export function generateSlug(name: string, existing: string[]): string {
  var slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "project";
  var candidate = slug;
  var counter = 1;
  while (existing.includes(candidate)) {
    candidate = slug + "-" + counter;
    counter++;
  }
  return candidate;
}
