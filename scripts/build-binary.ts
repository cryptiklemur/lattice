#!/usr/bin/env bun
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { execSync } from "node:child_process";

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

var VALID_TARGETS = ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"];

var ROOT = join(import.meta.dir, "..");

function parseArgs(): { targets: string[]; version: string } {
  var args = process.argv.slice(2);
  var targets: string[] = [];
  var version = "";

  for (var i = 0; i < args.length; i++) {
    if (args[i] === "--target" && i + 1 < args.length) {
      targets.push(args[i + 1]);
      i++;
    } else if (args[i].startsWith("--target=")) {
      targets.push(args[i].split("=")[1]);
    } else if (args[i] === "--version" && i + 1 < args.length) {
      version = args[i + 1];
      i++;
    } else if (args[i].startsWith("--version=")) {
      version = args[i].split("=")[1];
    } else if (args[i] === "--all") {
      targets = [...VALID_TARGETS];
    }
  }

  if (targets.length === 0) {
    var platform = process.platform === "darwin" ? "darwin" : "linux";
    var arch = process.arch === "arm64" ? "arm64" : "x64";
    targets = [platform + "-" + arch];
  }

  if (!version) {
    var pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
    version = pkg.version || "0.0.0-dev";
  }

  for (var t = 0; t < targets.length; t++) {
    if (VALID_TARGETS.indexOf(targets[t]) === -1) {
      console.error("Invalid target: " + targets[t]);
      console.error("Valid targets: " + VALID_TARGETS.join(", "));
      process.exit(1);
    }
  }

  return { targets, version };
}

function walkDir(dir: string, base: string): Array<{ path: string; relativePath: string }> {
  var results: Array<{ path: string; relativePath: string }> = [];
  var entries = readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var fullPath = join(dir, entries[i].name);
    if (entries[i].isDirectory()) {
      results = results.concat(walkDir(fullPath, base));
    } else {
      results.push({ path: fullPath, relativePath: "/" + relative(base, fullPath) });
    }
  }
  return results;
}

function generateEmbeddedAssets(clientDistDir: string): void {
  console.log("[build] Generating embedded assets...");
  var files = walkDir(clientDistDir, clientDistDir);
  var genDir = join(ROOT, "server/src/_generated");
  mkdirSync(genDir, { recursive: true });

  var lines: string[] = [];
  lines.push("var assets = new Map<string, { b64: string; type: string }>();");

  var totalSize = 0;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var ext = extname(file.path);
    var contentType = CONTENT_TYPES[ext] || "application/octet-stream";
    var data = readFileSync(file.path);
    var b64 = data.toString("base64");
    totalSize += data.length;
    lines.push("assets.set(" + JSON.stringify(file.relativePath) + ", { b64: " + JSON.stringify(b64) + ", type: " + JSON.stringify(contentType) + " });");
  }

  lines.push("export { assets };");

  writeFileSync(join(genDir, "embedded-assets.ts"), lines.join("\n"), "utf-8");
  console.log("[build] Embedded " + files.length + " files (" + (totalSize / 1024 / 1024).toFixed(1) + " MB)");
}

function buildClient(): void {
  console.log("[build] Building client...");
  execSync("bun run --filter @lattice/client build", { cwd: ROOT, stdio: "inherit" });
}

function compileBinary(target: string, version: string): void {
  var outDir = join(ROOT, "dist");
  mkdirSync(outDir, { recursive: true });
  var outFile = join(outDir, "lattice-" + target);

  console.log("[build] Compiling for " + target + "...");
  var cmd = [
    "bun", "build", "--compile",
    "--target=bun-" + target,
    "--outfile=" + outFile,
    "--define=process.env.LATTICE_VERSION=\"'" + version + "'\"",
    join(ROOT, "server/src/index.ts"),
  ].join(" ");

  execSync(cmd, { cwd: ROOT, stdio: "inherit" });

  var size = statSync(outFile).size;
  console.log("[build] Output: " + outFile + " (" + (size / 1024 / 1024).toFixed(1) + " MB)");
}

function main(): void {
  var { targets, version } = parseArgs();
  console.log("[build] Version: " + version);
  console.log("[build] Targets: " + targets.join(", "));

  buildClient();

  var clientDist = join(ROOT, "client/dist");
  if (!existsSync(clientDist)) {
    console.error("[build] client/dist not found after build");
    process.exit(1);
  }

  generateEmbeddedAssets(clientDist);

  for (var i = 0; i < targets.length; i++) {
    compileBinary(targets[i], version);
  }

  console.log("[build] Done.");
}

main();
