import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname_local = dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

export async function initAssets(): Promise<void> {
  // No-op in npm mode — static serving is handled by Express
}

export function serveStaticAsset(_pathname: string): Response | null {
  return null;
}

export function hasEmbeddedAssets(): boolean {
  return false;
}

export function getClientDir(): string {
  const distPath = join(__dirname_local, "../../dist/client");
  if (existsSync(distPath)) return distPath;
  return join(__dirname_local, "../../dist/client");
}

export function guessContentType(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] || "application/octet-stream";
}
