import { existsSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig, saveConfig } from "../config";
import type { ProjectSummary } from "#shared";

export function listProjects(nodeId: string): ProjectSummary[] {
  const config = loadConfig();
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

  const config = loadConfig();

  if (config.projects.some(function(p: typeof config.projects[number]) { return p.path === path; })) return null;

  const slug = generateSlug(basename(path), config.projects.map(function(p: typeof config.projects[number]) { return p.slug; }));
  const project = { path: path, slug: slug, title: title || basename(path), env: {} };
  config.projects.push(project);
  saveConfig(config);

  return { slug: project.slug, path: project.path, title: project.title, nodeId: "" };
}

export function removeProject(slug: string): boolean {
  const config = loadConfig();
  const idx = config.projects.findIndex(function(p: typeof config.projects[number]) { return p.slug === slug; });
  if (idx === -1) return false;
  config.projects.splice(idx, 1);
  saveConfig(config);
  return true;
}

export function getProjectBySlug(slug: string): { path: string; slug: string; title: string; env: Record<string, string> } | undefined {
  const config = loadConfig();
  return config.projects.find(function(p: typeof config.projects[number]) { return p.slug === slug; });
}

export function generateSlug(name: string, existing: string[]): string {
  let slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = "project";
  let candidate = slug;
  let counter = 1;
  while (existing.includes(candidate)) {
    candidate = slug + "-" + counter;
    counter++;
  }
  return candidate;
}
