import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT, LATTICE_HOME_DIR } from "@lattice/shared";
import type { LatticeConfig } from "@lattice/shared";

var home = join(homedir(), LATTICE_HOME_DIR);

export function getLatticeHome(): string {
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true });
  }
  return home;
}

export function getConfigPath(): string {
  return join(getLatticeHome(), "config.json");
}

export function loadConfig(): LatticeConfig {
  var configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return createDefaultConfig();
  }
  var raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as LatticeConfig;
}

export function saveConfig(config: LatticeConfig): void {
  var configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function createDefaultConfig(): LatticeConfig {
  var config: LatticeConfig = {
    port: DEFAULT_PORT,
    name: hostname(),
    tls: false,
    debug: false,
    globalEnv: {},
    projects: [],
  };
  saveConfig(config);
  return config;
}
