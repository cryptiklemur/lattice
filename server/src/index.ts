import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DAEMON_PID_FILE } from "@lattice/shared";
import { getLatticeHome, loadConfig } from "./config";

var args = process.argv.slice(2);
var command = args[0] || "start";

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
  default:
    console.log("[lattice] Unknown command: " + command);
    console.log("[lattice] Usage: lattice [start|stop|status|daemon]");
    process.exit(1);
}

async function runDaemon(): Promise<void> {
  var { startDaemon } = await import("./daemon");
  writePid(process.pid);
  process.on("SIGTERM", function () {
    removePid();
    process.exit(0);
  });
  process.on("SIGINT", function () {
    removePid();
    process.exit(0);
  });
  await startDaemon();
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

  var scriptPath = import.meta.path;
  var logPath = join(getLatticeHome(), "daemon.log");

  var child = Bun.spawn(["bun", scriptPath, "daemon"], {
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
