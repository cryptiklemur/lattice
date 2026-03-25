#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DAEMON_PID_FILE } from "@lattice/shared";
import { getLatticeHome, loadConfig } from "./config";
import { IS_COMPILED } from "./runtime";

var args = process.argv.slice(2);
var command = "start";
var portOverride: number | null = null;

for (var i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) {
    portOverride = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i].startsWith("--port=")) {
    portOverride = parseInt(args[i].split("=")[1], 10);
  } else if (!args[i].startsWith("-")) {
    command = args[i];
  }
}

function getPidPath(): string {
  return join(getLatticeHome(), DAEMON_PID_FILE);
}

function readPid(): number | null {
  var pidPath = getPidPath();
  if (!existsSync(pidPath)) {
    return null;
  }
  try {
    var raw = readFileSync(pidPath, "utf-8").trim();
    var pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePid(pid: number): void {
  writeFileSync(getPidPath(), String(pid), "utf-8");
}

function removePid(): void {
  var pidPath = getPidPath();
  if (existsSync(pidPath)) {
    try {
      unlinkSync(pidPath);
    } catch {
      // ignore
    }
  }
}

function isDaemonRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

switch (command) {
  case "daemon":
    await runDaemon();
    break;
  case "start":
    await runStart();
    break;
  case "stop":
    runStop();
    break;
  case "status":
    runStatus();
    break;
  case "update":
    await runUpdate();
    break;
  default:
    console.log("[lattice] Unknown command: " + command);
    console.log("[lattice] Usage: lattice [start|stop|status|update|daemon]");
    process.exit(1);
}

async function runDaemon(): Promise<void> {
  var { startDaemon } = await import("./daemon");
  writePid(process.pid);
  var shutdownInProgress = false;
  function gracefulShutdown(): void {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    console.log("[lattice] Shutting down gracefully...");

    var { broadcast, closeAllClients } = require("./ws/broadcast") as typeof import("./ws/broadcast");
    var { getActiveStreamCount } = require("./project/sdk-bridge") as typeof import("./project/sdk-bridge");
    var { stopMeshConnections } = require("./mesh/connector") as typeof import("./mesh/connector");

    broadcast({ type: "chat:error", message: "Server is shutting down" });
    stopMeshConnections();

    var waited = 0;
    var checkInterval = setInterval(function () {
      var activeCount = getActiveStreamCount();
      waited += 500;
      if (activeCount === 0 || waited >= 5000) {
        clearInterval(checkInterval);
        closeAllClients();
        removePid();
        process.exit(0);
      }
    }, 500);
  }
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  await startDaemon(portOverride);
}

async function runStart(): Promise<void> {
  var pid = readPid();
  if (pid !== null && isDaemonRunning(pid)) {
    console.log("[lattice] Daemon is already running (PID " + pid + ")");
    var config = loadConfig();
    var url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
    openBrowser(url);
    return;
  }

  removePid();

  var logPath = join(getLatticeHome(), "daemon.log");

  var spawnArgs = IS_COMPILED
    ? [process.execPath, "daemon"]
    : ["bun", import.meta.path, "daemon"];

  var child = Bun.spawn(spawnArgs, {
    detached: true,
    stdio: ["ignore", Bun.file(logPath), Bun.file(logPath)],
  });

  child.unref();

  var childPid = child.pid;
  writePid(childPid);
  console.log("[lattice] Daemon started (PID " + childPid + ")");
  console.log("[lattice] Logs: " + logPath);

  await new Promise<void>(function (resolve) {
    setTimeout(resolve, 800);
  });

  var config = loadConfig();
  var url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
  console.log("[lattice] Opening " + url);
  openBrowser(url);
}

function runStop(): void {
  var pid = readPid();
  if (pid === null) {
    console.log("[lattice] No PID file found. Daemon may not be running.");
    process.exit(1);
  }

  if (!isDaemonRunning(pid)) {
    console.log("[lattice] Daemon is not running (stale PID " + pid + ")");
    removePid();
    process.exit(0);
  }

  try {
    process.kill(pid, "SIGTERM");
    removePid();
    console.log("[lattice] Daemon stopped (PID " + pid + ")");
  } catch (err) {
    console.error("[lattice] Failed to stop daemon:", err);
    process.exit(1);
  }
}

function runStatus(): void {
  var pid = readPid();
  if (pid === null) {
    console.log("[lattice] Status: not running (no PID file)");
    process.exit(0);
  }

  if (!isDaemonRunning(pid)) {
    console.log("[lattice] Status: not running (stale PID " + pid + ")");
    removePid();
    process.exit(0);
  }

  var config = loadConfig();
  var url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
  console.log("[lattice] Status: running");
  console.log("[lattice] PID:    " + pid);
  console.log("[lattice] Port:   " + config.port);
  console.log("[lattice] URL:    " + url);
}

async function runUpdate(): Promise<void> {
  var { checkForUpdate, getPackageName, getGitHubRepo } = await import("./update-checker");
  console.log("[lattice] Checking for updates...");
  var info = await checkForUpdate(true);

  if (!info.latestVersion) {
    console.log("[lattice] Could not check for updates. Try again later.");
    process.exit(1);
  }

  if (!info.updateAvailable) {
    console.log("[lattice] Already on latest version (%s)", info.currentVersion);
    process.exit(0);
  }

  console.log("[lattice] Update available: %s -> %s (%s)", info.currentVersion, info.latestVersion, info.installMode);
  console.log("[lattice] Installing...");

  var code: number;

  if (IS_COMPILED) {
    var { chmodSync, renameSync, writeFileSync } = await import("node:fs");
    var repo = getGitHubRepo();
    var platform = process.platform === "darwin" ? "darwin" : "linux";
    var arch = process.arch === "arm64" ? "arm64" : "x64";
    var assetName = "lattice-" + platform + "-" + arch;

    try {
      var releaseRes = await fetch("https://api.github.com/repos/" + repo + "/releases/latest", {
        headers: { "Accept": "application/vnd.github.v3+json" },
      });
      var release = await releaseRes.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
      var asset = (release.assets ?? []).find(function (a) { return a.name === assetName; });

      if (!asset) {
        console.error("[lattice] No binary found for " + assetName);
        process.exit(1);
      }

      console.log("[lattice] Downloading " + assetName + "...");
      var downloadRes = await fetch(asset.browser_download_url);
      var binary = new Uint8Array(await downloadRes.arrayBuffer());
      var tmpPath = process.execPath + ".update";
      writeFileSync(tmpPath, binary);
      chmodSync(tmpPath, 0o755);
      renameSync(tmpPath, process.execPath);
      code = 0;
    } catch (err) {
      console.error("[lattice] Download failed:", err instanceof Error ? err.message : String(err));
      code = 1;
    }
  } else {
    var pkgName = getPackageName();
    var proc = Bun.spawn(["bun", "install", "-g", pkgName + "@latest"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    code = await proc.exited;
  }

  if (code === 0) {
    console.log("[lattice] Updated to %s", info.latestVersion);

    var pid = readPid();
    if (pid !== null && isDaemonRunning(pid)) {
      console.log("[lattice] Restarting daemon...");
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
      removePid();
      await new Promise<void>(function (resolve) { setTimeout(resolve, 1000); });

      var logPath = join(getLatticeHome(), "daemon.log");
      var restartArgs = IS_COMPILED
        ? [process.execPath, "daemon"]
        : ["bun", import.meta.path, "daemon"];
      var child = Bun.spawn(restartArgs, {
        detached: true,
        stdio: ["ignore", Bun.file(logPath), Bun.file(logPath)],
      });
      child.unref();
      writePid(child.pid);
      console.log("[lattice] Daemon restarted (PID %d)", child.pid);
    }
  } else {
    console.error("[lattice] Update failed (exit code %d)", code);
    process.exit(1);
  }
}

function openBrowser(url: string): void {
  var platform = process.platform;
  try {
    if (platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", url], { detached: true, stdio: ["ignore", "ignore", "ignore"] }).unref();
    } else if (platform === "darwin") {
      Bun.spawn(["open", url], { detached: true, stdio: ["ignore", "ignore", "ignore"] }).unref();
    } else {
      Bun.spawn(["xdg-open", url], { detached: true, stdio: ["ignore", "ignore", "ignore"] }).unref();
    }
  } catch {
    console.log("[lattice] Could not open browser. Visit: " + url);
  }
}
