import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync, spawn } from "node:child_process";
import type {
  ClientMessage,
  PluginInfo,
  PluginMarketplaceInfo,
  PluginDetails,
  PluginError,
  MarketplacePluginEntry,
} from "#shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";

const PLUGINS_DIR = join(homedir(), ".claude", "plugins");
const INSTALLED_FILE = join(PLUGINS_DIR, "installed_plugins.json");
const MARKETPLACES_FILE = join(PLUGINS_DIR, "known_marketplaces.json");
const INSTALL_COUNTS_FILE = join(PLUGINS_DIR, "install-counts-cache.json");

interface InstalledPluginsFile {
  version: number;
  plugins: Record<string, Array<{
    scope: string;
    installPath: string;
    version: string;
    installedAt: string;
    lastUpdated: string;
    gitCommitSha: string;
  }>>;
}

interface PluginJson {
  name: string;
  description: string;
  version?: string;
  author?: { name: string; email?: string };
  homepage?: string;
  license?: string;
  keywords?: string[];
}

interface InstallCountsFile {
  version: number;
  fetchedAt: string;
  counts: Array<{ plugin: string; unique_installs: number }>;
}

interface MarketplacesFile {
  [name: string]: {
    source: { source: string; repo: string };
    installLocation: string;
    lastUpdated: string;
  };
}

function readJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function getInstallCounts(): Map<string, number> {
  const data = readJsonFile<InstallCountsFile>(INSTALL_COUNTS_FILE);
  const map = new Map<string, number>();
  if (!data || !data.counts) return map;
  for (let i = 0; i < data.counts.length; i++) {
    map.set(data.counts[i].plugin, data.counts[i].unique_installs);
  }
  return map;
}

function readPluginJson(installPath: string): PluginJson | null {
  const pluginJsonPath = join(installPath, ".claude-plugin", "plugin.json");
  return readJsonFile<PluginJson>(pluginJsonPath);
}

function countSkills(installPath: string): number {
  const skillsDir = join(installPath, "skills");
  if (!existsSync(skillsDir)) return 0;
  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    let count = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].isDirectory()) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function countHooks(installPath: string): number {
  const hooksPath = join(installPath, "hooks", "hooks.json");
  const data = readJsonFile<{ hooks: Record<string, unknown> }>(hooksPath);
  if (!data || !data.hooks) return 0;
  return Object.keys(data.hooks).length;
}

function countRules(installPath: string): number {
  const rulesDir = join(installPath, "rules");
  if (!existsSync(rulesDir)) return 0;
  try {
    const entries = readdirSync(rulesDir);
    let count = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].endsWith(".md")) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function getInstalledPlugins(): PluginInfo[] {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return [];
  const installCounts = getInstallCounts();
  const plugins: PluginInfo[] = [];

  const keys = Object.keys(data.plugins);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const entries = data.plugins[key];
    const atIdx = key.lastIndexOf("@");
    const pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
    const marketplace = atIdx > 0 ? key.slice(atIdx + 1) : "";

    for (let e = 0; e < entries.length; e++) {
      const entry = entries[e];
      const meta = readPluginJson(entry.installPath);
      plugins.push({
        name: pluginName,
        marketplace: marketplace,
        key: key,
        version: entry.version,
        scope: entry.scope,
        installPath: entry.installPath,
        installedAt: entry.installedAt,
        lastUpdated: entry.lastUpdated,
        gitCommitSha: entry.gitCommitSha,
        description: meta?.description ?? "",
        skillCount: countSkills(entry.installPath),
        hookCount: countHooks(entry.installPath),
        ruleCount: countRules(entry.installPath),
        installs: installCounts.get(key),
      });
    }
  }

  plugins.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return plugins;
}

function getMarketplaces(): PluginMarketplaceInfo[] {
  const data = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!data) return [];
  const result: PluginMarketplaceInfo[] = [];
  const keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    const entry = data[keys[i]];
    result.push({
      name: keys[i],
      source: entry.source,
      installLocation: entry.installLocation,
      lastUpdated: entry.lastUpdated,
    });
  }
  return result;
}

function searchMarketplacePlugins(query: string, marketplaceFilter?: string): MarketplacePluginEntry[] {
  const marketplaces = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!marketplaces) return [];
  const installCounts = getInstallCounts();
  const installedData = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  const installedKeys = new Set<string>();
  const installedVersions = new Map<string, string>();
  if (installedData && installedData.plugins) {
    const iKeys = Object.keys(installedData.plugins);
    for (let ik = 0; ik < iKeys.length; ik++) {
      installedKeys.add(iKeys[ik]);
      const versions = installedData.plugins[iKeys[ik]];
      if (versions.length > 0) {
        installedVersions.set(iKeys[ik], versions[0].version);
      }
    }
  }

  const results: MarketplacePluginEntry[] = [];
  const lowerQuery = query.toLowerCase();
  const mKeys = Object.keys(marketplaces);

  for (let m = 0; m < mKeys.length; m++) {
    const mName = mKeys[m];
    if (marketplaceFilter && mName !== marketplaceFilter) continue;

    const mkt = marketplaces[mName];
    const pluginsDir = join(mkt.installLocation, "plugins");
    if (!existsSync(pluginsDir)) continue;

    try {
      const pluginDirs = readdirSync(pluginsDir, { withFileTypes: true });
      for (let p = 0; p < pluginDirs.length; p++) {
        if (!pluginDirs[p].isDirectory()) continue;
        const dirName = pluginDirs[p].name;
        if (dirName.toLowerCase().indexOf(lowerQuery) === -1) {
          const meta = readPluginJson(join(pluginsDir, dirName));
          if (!meta || meta.description.toLowerCase().indexOf(lowerQuery) === -1) {
            continue;
          }
        }

        const pluginMeta = readPluginJson(join(pluginsDir, dirName));
        const key = dirName + "@" + mName;
        results.push({
          name: dirName,
          marketplace: mName,
          description: pluginMeta?.description ?? "",
          author: pluginMeta?.author,
          installed: installedKeys.has(key),
          installedVersion: installedVersions.get(key),
          installs: installCounts.get(key),
        });
      }
    } catch {}
  }

  results.sort(function (a, b) {
    const ai = a.installs ?? 0;
    const bi = b.installs ?? 0;
    return bi - ai;
  });

  return results;
}

function parseFrontmatter(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "" };
  const yaml = match[1];
  let name = "";
  let desc = "";
  const lines = yaml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description: desc };
}

function getPluginDetails(pluginName: string, marketplace: string): PluginDetails | null {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return null;

  const key = pluginName + "@" + marketplace;
  const entries = data.plugins[key];
  if (!entries || entries.length === 0) return null;

  const entry = entries[0];
  const meta = readPluginJson(entry.installPath);

  const skills: Array<{ name: string; description: string }> = [];
  const skillsDir = join(entry.installPath, "skills");
  if (existsSync(skillsDir)) {
    try {
      const skillDirs = readdirSync(skillsDir, { withFileTypes: true });
      for (let s = 0; s < skillDirs.length; s++) {
        if (!skillDirs[s].isDirectory()) continue;
        const skillFile = join(skillsDir, skillDirs[s].name, "SKILL.md");
        if (existsSync(skillFile)) {
          const content = readFileSync(skillFile, "utf-8");
          const fm = parseFrontmatter(content);
          skills.push({ name: fm.name || skillDirs[s].name, description: fm.description });
        }
      }
    } catch {}
  }

  let hooks: Record<string, unknown> = {};
  const hooksPath = join(entry.installPath, "hooks", "hooks.json");
  const hooksData = readJsonFile<{ hooks: Record<string, unknown> }>(hooksPath);
  if (hooksData && hooksData.hooks) {
    hooks = hooksData.hooks;
  }

  const rules: string[] = [];
  const rulesDir = join(entry.installPath, "rules");
  if (existsSync(rulesDir)) {
    try {
      const ruleFiles = readdirSync(rulesDir);
      for (let r = 0; r < ruleFiles.length; r++) {
        if (ruleFiles[r].endsWith(".md")) {
          rules.push(ruleFiles[r]);
        }
      }
    } catch {}
  }

  return {
    name: pluginName,
    marketplace: marketplace,
    version: entry.version,
    description: meta?.description ?? "",
    author: meta?.author,
    homepage: meta?.homepage,
    license: meta?.license,
    keywords: meta?.keywords,
    skills: skills,
    hooks: hooks,
    rules: rules,
    installPath: entry.installPath,
    installedAt: entry.installedAt,
    lastUpdated: entry.lastUpdated,
    gitCommitSha: entry.gitCommitSha,
  };
}

export function getPluginMcpServers(): Record<string, unknown> {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return {};
  const servers: Record<string, unknown> = {};
  const keys = Object.keys(data.plugins);
  for (let k = 0; k < keys.length; k++) {
    const entries = data.plugins[keys[k]];
    for (let e = 0; e < entries.length; e++) {
      const mcpPath = join(entries[e].installPath, ".mcp.json");
      const mcpData = readJsonFile<{ mcpServers?: Record<string, unknown> }>(mcpPath);
      if (mcpData && mcpData.mcpServers) {
        const sKeys = Object.keys(mcpData.mcpServers);
        for (let s = 0; s < sKeys.length; s++) {
          servers[sKeys[s]] = mcpData.mcpServers[sKeys[s]];
        }
      }
    }
  }
  return servers;
}

export function getInstalledPluginCount(): number {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return 0;
  return Object.keys(data.plugins).length;
}

export function getPluginSkillRuleTokenEstimate(): number {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return 0;
  let totalChars = 0;
  const keys = Object.keys(data.plugins);
  for (let k = 0; k < keys.length; k++) {
    const entries = data.plugins[keys[k]];
    for (let e = 0; e < entries.length; e++) {
      const skillsDir = join(entries[e].installPath, "skills");
      if (existsSync(skillsDir)) {
        try {
          const dirs = readdirSync(skillsDir, { withFileTypes: true });
          for (let d = 0; d < dirs.length; d++) {
            if (!dirs[d].isDirectory()) continue;
            const skillFile = join(skillsDir, dirs[d].name, "SKILL.md");
            if (existsSync(skillFile)) {
              totalChars += readFileSync(skillFile, "utf-8").length;
            }
          }
        } catch {}
      }
      const rulesDir = join(entries[e].installPath, "rules");
      if (existsSync(rulesDir)) {
        try {
          const ruleFiles = readdirSync(rulesDir);
          for (let r = 0; r < ruleFiles.length; r++) {
            if (ruleFiles[r].endsWith(".md")) {
              totalChars += readFileSync(join(rulesDir, ruleFiles[r]), "utf-8").length;
            }
          }
        } catch {}
      }
    }
  }
  return Math.round(totalChars / 4);
}

function whichBinary(name: string): boolean {
  try {
    execSync("which " + JSON.stringify(name), { encoding: "utf-8", timeout: 3000, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

const LSP_BINARY_MAP: Record<string, string> = {
  "typescript-lsp": "typescript-language-server",
  "pyright-lsp": "pyright-langserver",
  "gopls-lsp": "gopls",
  "rust-analyzer-lsp": "rust-analyzer",
  "clangd-lsp": "clangd",
  "csharp-lsp": "OmniSharp",
  "ruby-lsp": "ruby-lsp",
  "swift-lsp": "sourcekit-lsp",
  "kotlin-lsp": "kotlin-language-server",
  "lua-lsp": "lua-language-server",
  "php-lsp": "phpactor",
  "jdtls-lsp": "jdtls",
};

function getPluginErrors(): PluginError[] {
  const data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return [];
  const errors: PluginError[] = [];

  const keys = Object.keys(data.plugins);
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const entries = data.plugins[key];
    const atIdx = key.lastIndexOf("@");
    const pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
    const marketplace = atIdx > 0 ? key.slice(atIdx + 1) : "";

    for (let e = 0; e < entries.length; e++) {
      const entry = entries[e];
      const errs: string[] = [];

      if (!existsSync(entry.installPath)) {
        errs.push("Install path does not exist: " + entry.installPath);
      } else {
        try {
          const output = execSync(
            "claude plugin validate " + JSON.stringify(entry.installPath) + " 2>&1",
            { encoding: "utf-8", timeout: 10000 }
          );
          const errorLines = output.split("\n").filter(function (l) { return l.trim().startsWith("❯") || l.trim().startsWith("✘"); });
          for (let el = 0; el < errorLines.length; el++) {
            const line = errorLines[el].trim();
            if (line.startsWith("❯")) {
              errs.push(line.slice(1).trim());
            }
          }
        } catch (validateErr) {
          const stderr = String(validateErr);
          const stderrLines = stderr.split("\n").filter(function (l) { return l.trim().startsWith("❯"); });
          for (let sl = 0; sl < stderrLines.length; sl++) {
            errs.push(stderrLines[sl].trim().slice(1).trim());
          }
        }

        const lspBinary = LSP_BINARY_MAP[pluginName];
        if (lspBinary && !whichBinary(lspBinary)) {
          errs.push("Executable not found in $PATH: \"" + lspBinary + "\"");
        }
      }

      if (errs.length > 0) {
        errors.push({ key: key, name: pluginName, marketplace: marketplace, errors: errs });
      }
    }
  }

  return errors;
}

function discoverPlugins(): MarketplacePluginEntry[] {
  const marketplaces = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!marketplaces) return [];
  const installCounts = getInstallCounts();
  const installedData = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  const installedKeys = new Set<string>();
  const installedVersions = new Map<string, string>();
  if (installedData && installedData.plugins) {
    const iKeys = Object.keys(installedData.plugins);
    for (let ik = 0; ik < iKeys.length; ik++) {
      installedKeys.add(iKeys[ik]);
      const versions = installedData.plugins[iKeys[ik]];
      if (versions.length > 0) {
        installedVersions.set(iKeys[ik], versions[0].version);
      }
    }
  }

  const results: MarketplacePluginEntry[] = [];
  const mKeys = Object.keys(marketplaces);

  for (let m = 0; m < mKeys.length; m++) {
    const mName = mKeys[m];
    const mkt = marketplaces[mName];
    const pluginsDir = join(mkt.installLocation, "plugins");
    if (!existsSync(pluginsDir)) continue;

    try {
      const pluginDirs = readdirSync(pluginsDir, { withFileTypes: true });
      for (let p = 0; p < pluginDirs.length; p++) {
        if (!pluginDirs[p].isDirectory()) continue;
        const dirName = pluginDirs[p].name;
        const meta = readPluginJson(join(pluginsDir, dirName));
        const key = dirName + "@" + mName;
        results.push({
          name: dirName,
          marketplace: mName,
          description: meta?.description ?? "",
          author: meta?.author,
          installed: installedKeys.has(key),
          installedVersion: installedVersions.get(key),
          installs: installCounts.get(key),
        });
      }
    } catch {}
  }

  results.sort(function (a, b) {
    const ai = a.installs ?? 0;
    const bi = b.installs ?? 0;
    return bi - ai;
  });

  return results;
}

registerHandler("plugin", function (clientId: string, message: ClientMessage) {
  if (message.type === "plugin:list") {
    const plugins = getInstalledPlugins();
    sendTo(clientId, { type: "plugin:list_result", plugins: plugins });
    return;
  }

  if (message.type === "plugin:marketplaces") {
    const marketplaces = getMarketplaces();
    sendTo(clientId, { type: "plugin:marketplaces_result", marketplaces: marketplaces });
    return;
  }

  if (message.type === "plugin:search") {
    const searchMsg = message as { type: "plugin:search"; query: string; marketplace?: string };
    const query = searchMsg.query.trim();
    if (!query) {
      sendTo(clientId, { type: "plugin:search_result", query: query, plugins: [], count: 0 });
      return;
    }
    const found = searchMarketplacePlugins(query, searchMsg.marketplace);
    sendTo(clientId, { type: "plugin:search_result", query: query, plugins: found, count: found.length });
    return;
  }

  if (message.type === "plugin:install") {
    const installMsg = message as { type: "plugin:install"; name: string; marketplace: string };
    const installArg = installMsg.name + "@" + installMsg.marketplace;
    try {
      const proc = spawn("claude", ["plugin", "install", installArg], {
        cwd: homedir(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timeout = setTimeout(function () {
        proc.kill();
      }, 120000);

      proc.on("close", function (code) {
        clearTimeout(timeout);
        if (code === 0) {
          sendTo(clientId, { type: "plugin:install_result", success: true, message: "Installed " + installMsg.name + " successfully" });
          sendTo(clientId, { type: "plugin:list_result", plugins: getInstalledPlugins() });
        } else {
          sendTo(clientId, { type: "plugin:install_result", success: false, message: "Install failed (exit code " + code + ")" });
        }
      });
    } catch (err) {
      sendTo(clientId, { type: "plugin:install_result", success: false, message: "Failed to start install: " + String(err) });
    }
    return;
  }

  if (message.type === "plugin:uninstall") {
    const uninstallMsg = message as { type: "plugin:uninstall"; name: string; marketplace: string };
    const uninstallArg = uninstallMsg.name + "@" + uninstallMsg.marketplace;
    try {
      const uninstallProc = spawn("claude", ["plugin", "uninstall", uninstallArg], {
        cwd: homedir(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      const uninstallTimeout = setTimeout(function () {
        uninstallProc.kill();
      }, 60000);

      uninstallProc.on("close", function (code) {
        clearTimeout(uninstallTimeout);
        if (code === 0) {
          sendTo(clientId, { type: "plugin:uninstall_result", success: true, message: "Uninstalled " + uninstallMsg.name + " successfully" });
          sendTo(clientId, { type: "plugin:list_result", plugins: getInstalledPlugins() });
        } else {
          sendTo(clientId, { type: "plugin:uninstall_result", success: false, message: "Uninstall failed (exit code " + code + ")" });
        }
      });
    } catch (err) {
      sendTo(clientId, { type: "plugin:uninstall_result", success: false, message: "Failed to start uninstall: " + String(err) });
    }
    return;
  }

  if (message.type === "plugin:update") {
    const updateMsg = message as { type: "plugin:update"; name: string; marketplace: string };
    const updateArg = updateMsg.name + "@" + updateMsg.marketplace;
    try {
      const updateProc = spawn("claude", ["plugin", "update", updateArg], {
        cwd: homedir(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      const updateTimeout = setTimeout(function () {
        updateProc.kill();
      }, 120000);

      updateProc.on("close", function (code) {
        clearTimeout(updateTimeout);
        if (code === 0) {
          sendTo(clientId, { type: "plugin:update_result", success: true, message: "Updated " + updateMsg.name + " successfully" });
          sendTo(clientId, { type: "plugin:list_result", plugins: getInstalledPlugins() });
        } else {
          sendTo(clientId, { type: "plugin:update_result", success: false, message: "Update failed (exit code " + code + ")" });
        }
      });
    } catch (err) {
      sendTo(clientId, { type: "plugin:update_result", success: false, message: "Failed to start update: " + String(err) });
    }
    return;
  }

  if (message.type === "plugin:details") {
    const detailsMsg = message as { type: "plugin:details"; name: string; marketplace: string };
    const details = getPluginDetails(detailsMsg.name, detailsMsg.marketplace);
    if (details) {
      sendTo(clientId, { type: "plugin:details_result", plugin: details });
    } else {
      sendTo(clientId, { type: "plugin:details_result", plugin: null, error: "Plugin not found" });
    }
    return;
  }

  if (message.type === "plugin:discover") {
    const allPlugins = discoverPlugins();
    sendTo(clientId, { type: "plugin:discover_result", plugins: allPlugins });
    return;
  }

  if (message.type === "plugin:errors") {
    const pluginErrors = getPluginErrors();
    sendTo(clientId, { type: "plugin:errors_result", errors: pluginErrors });
    return;
  }
});
