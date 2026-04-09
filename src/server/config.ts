import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT, LATTICE_HOME_DIR } from "#shared";
import type { LatticeConfig } from "#shared";

const home = process.env.LATTICE_HOME || join(homedir(), LATTICE_HOME_DIR);
let cachedConfig: LatticeConfig | null = null;

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
  if (cachedConfig) {
    return cachedConfig;
  }
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return createDefaultConfig();
  }
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<LatticeConfig>;
  cachedConfig = {
    port: parsed.port ?? DEFAULT_PORT,
    name: parsed.name ?? hostname(),
    tls: parsed.tls ?? false,
    debug: parsed.debug ?? false,
    globalEnv: parsed.globalEnv ?? {},
    projects: parsed.projects ?? [],
    ...parsed,
  } as LatticeConfig;
  return cachedConfig;
}

export function saveConfig(config: LatticeConfig): void {
  const configPath = getConfigPath();
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  cachedConfig = config;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
}

function createDefaultConfig(): LatticeConfig {
  const config: LatticeConfig = {
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
