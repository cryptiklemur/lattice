import { readdir, readFile as fsReadFile, stat, writeFile as fsWriteFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { FileEntry } from "#shared";

var MAX_FILE_SIZE = 512 * 1024;

export function validatePath(projectPath: string, relativePath: string): string | null {
  var resolved = resolve(projectPath, relativePath);
  var normalizedRoot = resolve(projectPath);
  if (!resolved.startsWith(normalizedRoot + "/") && resolved !== normalizedRoot) {
    return null;
  }
  return resolved;
}

export async function listDirectory(projectPath: string, relativePath: string): Promise<FileEntry[]> {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return [];
  }

  var entries: FileEntry[] = [];
  var names: string[];
  try {
    names = await readdir(fullPath);
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
      var entryStat = await stat(entryFull);
      var entryRelative = relative(projectPath, entryFull);
      entries.push({
        name: name,
        path: entryRelative,
        isDirectory: entryStat.isDirectory(),
        size: entryStat.isDirectory() ? 0 : entryStat.size,
        modifiedAt: entryStat.mtimeMs,
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

export async function readFile(projectPath: string, relativePath: string): Promise<string | null> {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return null;
  }

  var fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return null;
  }

  if (fileStat.size > MAX_FILE_SIZE) {
    return null;
  }

  var buf: Buffer;
  try {
    buf = await fsReadFile(fullPath);
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

export async function writeFile(projectPath: string, relativePath: string, content: string): Promise<boolean> {
  var fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return false;
  }

  try {
    await fsWriteFile(fullPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}
