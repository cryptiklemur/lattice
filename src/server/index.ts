#!/usr/bin/env node
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { getLatticeHome, loadConfig } from "./config";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = dirname(__filename_local);

function getCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname_local, "../../package.json"), "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const args = process.argv.slice(2);
let command = "help";
let portOverride: number | null = null;
let tlsOverride: boolean | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && i + 1 < args.length) {
    portOverride = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i].startsWith("--port=")) {
    portOverride = parseInt(args[i].split("=")[1], 10);
  } else if (args[i] === "--tls") {
    tlsOverride = true;
  } else if (args[i] === "--no-tls") {
    tlsOverride = false;
  } else if (!args[i].startsWith("-")) {
    command = args[i];
  }
}

function getEffectivePort(): number {
  return portOverride ?? loadConfig().port;
}

function getPidPath(port?: number): string {
  const p = port ?? getEffectivePort();
  return join(getLatticeHome(), "daemon-" + p + ".pid");
}

function readPid(port?: number): number | null {
  const pidPath = getPidPath(port);
  if (!existsSync(pidPath)) {
    return null;
  }
  try {
    const raw = readFileSync(pidPath, "utf-8").trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function writePid(pid: number, port?: number): void {
  writeFileSync(getPidPath(port), String(pid), "utf-8");
}

function removePid(port?: number): void {
  const pidPath = getPidPath(port);
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

function spawnDaemon(port: number, tls?: boolean | null): number {
  const logPath = join(getLatticeHome(), "daemon.log");
  const logFd = openSync(logPath, "a");
  const isDev = __filename_local.endsWith(".ts");
  let spawnCmd: string;
  let spawnArgs: string[];
  if (isDev) {
    const pkgRoot = join(__dirname_local, "..");
    const localTsx = join(pkgRoot, "node_modules", ".bin", "tsx");
    spawnCmd = existsSync(localTsx) ? localTsx : "tsx";
    spawnArgs = ["--tsconfig", join(pkgRoot, "tsconfig.json"), __filename_local, "run", "--port", String(port)];
  } else {
    spawnCmd = process.execPath;
    spawnArgs = [__filename_local, "run", "--port", String(port)];
  }
  if (tls === true) spawnArgs.push("--tls");
  if (tls === false) spawnArgs.push("--no-tls");
  const child = spawn(spawnCmd, spawnArgs, {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, LATTICE_PORT: undefined },
  });
  child.unref();
  return child.pid!;
}

switch (command) {
  case "run":
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
  case "setup-tls":
    await runSetupTls();
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
  const { printBanner, printStatus, printQrCode, runOnboarding } = await import("./tui");
  const { startDaemon } = await import("./daemon");
  const { broadcast, closeAllClients } = await import("./ws/broadcast");
  const { getActiveStreamCount } = await import("./project/sdk-bridge");
  const { stopMeshConnections } = await import("./mesh/connector");

  const onboarding = await runOnboarding();
  if (onboarding.passphrase) {
    const { hashPassphrase } = await import("./auth/passphrase");
    const config = loadConfig();
    config.passphraseHash = await hashPassphrase(onboarding.passphrase);
    const { saveConfig: saveCfg } = await import("./config");
    saveCfg(config);
  }

  const effectivePort = portOverride ?? onboarding.port;

  writePid(process.pid);
  let shutdownInProgress = false;
  function gracefulShutdown(): void {
    if (shutdownInProgress) return;
    shutdownInProgress = true;
    console.log("\n[lattice] Shutting down gracefully...");

    broadcast({ type: "chat:error", message: "Server is shutting down" });
    stopMeshConnections();

    let waited = 0;
    const maxWait = 2000;
    const checkInterval = setInterval(function () {
      const activeCount = getActiveStreamCount();
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
  await startDaemon(effectivePort, tlsOverride);

  const config = loadConfig();
  const protocol = config.tls ? "https" : "http";
  const url = protocol + "://localhost:" + config.port;
  const version = getCurrentVersion();
  const projectCount = config.projects.length;
  let sessionCount = 0;
  try {
    const { listSessions } = await import("./project/session");
    for (let i = 0; i < config.projects.length; i++) {
      const result = await listSessions(config.projects[i].slug, { limit: 0 });
      sessionCount += result.totalCount;
    }
  } catch {}

  let tailscaleUrl: string | undefined;
  try {
    const tsResult = execSync("tailscale status --json", { encoding: "utf-8" });
    const tsHostname = JSON.parse(tsResult).Self.DNSName.replace(/\.$/, "");
    if (tsHostname) {
      tailscaleUrl = protocol + "://" + tsHostname + ":" + config.port;
    }
  } catch {}

  printBanner();
  await printQrCode(url);
  printStatus(config, version, projectCount, sessionCount, tailscaleUrl);
}

async function runStart(): Promise<void> {
  const pid = readPid();
  if (pid !== null && isDaemonRunning(pid)) {
    console.log("[lattice] Daemon is already running (PID " + pid + ")");
    const config = loadConfig();
    const url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
    openBrowser(url);
    return;
  }

  removePid();

  const config = loadConfig();
  const port = portOverride ?? config.port;
  const childPid = spawnDaemon(port, tlsOverride);
  writePid(childPid);
  console.log("[lattice] Daemon started (PID " + childPid + ")");
  console.log("[lattice] Logs: " + join(getLatticeHome(), "daemon.log"));

  await new Promise<void>(function (resolve) {
    setTimeout(resolve, 800);
  });

  const url = (config.tls ? "https" : "http") + "://localhost:" + port;
  console.log("[lattice] Opening " + url);
  openBrowser(url);
}

function runStop(): void {
  const pid = readPid();
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
  console.log("    start      Start the daemon and open the UI");
  console.log("    run        Run the daemon in the foreground");
  console.log("    stop       Stop the running daemon");
  console.log("    restart    Stop and restart the daemon");
  console.log("    status     Show daemon status and connection info");
  console.log("    update     Check for updates and install the latest version");
  console.log("    version    Show current and latest version");
  console.log("    logs       Tail the daemon log");
  console.log("    open       Open the UI in the browser");
  console.log("    config     Show configuration paths and settings");
  console.log("    setup-tls  Set up HTTPS (Tailscale or self-signed)");
  console.log("    help       Show this help message (default)");
  console.log("");
  console.log("  Options:");
  console.log("    --port=N   Override the server port");
  console.log("    --tls      Enable HTTPS with auto-generated self-signed cert");
  console.log("    --no-tls   Disable HTTPS (use HTTP)");
  console.log("");
  console.log("  Environment:");
  console.log("    LATTICE_HOME   Data directory (default: ~/.lattice)");
  console.log("    DEBUG          Enable debug logging (e.g. DEBUG=lattice:*)");
  console.log("");
}

async function runSetupTls(): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  const { createInterface } = await import("node:readline");
  const { mkdirSync, chmodSync, chownSync, statSync } = await import("node:fs");
  const certsDir = join(getLatticeHome(), "certs");
  const certPath = join(certsDir, "cert.pem");
  const keyPath = join(certsDir, "key.pem");

  function prompt(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(function (resolve) {
      rl.question(question, function (answer) {
        rl.close();
        resolve(answer.trim().toLowerCase());
      });
    });
  }

  console.log("");
  console.log("  lattice — TLS Setup");
  console.log("");

  let hasTailscale = false;
  let hostname = "";
  try {
    spawnSync("tailscale", ["version"], { stdio: "ignore" });
    hasTailscale = true;
    const statusResult = spawnSync("tailscale", ["status", "--json"], { encoding: "utf-8" });
    if (statusResult.status === 0) {
      hostname = JSON.parse(statusResult.stdout).Self.DNSName.replace(/\.$/, "");
    }
  } catch {}

  if (hasTailscale && hostname) {
    console.log("  Tailscale detected: " + hostname);
    console.log("");

    const answer = await prompt("  Set up Tailscale HTTPS certs automatically? [Y/n] ");
    if (answer !== "n" && answer !== "no") {
      if (!existsSync(certsDir)) {
        mkdirSync(certsDir, { recursive: true });
      }

      console.log("");
      console.log("  Generating Tailscale cert (sudo required)...");
      console.log("");

      const certResult = spawnSync(
        "sudo",
        ["tailscale", "cert", "--cert-file", certPath, "--key-file", keyPath, hostname],
        { stdio: "inherit" }
      );

      if (certResult.status !== 0) {
        console.error("");
        console.error("  Failed to generate Tailscale certs.");
        console.error("  You can run manually:");
        console.error("    sudo tailscale cert --cert-file " + certPath + " --key-file " + keyPath + " " + hostname);
        process.exit(1);
      }

      const uid = process.getuid ? process.getuid() : 0;
      const gid = process.getgid ? process.getgid() : 0;
      try {
        chownSync(certPath, uid, gid);
        chownSync(keyPath, uid, gid);
        chmodSync(certPath, 0o644);
        chmodSync(keyPath, 0o600);
      } catch {
        console.log("  Fixing permissions with sudo...");
        spawnSync("sudo", ["chown", uid + ":" + gid, certPath, keyPath], { stdio: "inherit" });
        spawnSync("sudo", ["chmod", "644", certPath], { stdio: "inherit" });
        spawnSync("sudo", ["chmod", "600", keyPath], { stdio: "inherit" });
      }

      console.log("");
      console.log("  Certs installed and permissions fixed.");

      const config = loadConfig();
      if (!config.tls) {
        const { saveConfig: saveCfg } = await import("./config");
        config.tls = true;
        saveCfg(config);
        console.log("  TLS enabled in config.");
      }

      const pid = readPid();
      if (pid !== null && isDaemonRunning(pid)) {
        const restartAnswer = await prompt("  Daemon is running. Restart with TLS? [Y/n] ");
        if (restartAnswer !== "n" && restartAnswer !== "no") {
          console.log("  Restarting daemon...");
          try { process.kill(pid, "SIGTERM"); } catch {}
          removePid();
          await new Promise<void>(function (r) { setTimeout(r, 1500); });
          const port = portOverride ?? config.port;
          const childPid = spawnDaemon(port, true);
          writePid(childPid);
          console.log("  Daemon restarted (PID " + childPid + ")");
        }
      }

      console.log("");
      console.log("  Access at: https://" + hostname + ":" + loadConfig().port);
      console.log("");
      return;
    }
  } else if (hasTailscale) {
    console.log("  Tailscale detected but could not determine hostname.");
    console.log("  Run 'tailscale status' to verify your connection.");
    console.log("");
  }

  console.log("  ── Self-signed certificate ──");
  console.log("");

  if (existsSync(certPath) && existsSync(keyPath)) {
    console.log("  Cert exists: " + certPath);
    console.log("  To regenerate: rm -rf " + certsDir + " && lattice setup-tls");
  } else {
    const selfSignAnswer = await prompt("  Generate a self-signed certificate? [Y/n] ");
    if (selfSignAnswer !== "n" && selfSignAnswer !== "no") {
      const { ensureCerts } = await import("./tls");
      try {
        const certs = ensureCerts();
        console.log("  Certificate generated: " + certs.cert);

        const config = loadConfig();
        if (!config.tls) {
          const { saveConfig: saveCfg } = await import("./config");
          config.tls = true;
          saveCfg(config);
          console.log("  TLS enabled in config.");
        }

        const pid = readPid();
        if (pid !== null && isDaemonRunning(pid)) {
          const restartAnswer = await prompt("  Daemon is running. Restart with TLS? [Y/n] ");
          if (restartAnswer !== "n" && restartAnswer !== "no") {
            console.log("  Restarting daemon...");
            try { process.kill(pid, "SIGTERM"); } catch {}
            removePid();
            await new Promise<void>(function (r) { setTimeout(r, 1500); });
            const port = portOverride ?? config.port;
            const childPid = spawnDaemon(port, true);
            writePid(childPid);
            console.log("  Daemon restarted (PID " + childPid + ")");
          }
        }
      } catch (err) {
        console.error("  Failed to generate certificate:", err);
        process.exit(1);
      }
    }
  }

  console.log("");
  console.log("  To trust the self-signed cert (removes browser warnings):");
  console.log("");
  console.log("  Linux:");
  console.log("    sudo cp " + certPath + " /usr/local/share/ca-certificates/lattice.crt");
  console.log("    sudo update-ca-certificates");
  console.log("");
  console.log("  macOS:");
  console.log("    sudo security add-trusted-cert -d -r trustRoot \\");
  console.log("      -k /Library/Keychains/System.keychain " + certPath);
  console.log("");
  console.log("  Windows (PowerShell as admin):");
  console.log("    Import-Certificate -FilePath " + certPath + " -CertStoreLocation Cert:\\LocalMachine\\Root");
  console.log("");
}

async function runRestart(): Promise<void> {
  const pid = readPid();
  if (pid !== null && isDaemonRunning(pid)) {
    console.log("[lattice] Stopping daemon (PID " + pid + ")...");
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
    removePid();

    let waited = 0;
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
  const restartPort = portOverride ?? loadConfig().port;
  const childPid = spawnDaemon(restartPort, tlsOverride);
  writePid(childPid);
  console.log("[lattice] Daemon started (PID " + childPid + ")");
}

async function runVersion(): Promise<void> {
  const { checkForUpdate } = await import("./update-checker");
  const info = await checkForUpdate(true);
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
  const logPath = join(getLatticeHome(), "daemon.log");
  if (!existsSync(logPath)) {
    console.log("[lattice] No log file found at " + logPath);
    process.exit(1);
  }
  console.log("[lattice] Tailing " + logPath + " (Ctrl+C to stop)");
  const proc = spawn("tail", ["-f", "-n", "50", logPath], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  process.on("SIGINT", function () {
    proc.kill();
    process.exit(0);
  });
}

function runOpen(): void {
  const config = loadConfig();
  const pid = readPid();
  if (pid === null || !isDaemonRunning(pid)) {
    console.log("[lattice] Daemon is not running. Start it with 'lattice start'");
    process.exit(1);
  }
  const url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
  console.log("[lattice] Opening " + url);
  openBrowser(url);
}

function runConfigInfo(): void {
  const config = loadConfig();
  const home = getLatticeHome();
  console.log("[lattice] Home:       " + home);
  console.log("[lattice] Config:     " + join(home, "config.json"));
  console.log("[lattice] Port:       " + config.port);
  console.log("[lattice] Name:       " + config.name);
  console.log("[lattice] TLS:        " + (config.tls ? "enabled" : "disabled"));
  console.log("[lattice] Projects:   " + config.projects.length);
  for (let i = 0; i < config.projects.length; i++) {
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
  const pid = readPid();
  if (pid === null) {
    console.log("[lattice] Status: not running (no PID file)");
    process.exit(0);
  }

  if (!isDaemonRunning(pid)) {
    console.log("[lattice] Status: not running (stale PID " + pid + ")");
    removePid();
    process.exit(0);
  }

  const config = loadConfig();
  const url = (config.tls ? "https" : "http") + "://localhost:" + config.port;
  console.log("[lattice] Status: running");
  console.log("[lattice] PID:    " + pid);
  console.log("[lattice] Port:   " + config.port);
  console.log("[lattice] URL:    " + url);
}

async function runUpdate(): Promise<void> {
  const { checkForUpdate, getPackageName } = await import("./update-checker");
  console.log("[lattice] Checking for updates...");
  const info = await checkForUpdate(true);

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

  const pkgName = getPackageName();
  const proc = spawn("npm", ["install", "-g", pkgName + "@latest"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  const code = await new Promise<number>(function (resolve) {
    proc.on("close", function (c) { resolve(c ?? 1); });
  });

  if (code === 0) {
    console.log("[lattice] Updated to %s", info.latestVersion);

    const pid = readPid();
    if (pid !== null && isDaemonRunning(pid)) {
      console.log("[lattice] Restarting daemon...");
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
      removePid();
      await new Promise<void>(function (resolve) { setTimeout(resolve, 1000); });

      const updatePort = portOverride ?? loadConfig().port;
      const childPid = spawnDaemon(updatePort, tlsOverride);
      writePid(childPid);
      console.log("[lattice] Daemon restarted (PID %d)", childPid);
    }
  } else {
    console.error("[lattice] Update failed (exit code %d)", code);
    process.exit(1);
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
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
