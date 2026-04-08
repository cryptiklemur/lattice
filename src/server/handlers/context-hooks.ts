import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";
import type { ClientMessage } from "#shared";
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { getLatticeHome } from "../config";
import { log } from "../logger";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_SRC_DIR = join(__dirname, "..", "hooks");

function getClaudeSettingsPath(): string {
  return process.env.CLAUDE_SETTINGS_PATH || join(homedir(), ".claude", "settings.json");
}

function getHooksInstallDir(): string {
  return resolve(join(getLatticeHome(), "hooks"));
}

function readClaudeSettings(): Record<string, unknown> {
  const path = getClaudeSettingsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function writeClaudeSettings(settings: Record<string, unknown>): void {
  const path = getClaudeSettingsPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n");
}

interface HookEntry {
  matcher: string;
  hooks: Array<{
    type: string;
    command: string;
    timeout: number;
  }>;
}

function buildHookEntry(command: string): HookEntry {
  return {
    matcher: "",
    hooks: [{
      type: "command",
      command,
      timeout: 5,
    }],
  };
}

function installHookScripts(): string {
  const installDir = getHooksInstallDir();
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const scripts = ["post_tool_use.sh", "event_forward.sh", "statusline.sh"];
  for (const script of scripts) {
    const src = join(HOOKS_SRC_DIR, script);
    const dest = join(installDir, script);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      chmodSync(dest, 0o755);
    }
  }
  return installDir;
}

export function installHooks(): { success: boolean; message: string } {
  try {
    const hooksDir = installHookScripts();
    const settings = readClaudeSettings();

    const postToolUse = join(hooksDir, "post_tool_use.sh");
    const eventForward = join(hooksDir, "event_forward.sh");
    const statusline = join(hooksDir, "statusline.sh");

    // Merge hooks without overwriting existing non-Lattice hooks
    const existingHooks = (settings.hooks || {}) as Record<string, HookEntry[]>;

    function addLatticeHook(eventType: string, command: string): void {
      const entries = existingHooks[eventType] || [];
      // Remove any existing Lattice hooks
      const filtered = entries.filter(function (e: HookEntry) {
        return !e.hooks.some(function (h) { return h.command.includes("lattice") || h.command.includes(hooksDir); });
      });
      filtered.push(buildHookEntry(command));
      existingHooks[eventType] = filtered;
    }

    addLatticeHook("PostToolUse", '"' + postToolUse + '"');
    addLatticeHook("SessionStart", '"' + eventForward + '" SessionStart');
    addLatticeHook("Stop", '"' + eventForward + '" Stop');
    addLatticeHook("PreCompact", '"' + eventForward + '" PreCompact');
    addLatticeHook("PostCompact", '"' + eventForward + '" PostCompact');

    settings.hooks = existingHooks;

    // Add statusLine entry
    settings.statusLine = {
      type: "command",
      command: '"' + statusline + '"',
    };

    writeClaudeSettings(settings);
    log.server("Context analyzer hooks installed to %s", hooksDir);
    return { success: true, message: "Hooks installed. Claude Code will now report context data to Lattice." };
  } catch (err: any) {
    log.server("Failed to install hooks: %O", err);
    return { success: false, message: "Failed to install hooks: " + (err.message || String(err)) };
  }
}

function uninstallHooks(): { success: boolean; message: string } {
  try {
    const hooksDir = getHooksInstallDir();
    const settings = readClaudeSettings();
    const existingHooks = (settings.hooks || {}) as Record<string, HookEntry[]>;

    // Remove Lattice hooks from each event type
    for (const eventType of Object.keys(existingHooks)) {
      existingHooks[eventType] = existingHooks[eventType].filter(function (e: HookEntry) {
        return !e.hooks.some(function (h) { return h.command.includes("lattice") || h.command.includes(hooksDir); });
      });
      if (existingHooks[eventType].length === 0) {
        delete existingHooks[eventType];
      }
    }

    settings.hooks = existingHooks;
    if (Object.keys(existingHooks).length === 0) {
      delete settings.hooks;
    }

    // Remove statusLine if it points to our script
    const sl = settings.statusLine as { command?: string } | undefined;
    if (sl && sl.command && (sl.command.includes("lattice") || sl.command.includes(hooksDir))) {
      delete settings.statusLine;
    }

    writeClaudeSettings(settings);
    log.server("Context analyzer hooks uninstalled");
    return { success: true, message: "Hooks removed from Claude Code settings." };
  } catch (err: any) {
    return { success: false, message: "Failed to uninstall hooks: " + (err.message || String(err)) };
  }
}

export function checkHooksInstalled(): boolean {
  try {
    const hooksDir = getHooksInstallDir();
    const settings = readClaudeSettings();
    const existingHooks = (settings.hooks || {}) as Record<string, HookEntry[]>;
    const postToolUse = existingHooks["PostToolUse"] || [];
    return postToolUse.some(function (e: HookEntry) {
      return e.hooks.some(function (h) { return h.command.includes("lattice") || h.command.includes(hooksDir); });
    });
  } catch {
    return false;
  }
}

registerHandler("context", function (clientId: string, message: ClientMessage) {
  const msg = message as ClientMessage & { action?: string };
  const action = (msg as any).action as string | undefined;

  if (action === "install_hooks") {
    const result = installHooks();
    sendTo(clientId, {
      type: "context:hooks_status",
      installed: result.success ? true : checkHooksInstalled(),
      message: result.message,
    });
    return;
  }

  if (action === "uninstall_hooks") {
    const result = uninstallHooks();
    sendTo(clientId, {
      type: "context:hooks_status",
      installed: checkHooksInstalled(),
      message: result.message,
    });
    return;
  }

  if (action === "check_hooks") {
    sendTo(clientId, {
      type: "context:hooks_status",
      installed: checkHooksInstalled(),
    });
    return;
  }
});
