import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import type { FileEntry } from "@lattice/shared";

var MAX_FILE_SIZE = 512 * 1024;

export function validatePath(projectPath: string, relativePath: string): string | null {
  var resolved = resolve(projectPath, relativePath);
  var normalizedRoot = resolve(projectPath);
  if (!resolved.startsWith(normalizedRoot + "/") && resolved !== normalizedRoot) {
    return null;
  }
  return resolved;
}

export function listDirectory(projectPath: string, relativePath: string): FileEntry[] {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return [];
  }

  var entries: FileEntry[] = [];
  var names: string[];
  try {
    names = readdirSync(fullPath);
  } catch {
    return [];
  }

  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (name.startsWith(".")) {
      continue;
    }
    var entryFull = join(fullPath, name);
    try {
      var stat = statSync(entryFull);
      var entryRelative = relative(projectPath, entryFull);
      entries.push({
        name: name,
        path: entryRelative,
        isDirectory: stat.isDirectory(),
        size: stat.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtimeMs,
      });
    } catch {
      // skip entries we can't stat
    }
  }

  entries.sort(function (a, b) {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return entries;
}

export function readFile(projectPath: string, relativePath: string): string | null {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return null;
  }

  var stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(fullPath);
  } catch {
    return null;
  }

  if (stat.size > MAX_FILE_SIZE) {
    return null;
  }

  var buf: Buffer;
  try {
    buf = readFileSync(fullPath);
  } catch {
    return null;
  }

  for (var i = 0; i < Math.min(buf.length, 8192); i++) {
    var byte = buf[i];
    if (byte === 0) {
      return null;
    }
  }

  return buf.toString("utf-8");
}

export function writeFile(projectPath: string, relativePath: string, content: string): boolean {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return false;
  }

  try {
    writeFileSync(fullPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}
