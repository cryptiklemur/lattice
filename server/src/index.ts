#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DAEMON_PID_FILE } from "@lattice/shared";
import { getLatticeHome, loadConfig } from "./config";
import { IS_COMPILED } from "./runtime";

var args = process.argv.slice(2);
var command = "start";
var portOverride: number | null = process.env.LATTICE_PORT ? parseInt(process.env.LATTICE_PORT, 10) : null;

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
  case "restart":
    runRestart();
    break;
  case "status":
    runStatus();
    break;
  case "update":
    await runUpdate();
    break;
  case "version":
    await runVersion();
    break;
  case "logs":
    runLogs();
    break;
  case "open":
    runOpen();
    break;
  case "config":
    runConfigInfo();
    break;
  case "help":
  case "--help":
  case "-h":
    runHelp();
    break;
  default:
    console.log("[lattice] Unknown command: " + command);
    runHelp();
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

function runHelp(): void {
  console.log("");
  console.log("  lattice — Multi-machine agentic dashboard for Claude Code");
  console.log("");
  console.log("  Usage: lattice [command] [options]");
  console.log("");
  console.log("  Commands:");
  console.log("    start      Start the daemon and open the UI (default)");
  console.log("    stop       Stop the running daemon");
  console.log("    restart    Stop and restart the daemon");
  console.log("    status     Show daemon status and connection info");
  console.log("    update     Check for updates and install the latest version");
  console.log("    version    Show current and latest version");
  console.log("    logs       Tail the daemon log");
  console.log("    open       Open the UI in the browser");
  console.log("    config     Show configuration paths and settings");
  console.log("    help       Show this help message");
  console.log("");
  console.log("  Options:");
  console.log("    --port=N   Override the server port");
  console.log("");
  console.log("  Environment:");
  console.log("    LATTICE_HOME   Data directory (default: ~/.lattice)");
  console.log("    LATTICE_PORT   Server port (default: 7654)");
  console.log("    DEBUG          Enable debug logging (e.g. DEBUG=lattice:*)");
  console.log("                   Scopes: server,ws,router,mesh,mesh:connect,mesh:hello,");
  console.log("                   mesh:proxy,broadcast,chat,session,plugins,update");
  console.log("");
}

function runRestart(): void {
  var pid = readPid();
  if (pid !== null && isDaemonRunning(pid)) {
    console.log("[lattice] Stopping daemon (PID " + pid + ")...");
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    removePid();

    var waited = 0;
    while (waited < 5000) {
      try {
        process.kill(pid, 0);
        Bun.sleepSync(200);
        waited += 200;
      } catch {
        break;
      }
    }
  }

  console.log("[lattice] Starting daemon...");
  var logPath = join(getLatticeHome(), "daemon.log");

  var spawnArgs = IS_COMPILED
    ? [process.execPath, "daemon"]
    : ["bun", import.meta.path, "daemon"];

  if (portOverride) {
    spawnArgs.push("--port", String(portOverride));
  }

  var child = Bun.spawn(spawnArgs, {
    detached: true,
    stdio: ["ignore", Bun.file(logPath), Bun.file(logPath)],
  });

  child.unref();
  writePid(child.pid);
  console.log("[lattice] Daemon started (PID " + child.pid + ")");
}

async function runVersion(): Promise<void> {
  var { checkForUpdate } = await import("./update-checker");
  var info = await checkForUpdate(true);
  console.log("[lattice] Current: v" + info.currentVersion);
  if (info.latestVersion) {
    if (info.updateAvailable) {
      console.log("[lattice] Latest:  v" + info.latestVersion + " (update available)");
      console.log("[lattice] Run 'lattice update' to install");
    } else {
      console.log("[lattice] Latest:  v" + info.latestVersion + " (up to date)");
    }
  }
  console.log("[lattice] Mode:    " + info.installMode);
}

function runLogs(): void {
  var logPath = join(getLatticeHome(), "daemon.log");
  if (!existsSync(logPath)) {
    console.log("[lattice] No log file found at " + logPath);
    process.exit(1);
  }
  console.log("[lattice] Tailing " + logPath + " (Ctrl+C to stop)");
  var proc = Bun.spawn(["tail", "-f", "-n", "50", logPath], {
    stdout: "inherit",
    stderr: "inherit",
  });
  process.on("SIGINT", function () {
    proc.kill();
    process.exit(0);
  });
}

function runOpen(): void {
  var config = loadConfig();
  var pid = readPid();
  if (pid === null || !isDaemonRunning(pid)) {
    console.log("[lattice] Daemon is not running. Start it with 'lattice start'");
    process.exit(1);
  }
  var url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
  console.log("[lattice] Opening " + url);
  openBrowser(url);
}

function runConfigInfo(): void {
  var config = loadConfig();
  var home = getLatticeHome();
  console.log("[lattice] Home:       " + home);
  console.log("[lattice] Config:     " + join(home, "config.json"));
  console.log("[lattice] Port:       " + config.port);
  console.log("[lattice] Name:       " + config.name);
  console.log("[lattice] TLS:        " + (config.tls ? "enabled" : "disabled"));
  console.log("[lattice] Projects:   " + config.projects.length);
  for (var i = 0; i < config.projects.length; i++) {
    console.log("             " + config.projects[i].slug + " → " + config.projects[i].path);
  }
  if (config.passphraseHash) {
    console.log("[lattice] Passphrase: set");
  }
  if (config.costBudget) {
    console.log("[lattice] Budget:     $" + config.costBudget.dailyLimit + "/day (" + config.costBudget.enforcement + ")");
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
      var { tmpdir } = await import("node:os");
      var tmpPath = join(tmpdir(), "lattice-update-" + Date.now());
      writeFileSync(tmpPath, binary);
      chmodSync(tmpPath, 0o755);

      var needsSudo = false;
      try {
        var { accessSync, constants: fsConstants } = await import("node:fs");
        accessSync(process.execPath, fsConstants.W_OK);
      } catch {
        needsSudo = true;
      }

      if (needsSudo) {
        console.log("[lattice] Needs elevated permissions to replace binary...");
        var { execSync } = await import("node:child_process");
        execSync("sudo cp " + JSON.stringify(tmpPath) + " " + JSON.stringify(process.execPath), { stdio: "inherit" });
        execSync("sudo chmod +x " + JSON.stringify(process.execPath), { stdio: "inherit" });
      } else {
        var { copyFileSync: cpSync, unlinkSync: rmSync } = await import("node:fs");
        cpSync(tmpPath, process.execPath);
        chmodSync(process.execPath, 0o755);
        rmSync(tmpPath);
      }
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
