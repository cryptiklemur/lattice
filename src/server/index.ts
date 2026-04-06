#!/usr/bin/env node
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { getLatticeHome, loadConfig } from "./config";

var __filename_local = fileURLToPath(import.meta.url);
var __dirname_local = dirname(__filename_local);

function getCurrentVersion(): string {
  try {
    var pkg = JSON.parse(readFileSync(join(__dirname_local, "../../package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

function getEffectivePort(): number {
  return portOverride ?? loadConfig().port;
}

function getPidPath(port?: number): string {
  var p = port ?? getEffectivePort();
  return join(getLatticeHome(), "daemon-" + p + ".pid");
}

function readPid(port?: number): number | null {
  var pidPath = getPidPath(port);
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

function writePid(pid: number, port?: number): void {
  writeFileSync(getPidPath(port), String(pid), "utf-8");
}

function removePid(port?: number): void {
  var pidPath = getPidPath(port);
  if (existsSync(pidPath)) {
    try {
      unlinkSync(pidPath);
    } catch {
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

function spawnDaemon(port: number): number {
  var logPath = join(getLatticeHome(), "daemon.log");
  var logFd = openSync(logPath, "a");
  var isDev = __filename_local.endsWith(".ts");
  var spawnCmd: string;
  var spawnArgs: string[];
  if (isDev) {
    var pkgRoot = join(__dirname_local, "..");
    var localTsx = join(pkgRoot, "node_modules", ".bin", "tsx");
    spawnCmd = existsSync(localTsx) ? localTsx : "tsx";
    spawnArgs = ["--tsconfig", join(pkgRoot, "tsconfig.json"), __filename_local, "daemon", "--port", String(port)];
  } else {
    spawnCmd = process.execPath;
    spawnArgs = [__filename_local, "daemon", "--port", String(port)];
  }
  var child = spawn(spawnCmd, spawnArgs, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, LATTICE_PORT: undefined },
  });
  child.unref();
  return child.pid!;
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
    await runRestart();
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
  var { printBanner, printStatus, printQrCode, runOnboarding } = await import("./tui");
  var { startDaemon } = await import("./daemon");
  var { broadcast, closeAllClients } = await import("./ws/broadcast");
  var { getActiveStreamCount } = await import("./project/sdk-bridge");
  var { stopMeshConnections } = await import("./mesh/connector");

  var onboarding = await runOnboarding();
  if (onboarding.passphrase) {
    var { hashPassphrase } = await import("./auth/passphrase");
    var config = loadConfig();
    config.passphraseHash = await hashPassphrase(onboarding.passphrase);
    var { saveConfig: saveCfg } = await import("./config");
    saveCfg(config);
  }

  var effectivePort = portOverride ?? onboarding.port;

  writePid(process.pid);
  var shutdownInProgress = false;
  function gracefulShutdown(): void {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    console.log("\n[lattice] Shutting down gracefully...");

    broadcast({ type: "chat:error", message: "Server is shutting down" });
    stopMeshConnections();

    var waited = 0;
    var maxWait = 2000;
    var checkInterval = setInterval(function () {
      var activeCount = getActiveStreamCount();
      waited += 500;
      if (activeCount === 0 || waited >= maxWait) {
        clearInterval(checkInterval);
        closeAllClients();
        removePid();
        process.exit(0);
      }
    }, 500);
  }
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
  await startDaemon(effectivePort);

  var config = loadConfig();
  var protocol = config.tls ? "https" : "http";
  var url = protocol + "://localhost:" + config.port;
  var version = getCurrentVersion();
  var projectCount = config.projects.length;
  var sessionCount = 0;
  try {
    var { listSessions } = await import("./project/session");
    for (var i = 0; i < config.projects.length; i++) {
      var result = await listSessions(config.projects[i].slug, { limit: 0 });
      sessionCount += result.totalCount;
    }
  } catch {}

  printBanner();
  await printQrCode(url);
  printStatus(config, version, projectCount, sessionCount);
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

  var config = loadConfig();
  var port = portOverride ?? config.port;
  var childPid = spawnDaemon(port);
  writePid(childPid);
  console.log("[lattice] Daemon started (PID " + childPid + ")");
  console.log("[lattice] Logs: " + join(getLatticeHome(), "daemon.log"));

  await new Promise<void>(function (resolve) {
    setTimeout(resolve, 800);
  });

  var url = (config.tls ? "https" : "http") + "://localhost:" + port;
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
  console.log("    DEBUG          Enable debug logging (e.g. DEBUG=lattice:*)");
  console.log("");
}

async function runRestart(): Promise<void> {
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
        await new Promise<void>(function (r) { setTimeout(r, 200); });
        waited += 200;
      } catch {
        break;
      }
    }
  }

  console.log("[lattice] Starting daemon...");
  var restartPort = portOverride ?? loadConfig().port;
  var childPid = spawnDaemon(restartPort);
  writePid(childPid);
  console.log("[lattice] Daemon started (PID " + childPid + ")");
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
  console.log("[lattice] Mode:    npm");
}

function runLogs(): void {
  var logPath = join(getLatticeHome(), "daemon.log");
  if (!existsSync(logPath)) {
    console.log("[lattice] No log file found at " + logPath);
    process.exit(1);
  }
  console.log("[lattice] Tailing " + logPath + " (Ctrl+C to stop)");
  var proc = spawn("tail", ["-f", "-n", "50", logPath], {
    stdio: ["ignore", "inherit", "inherit"],
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
  var { checkForUpdate, getPackageName } = await import("./update-checker");
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

  console.log("[lattice] Update available: %s -> %s", info.currentVersion, info.latestVersion);
  console.log("[lattice] Installing...");

  var pkgName = getPackageName();
  var proc = spawn("npm", ["install", "-g", pkgName + "@latest"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  var code = await new Promise<number>(function (resolve) {
    proc.on("close", function (c) { resolve(c ?? 1); });
  });

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

      var updatePort = portOverride ?? loadConfig().port;
      var childPid = spawnDaemon(updatePort);
      writePid(childPid);
      console.log("[lattice] Daemon restarted (PID %d)", childPid);
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
      spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    console.log("[lattice] Could not open browser. Visit: " + url);
  }
}
