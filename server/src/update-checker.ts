import { readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger";
import { IS_COMPILED } from "./runtime";

var PKG_NAME = "@cryptiklemur/lattice";
var GITHUB_REPO = "cryptiklemur/lattice";
var CHECK_INTERVAL_MS = 3600000;

export type InstallMode = "binary" | "npm";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastCheckedAt: number;
  releaseUrl: string | null;
  installMode: InstallMode;
}

var cached: UpdateInfo | null = null;
var checking = false;

function getCurrentVersion(): string {
  if (process.env.LATTICE_VERSION) return process.env.LATTICE_VERSION;
  try {
    var pkg = JSON.parse(readFileSync(join(import.meta.dir, "../../package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function compareVersions(a: string, b: string): number {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return 0;
  var pa = a.replace(/^v/, "").split(".").map(Number);
  var pb = b.replace(/^v/, "").split(".").map(Number);
  for (var i = 0; i < 3; i++) {
    var va = pa[i] || 0;
    var vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function getInstallMode(): InstallMode {
  return IS_COMPILED ? "binary" : "npm";
}

async function checkGitHub(currentVersion: string): Promise<UpdateInfo> {
  var res = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest", {
    headers: { "Accept": "application/vnd.github.v3+json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    log.server("GitHub update check failed: HTTP %d", res.status);
    return { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: Date.now(), releaseUrl: null, installMode: "binary" };
  }

  var data = await res.json() as { tag_name?: string; html_url?: string };
  var latestVersion = data.tag_name ? data.tag_name.replace(/^v/, "") : null;
  var updateAvailable = latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    lastCheckedAt: Date.now(),
    releaseUrl: updateAvailable ? (data.html_url ?? null) : null,
    installMode: "binary",
  };
}

async function checkNpm(currentVersion: string): Promise<UpdateInfo> {
  var res = await fetch("https://registry.npmjs.org/" + PKG_NAME + "/latest", {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    log.server("npm update check failed: HTTP %d", res.status);
    return { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: Date.now(), releaseUrl: null, installMode: "npm" };
  }

  var data = await res.json() as { version?: string };
  var latestVersion = data.version ?? null;
  var updateAvailable = latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    lastCheckedAt: Date.now(),
    releaseUrl: updateAvailable ? "https://github.com/" + GITHUB_REPO + "/releases/tag/v" + latestVersion : null,
    installMode: "npm",
  };
}

export async function checkForUpdate(force: boolean = false): Promise<UpdateInfo> {
  var currentVersion = getCurrentVersion();

  if (!force && cached && Date.now() - cached.lastCheckedAt < CHECK_INTERVAL_MS) {
    return cached;
  }

  if (checking) {
    return cached ?? { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: 0, releaseUrl: null, installMode: getInstallMode() };
  }

  checking = true;
  try {
    cached = IS_COMPILED
      ? await checkGitHub(currentVersion)
      : await checkNpm(currentVersion);

    if (cached.updateAvailable) {
      log.server("Update available: %s -> %s (%s)", currentVersion, cached.latestVersion, cached.installMode);
    }
    return cached;
  } catch (err) {
    log.server("Update check error: %s", err instanceof Error ? err.message : String(err));
    cached = { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: Date.now(), releaseUrl: null, installMode: getInstallMode() };
    return cached;
  } finally {
    checking = false;
  }
}

export function getCachedUpdateInfo(): UpdateInfo | null {
  return cached;
}

export function getPackageName(): string {
  return PKG_NAME;
}

export function getGitHubRepo(): string {
  return GITHUB_REPO;
}

export function startPeriodicUpdateCheck(): void {
  void checkForUpdate();
  setInterval(function () {
    void checkForUpdate();
  }, CHECK_INTERVAL_MS);
}
