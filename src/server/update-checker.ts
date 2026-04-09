import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./logger";

const __dirname_local = dirname(fileURLToPath(import.meta.url));

const PKG_NAME = "@cryptiklemur/lattice";
const GITHUB_REPO = "cryptiklemur/lattice";
const CHECK_INTERVAL_MS = 3600000;

export type InstallMode = "binary" | "npm";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastCheckedAt: number;
  releaseUrl: string | null;
  installMode: InstallMode;
}

let cached: UpdateInfo | null = null;
let checking = false;

function getCurrentVersion(): string {
  if (process.env.LATTICE_VERSION) return process.env.LATTICE_VERSION;
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname_local, "../../package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function compareVersions(a: string, b: string): number {
  if (!a || !b || typeof a !== "string" || typeof b !== "string") return 0;
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function getInstallMode(): InstallMode {
  return "npm";
}

async function checkGitHub(currentVersion: string): Promise<UpdateInfo> {
  const res = await fetch("https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest", {
    headers: { "Accept": "application/vnd.github.v3+json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error("[lattice] GitHub update check failed: HTTP " + res.status);
    return { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: Date.now(), releaseUrl: null, installMode: "binary" };
  }

  const data = await res.json() as { tag_name?: string; html_url?: string };
  const latestVersion = data.tag_name ? data.tag_name.replace(/^v/, "") : null;
  const updateAvailable = latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

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
  const res = await fetch("https://registry.npmjs.org/" + PKG_NAME + "/latest", {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error("[lattice] npm update check failed: HTTP " + res.status);
    return { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: Date.now(), releaseUrl: null, installMode: "npm" };
  }

  const data = await res.json() as { version?: string };
  const latestVersion = data.version ?? null;
  const updateAvailable = latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0;

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
  const currentVersion = getCurrentVersion();

  if (!force && cached && Date.now() - cached.lastCheckedAt < CHECK_INTERVAL_MS) {
    return cached;
  }

  if (checking) {
    return cached ?? { currentVersion, latestVersion: null, updateAvailable: false, lastCheckedAt: 0, releaseUrl: null, installMode: getInstallMode() };
  }

  checking = true;
  try {
    cached = await checkNpm(currentVersion);

    if (cached.updateAvailable) {
      log.server("Update available: %s -> %s (%s)", currentVersion, cached.latestVersion, cached.installMode);
    }
    return cached;
  } catch (err) {
    console.error("[lattice] Update check error: " + (err instanceof Error ? err.message : String(err)));
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
