import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import type {
  ClientMessage,
  PluginInfo,
  PluginMarketplaceInfo,
  PluginDetails,
  PluginError,
  MarketplacePluginEntry,
} from "@lattice/shared";
import { registerHandler } from "../ws/router";
import { sendTo } from "../ws/broadcast";

var PLUGINS_DIR = join(homedir(), ".claude", "plugins");
var INSTALLED_FILE = join(PLUGINS_DIR, "installed_plugins.json");
var MARKETPLACES_FILE = join(PLUGINS_DIR, "known_marketplaces.json");
var INSTALL_COUNTS_FILE = join(PLUGINS_DIR, "install-counts-cache.json");

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
  var data = readJsonFile<InstallCountsFile>(INSTALL_COUNTS_FILE);
  var map = new Map<string, number>();
  if (!data || !data.counts) return map;
  for (var i = 0; i < data.counts.length; i++) {
    map.set(data.counts[i].plugin, data.counts[i].unique_installs);
  }
  return map;
}

function readPluginJson(installPath: string): PluginJson | null {
  var pluginJsonPath = join(installPath, ".claude-plugin", "plugin.json");
  return readJsonFile<PluginJson>(pluginJsonPath);
}

function countSkills(installPath: string): number {
  var skillsDir = join(installPath, "skills");
  if (!existsSync(skillsDir)) return 0;
  try {
    var entries = readdirSync(skillsDir, { withFileTypes: true });
    var count = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isDirectory()) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function countHooks(installPath: string): number {
  var hooksPath = join(installPath, "hooks", "hooks.json");
  var data = readJsonFile<{ hooks: Record<string, unknown> }>(hooksPath);
  if (!data || !data.hooks) return 0;
  return Object.keys(data.hooks).length;
}

function countRules(installPath: string): number {
  var rulesDir = join(installPath, "rules");
  if (!existsSync(rulesDir)) return 0;
  try {
    var entries = readdirSync(rulesDir);
    var count = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].endsWith(".md")) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

function getInstalledPlugins(): PluginInfo[] {
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return [];
  var installCounts = getInstallCounts();
  var plugins: PluginInfo[] = [];

  var keys = Object.keys(data.plugins);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var entries = data.plugins[key];
    var atIdx = key.lastIndexOf("@");
    var pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
    var marketplace = atIdx > 0 ? key.slice(atIdx + 1) : "";

    for (var e = 0; e < entries.length; e++) {
      var entry = entries[e];
      var meta = readPluginJson(entry.installPath);
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
  var data = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!data) return [];
  var result: PluginMarketplaceInfo[] = [];
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var entry = data[keys[i]];
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
  var marketplaces = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!marketplaces) return [];
  var installCounts = getInstallCounts();
  var installedData = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  var installedKeys = new Set<string>();
  var installedVersions = new Map<string, string>();
  if (installedData && installedData.plugins) {
    var iKeys = Object.keys(installedData.plugins);
    for (var ik = 0; ik < iKeys.length; ik++) {
      installedKeys.add(iKeys[ik]);
      var versions = installedData.plugins[iKeys[ik]];
      if (versions.length > 0) {
        installedVersions.set(iKeys[ik], versions[0].version);
      }
    }
  }

  var results: MarketplacePluginEntry[] = [];
  var lowerQuery = query.toLowerCase();
  var mKeys = Object.keys(marketplaces);

  for (var m = 0; m < mKeys.length; m++) {
    var mName = mKeys[m];
    if (marketplaceFilter && mName !== marketplaceFilter) continue;

    var mkt = marketplaces[mName];
    var pluginsDir = join(mkt.installLocation, "plugins");
    if (!existsSync(pluginsDir)) continue;

    try {
      var pluginDirs = readdirSync(pluginsDir, { withFileTypes: true });
      for (var p = 0; p < pluginDirs.length; p++) {
        if (!pluginDirs[p].isDirectory()) continue;
        var dirName = pluginDirs[p].name;
        if (dirName.toLowerCase().indexOf(lowerQuery) === -1) {
          var meta = readPluginJson(join(pluginsDir, dirName));
          if (!meta || meta.description.toLowerCase().indexOf(lowerQuery) === -1) {
            continue;
          }
        }

        var pluginMeta = readPluginJson(join(pluginsDir, dirName));
        var key = dirName + "@" + mName;
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
    var ai = a.installs ?? 0;
    var bi = b.installs ?? 0;
    return bi - ai;
  });

  return results;
}

function parseFrontmatter(content: string): { name: string; description: string } {
  var match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: "", description: "" };
  var yaml = match[1];
  var name = "";
  var desc = "";
  var lines = yaml.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    var descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return { name, description: desc };
}

function getPluginDetails(pluginName: string, marketplace: string): PluginDetails | null {
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return null;

  var key = pluginName + "@" + marketplace;
  var entries = data.plugins[key];
  if (!entries || entries.length === 0) return null;

  var entry = entries[0];
  var meta = readPluginJson(entry.installPath);

  var skills: Array<{ name: string; description: string }> = [];
  var skillsDir = join(entry.installPath, "skills");
  if (existsSync(skillsDir)) {
    try {
      var skillDirs = readdirSync(skillsDir, { withFileTypes: true });
      for (var s = 0; s < skillDirs.length; s++) {
        if (!skillDirs[s].isDirectory()) continue;
        var skillFile = join(skillsDir, skillDirs[s].name, "SKILL.md");
        if (existsSync(skillFile)) {
          var content = readFileSync(skillFile, "utf-8");
          var fm = parseFrontmatter(content);
          skills.push({ name: fm.name || skillDirs[s].name, description: fm.description });
        }
      }
    } catch {}
  }

  var hooks: Record<string, unknown> = {};
  var hooksPath = join(entry.installPath, "hooks", "hooks.json");
  var hooksData = readJsonFile<{ hooks: Record<string, unknown> }>(hooksPath);
  if (hooksData && hooksData.hooks) {
    hooks = hooksData.hooks;
  }

  var rules: string[] = [];
  var rulesDir = join(entry.installPath, "rules");
  if (existsSync(rulesDir)) {
    try {
      var ruleFiles = readdirSync(rulesDir);
      for (var r = 0; r < ruleFiles.length; r++) {
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
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return {};
  var servers: Record<string, unknown> = {};
  var keys = Object.keys(data.plugins);
  for (var k = 0; k < keys.length; k++) {
    var entries = data.plugins[keys[k]];
    for (var e = 0; e < entries.length; e++) {
      var mcpPath = join(entries[e].installPath, ".mcp.json");
      var mcpData = readJsonFile<{ mcpServers?: Record<string, unknown> }>(mcpPath);
      if (mcpData && mcpData.mcpServers) {
        var sKeys = Object.keys(mcpData.mcpServers);
        for (var s = 0; s < sKeys.length; s++) {
          servers[sKeys[s]] = mcpData.mcpServers[sKeys[s]];
        }
      }
    }
  }
  return servers;
}

export function getInstalledPluginCount(): number {
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return 0;
  return Object.keys(data.plugins).length;
}

export function getPluginSkillRuleTokenEstimate(): number {
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return 0;
  var totalChars = 0;
  var keys = Object.keys(data.plugins);
  for (var k = 0; k < keys.length; k++) {
    var entries = data.plugins[keys[k]];
    for (var e = 0; e < entries.length; e++) {
      var skillsDir = join(entries[e].installPath, "skills");
      if (existsSync(skillsDir)) {
        try {
          var dirs = readdirSync(skillsDir, { withFileTypes: true });
          for (var d = 0; d < dirs.length; d++) {
            if (!dirs[d].isDirectory()) continue;
            var skillFile = join(skillsDir, dirs[d].name, "SKILL.md");
            if (existsSync(skillFile)) {
              totalChars += readFileSync(skillFile, "utf-8").length;
            }
          }
        } catch {}
      }
      var rulesDir = join(entries[e].installPath, "rules");
      if (existsSync(rulesDir)) {
        try {
          var ruleFiles = readdirSync(rulesDir);
          for (var r = 0; r < ruleFiles.length; r++) {
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

var LSP_BINARY_MAP: Record<string, string> = {
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
  var data = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  if (!data || !data.plugins) return [];
  var errors: PluginError[] = [];

  var keys = Object.keys(data.plugins);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var entries = data.plugins[key];
    var atIdx = key.lastIndexOf("@");
    var pluginName = atIdx > 0 ? key.slice(0, atIdx) : key;
    var marketplace = atIdx > 0 ? key.slice(atIdx + 1) : "";

    for (var e = 0; e < entries.length; e++) {
      var entry = entries[e];
      var errs: string[] = [];

      if (!existsSync(entry.installPath)) {
        errs.push("Install path does not exist: " + entry.installPath);
      } else {
        try {
          var output = execSync(
            "claude plugin validate " + JSON.stringify(entry.installPath) + " 2>&1",
            { encoding: "utf-8", timeout: 10000 }
          );
          var errorLines = output.split("\n").filter(function (l) { return l.trim().startsWith("❯") || l.trim().startsWith("✘"); });
          for (var el = 0; el < errorLines.length; el++) {
            var line = errorLines[el].trim();
            if (line.startsWith("❯")) {
              errs.push(line.slice(1).trim());
            }
          }
        } catch (validateErr) {
          var stderr = String(validateErr);
          var stderrLines = stderr.split("\n").filter(function (l) { return l.trim().startsWith("❯"); });
          for (var sl = 0; sl < stderrLines.length; sl++) {
            errs.push(stderrLines[sl].trim().slice(1).trim());
          }
        }

        var lspBinary = LSP_BINARY_MAP[pluginName];
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
  var marketplaces = readJsonFile<MarketplacesFile>(MARKETPLACES_FILE);
  if (!marketplaces) return [];
  var installCounts = getInstallCounts();
  var installedData = readJsonFile<InstalledPluginsFile>(INSTALLED_FILE);
  var installedKeys = new Set<string>();
  var installedVersions = new Map<string, string>();
  if (installedData && installedData.plugins) {
    var iKeys = Object.keys(installedData.plugins);
    for (var ik = 0; ik < iKeys.length; ik++) {
      installedKeys.add(iKeys[ik]);
      var versions = installedData.plugins[iKeys[ik]];
      if (versions.length > 0) {
        installedVersions.set(iKeys[ik], versions[0].version);
      }
    }
  }

  var results: MarketplacePluginEntry[] = [];
  var mKeys = Object.keys(marketplaces);

  for (var m = 0; m < mKeys.length; m++) {
    var mName = mKeys[m];
    var mkt = marketplaces[mName];
    var pluginsDir = join(mkt.installLocation, "plugins");
    if (!existsSync(pluginsDir)) continue;

    try {
      var pluginDirs = readdirSync(pluginsDir, { withFileTypes: true });
      for (var p = 0; p < pluginDirs.length; p++) {
        if (!pluginDirs[p].isDirectory()) continue;
        var dirName = pluginDirs[p].name;
        var meta = readPluginJson(join(pluginsDir, dirName));
        var key = dirName + "@" + mName;
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
    var ai = a.installs ?? 0;
    var bi = b.installs ?? 0;
    return bi - ai;
  });

  return results;
}

registerHandler("plugin", function (clientId: string, message: ClientMessage) {
  if (message.type === "plugin:list") {
    var plugins = getInstalledPlugins();
    sendTo(clientId, { type: "plugin:list_result", plugins: plugins });
    return;
  }

  if (message.type === "plugin:marketplaces") {
    var marketplaces = getMarketplaces();
    sendTo(clientId, { type: "plugin:marketplaces_result", marketplaces: marketplaces });
    return;
  }

  if (message.type === "plugin:search") {
    var searchMsg = message as { type: "plugin:search"; query: string; marketplace?: string };
    var query = searchMsg.query.trim();
    if (!query) {
      sendTo(clientId, { type: "plugin:search_result", query: query, plugins: [], count: 0 });
      return;
    }
    var found = searchMarketplacePlugins(query, searchMsg.marketplace);
    sendTo(clientId, { type: "plugin:search_result", query: query, plugins: found, count: found.length });
    return;
  }

  if (message.type === "plugin:install") {
    var installMsg = message as { type: "plugin:install"; name: string; marketplace: string };
    var installArg = installMsg.name + "@" + installMsg.marketplace;
    try {
      var proc = Bun.spawn(["claude", "plugin", "install", installArg], {
        cwd: homedir(),
        stdout: "pipe",
        stderr: "pipe",
      });

      var timeout = setTimeout(function () {
        proc.kill();
      }, 120000);

      void proc.exited.then(function (code) {
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
    var uninstallMsg = message as { type: "plugin:uninstall"; name: string; marketplace: string };
    var uninstallArg = uninstallMsg.name + "@" + uninstallMsg.marketplace;
    try {
      var uninstallProc = Bun.spawn(["claude", "plugin", "uninstall", uninstallArg], {
        cwd: homedir(),
        stdout: "pipe",
        stderr: "pipe",
      });

      var uninstallTimeout = setTimeout(function () {
        uninstallProc.kill();
      }, 60000);

      void uninstallProc.exited.then(function (code) {
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
    var updateMsg = message as { type: "plugin:update"; name: string; marketplace: string };
    var updateArg = updateMsg.name + "@" + updateMsg.marketplace;
    try {
      var updateProc = Bun.spawn(["claude", "plugin", "update", updateArg], {
        cwd: homedir(),
        stdout: "pipe",
        stderr: "pipe",
      });

      var updateTimeout = setTimeout(function () {
        updateProc.kill();
      }, 120000);

      void updateProc.exited.then(function (code) {
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
    var detailsMsg = message as { type: "plugin:details"; name: string; marketplace: string };
    var details = getPluginDetails(detailsMsg.name, detailsMsg.marketplace);
    if (details) {
      sendTo(clientId, { type: "plugin:details_result", plugin: details });
    } else {
      sendTo(clientId, { type: "plugin:details_result", plugin: null, error: "Plugin not found" });
    }
    return;
  }

  if (message.type === "plugin:discover") {
    var allPlugins = discoverPlugins();
    sendTo(clientId, { type: "plugin:discover_result", plugins: allPlugins });
    return;
  }

  if (message.type === "plugin:errors") {
    var pluginErrors = getPluginErrors();
    sendTo(clientId, { type: "plugin:errors_result", errors: pluginErrors });
    return;
  }
});
