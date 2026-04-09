import { readdir, readFile as fsReadFile, stat, writeFile as fsWriteFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { FileEntry } from "#shared";

const MAX_FILE_SIZE = 512 * 1024;

export function validatePath(projectPath: string, relativePath: string): string | null {
  const resolved = resolve(projectPath, relativePath);
  const normalizedRoot = resolve(projectPath);
  if (!resolved.startsWith(normalizedRoot + "/") && resolved !== normalizedRoot) {
    return null;
  }
  return resolved;
}

export async function listDirectory(projectPath: string, relativePath: string): Promise<FileEntry[]> {
  const fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return [];
  }

  const entries: FileEntry[] = [];
  let names: string[];
  try {
    names = await readdir(fullPath);
  } catch {
    return [];
  }

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (name.startsWith(".")) {
      continue;
    }
    const entryFull = join(fullPath, name);
    try {
      const entryStat = await stat(entryFull);
      const entryRelative = relative(projectPath, entryFull);
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
  const fullPath = validatePath(projectPath, relativePath);
  if (!fullPath) {
    return null;
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return null;
  }

  if (fileStat.size > MAX_FILE_SIZE) {
    return null;
  }

  let buf: Buffer;
  try {
    buf = await fsReadFile(fullPath);
  } catch {
    return null;
  }

  for (let i = 0; i < Math.min(buf.length, 8192); i++) {
    const byte = buf[i];
    if (byte === 0) {
      return null;
    }
  }

  return buf.toString("utf-8");
}

export async function writeFile(projectPath: string, relativePath: string, content: string): Promise<boolean> {
  const fullPath = validatePath(projectPath, relativePath);
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
