import { join } from "node:path";
import { IS_COMPILED } from "./runtime";

var CONTENT_TYPES: Record<string, string> = {
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

interface EmbeddedAssetModule {
  assets: Map<string, { b64: string; type: string }>;
}

var embeddedAssets: Map<string, { b64: string; type: string }> | null = null;
var assetCache = new Map<string, Uint8Array>();

export async function initAssets(): Promise<void> {
  if (!IS_COMPILED) return;
  try {
    var mod = await import("./_generated/embedded-assets") as EmbeddedAssetModule;
    embeddedAssets = mod.assets;
  } catch {}
}

export function serveStaticAsset(pathname: string): Response | null {
  if (!embeddedAssets) return null;

  var entry = embeddedAssets.get(pathname);
  if (!entry) return null;

  var cached = assetCache.get(pathname);
  if (!cached) {
    cached = Buffer.from(entry.b64, "base64") as unknown as Uint8Array;
    assetCache.set(pathname, cached);
  }

  return new Response(cached as unknown as BodyInit, {
    headers: {
      "Content-Type": entry.type,
      "Cache-Control": pathname === "/index.html" || pathname === "/sw.js"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    },
  });
}

export function hasEmbeddedAssets(): boolean {
  return embeddedAssets !== null;
}

export function getClientDir(): string {
  return join(import.meta.dir, "../../client/dist");
}

export function guessContentType(path: string): string {
  var ext = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[ext] || "application/octet-stream";
}
