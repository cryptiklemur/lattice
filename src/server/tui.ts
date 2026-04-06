import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getLatticeHome, loadConfig, saveConfig } from "./config";
import type { LatticeConfig } from "#shared";
import { DEFAULT_PORT } from "#shared";

var BANNER = `
  \x1b[36m██╗\x1b[0m      \x1b[36m█████╗\x1b[0m \x1b[36m████████╗████████╗██╗\x1b[0m \x1b[36m██████╗\x1b[0m \x1b[36m███████╗\x1b[0m
  \x1b[36m██║\x1b[0m     \x1b[36m██╔══██╗\x1b[0m\x1b[2m╚══\x1b[0m\x1b[36m██\x1b[0m\x1b[2m╔══╝╚══\x1b[0m\x1b[36m██\x1b[0m\x1b[2m╔══╝\x1b[0m\x1b[36m██║\x1b[0m\x1b[36m██╔════╝\x1b[0m\x1b[36m██╔════╝\x1b[0m
  \x1b[36m██║\x1b[0m     \x1b[36m███████║\x1b[0m   \x1b[36m██║\x1b[0m      \x1b[36m██║\x1b[0m   \x1b[36m██║██║\x1b[0m     \x1b[36m█████╗\x1b[0m
  \x1b[36m██║\x1b[0m     \x1b[36m██╔══██║\x1b[0m   \x1b[36m██║\x1b[0m      \x1b[36m██║\x1b[0m   \x1b[36m██║██║\x1b[0m     \x1b[36m██╔══╝\x1b[0m
  \x1b[36m███████╗██║  ██║\x1b[0m   \x1b[36m██║\x1b[0m      \x1b[36m██║\x1b[0m   \x1b[36m██║\x1b[0m\x1b[2m╚\x1b[0m\x1b[36m██████╗███████╗\x1b[0m
  \x1b[2m╚══════╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝ ╚═════╝╚══════╝\x1b[0m
`;

export function printBanner(): void {
  console.log(BANNER);
}

export function printStatus(config: LatticeConfig, version: string, projectCount: number, sessionCount: number, tailscaleUrl?: string): void {
  var protocol = config.tls ? "https" : "http";
  var url = protocol + "://localhost:" + config.port;

  var lines = "lattice v" + version + " — " + url + "\n";
  if (tailscaleUrl) {
    lines += tailscaleUrl + "\n";
  }
  lines += projectCount + " project" + (projectCount !== 1 ? "s" : "") +
    " · " + sessionCount + " session" + (sessionCount !== 1 ? "s" : "") + "\n" +
    "Press Ctrl+C to stop";

  console.log("");
  p.note(lines, "Running");
  console.log("");
}

export async function printQrCode(url: string): Promise<void> {
  try {
    var qrcode = await import("qrcode");
    var qr = await (qrcode as any).toString(url, {
      type: "terminal",
      small: true,
    });
    console.log(qr);
    console.log("  \x1b[2m" + url + "\x1b[0m");
    console.log("");
  } catch {
    console.log("  " + url);
    console.log("");
  }
}

export async function runOnboarding(): Promise<{ port: number; passphrase: string | null }> {
  var configPath = join(getLatticeHome(), "config.json");
  var isFirstRun = !existsSync(configPath);

  if (!isFirstRun) {
    var config = loadConfig();
    return { port: config.port, passphrase: null };
  }

  printBanner();

  p.intro("Welcome to Lattice");

  p.note(
    "Anyone with the URL gets full Claude Code access to this machine.\n" +
    "Use a private network (Tailscale, VPN) or set a passphrase.",
    "Security"
  );

  var portResult = await p.text({
    message: "Port",
    placeholder: String(DEFAULT_PORT),
    defaultValue: String(DEFAULT_PORT),
    validate: function (val: string | undefined) {
      var n = parseInt(val || "", 10);
      if (isNaN(n) || n < 1 || n > 65535) return "Enter a valid port (1-65535)";
      return undefined;
    },
  });
  if (p.isCancel(portResult)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }
  var port = parseInt(portResult as string, 10);

  var passphraseResult = await p.password({
    message: "Passphrase (optional, press Enter to skip)",
  });
  if (p.isCancel(passphraseResult)) {
    p.cancel("Setup cancelled");
    process.exit(0);
  }
  var passphrase = (passphraseResult as string) || null;

  p.outro("Setup complete");

  var config = loadConfig();
  config.port = port;
  saveConfig(config);

  return { port, passphrase };
}
