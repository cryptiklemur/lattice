import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Blocks, Trash2, RefreshCw, Loader2, X, Download, Search,
  ChevronRight, Package, Webhook, ScrollText, Puzzle, ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type {
  ServerMessage,
  PluginInfo,
  PluginDetails,
  PluginError,
  PluginMarketplaceInfo,
  MarketplacePluginEntry,
} from "#shared";

export function GlobalPlugins() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [marketplaces, setMarketplaces] = useState<PluginMarketplaceInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [detailPlugin, setDetailPlugin] = useState<PluginDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketplacePluginEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [uninstallingKey, setUninstallingKey] = useState<string | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [pluginErrors, setPluginErrors] = useState<PluginError[]>([]);
  const [discoverPlugins, setDiscoverPlugins] = useState<MarketplacePluginEntry[]>([]);
  const [discoverLoaded, setDiscoverLoaded] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    function handleListResult(msg: ServerMessage) {
      if (msg.type !== "plugin:list_result") return;
      const data = msg as { type: "plugin:list_result"; plugins: PluginInfo[] };
      setPlugins(data.plugins);
      setLoaded(true);
    }

    function handleMarketplacesResult(msg: ServerMessage) {
      if (msg.type !== "plugin:marketplaces_result") return;
      const data = msg as { type: "plugin:marketplaces_result"; marketplaces: PluginMarketplaceInfo[] };
      setMarketplaces(data.marketplaces);
    }

    function handleSearchResult(msg: ServerMessage) {
      if (msg.type !== "plugin:search_result") return;
      const data = msg as { type: "plugin:search_result"; query: string; plugins: MarketplacePluginEntry[]; count: number };
      setSearchResults(data.plugins);
      setSearching(false);
      setHasSearched(true);
    }

    function handleInstallResult(msg: ServerMessage) {
      if (msg.type !== "plugin:install_result") return;
      const data = msg as { type: "plugin:install_result"; success: boolean; message?: string };
      setInstallingKey(null);
      showAction(data.message ?? (data.success ? "Installed" : "Install failed"), data.success);
    }

    function handleUninstallResult(msg: ServerMessage) {
      if (msg.type !== "plugin:uninstall_result") return;
      const data = msg as { type: "plugin:uninstall_result"; success: boolean; message?: string };
      setUninstallingKey(null);
      showAction(data.message ?? (data.success ? "Uninstalled" : "Uninstall failed"), data.success);
    }

    function handleUpdateResult(msg: ServerMessage) {
      if (msg.type !== "plugin:update_result") return;
      const data = msg as { type: "plugin:update_result"; success: boolean; message?: string };
      setUpdatingKey(null);
      showAction(data.message ?? (data.success ? "Updated" : "Update failed"), data.success);
    }

    function handleDetailsResult(msg: ServerMessage) {
      if (msg.type !== "plugin:details_result") return;
      const data = msg as { type: "plugin:details_result"; plugin: PluginDetails | null };
      setDetailPlugin(data.plugin);
    }

    function handleErrorsResult(msg: ServerMessage) {
      if (msg.type !== "plugin:errors_result") return;
      const data = msg as { type: "plugin:errors_result"; errors: PluginError[] };
      setPluginErrors(data.errors);
    }

    function handleDiscoverResult(msg: ServerMessage) {
      if (msg.type !== "plugin:discover_result") return;
      const data = msg as { type: "plugin:discover_result"; plugins: MarketplacePluginEntry[] };
      setDiscoverPlugins(data.plugins);
      setDiscoverLoaded(true);
    }

    subscribe("plugin:list_result", handleListResult);
    subscribe("plugin:marketplaces_result", handleMarketplacesResult);
    subscribe("plugin:search_result", handleSearchResult);
    subscribe("plugin:install_result", handleInstallResult);
    subscribe("plugin:uninstall_result", handleUninstallResult);
    subscribe("plugin:update_result", handleUpdateResult);
    subscribe("plugin:details_result", handleDetailsResult);
    subscribe("plugin:errors_result", handleErrorsResult);
    subscribe("plugin:discover_result", handleDiscoverResult);

    send({ type: "plugin:list" } as any);
    send({ type: "plugin:marketplaces" } as any);
    send({ type: "plugin:errors" } as any);
    send({ type: "plugin:discover" } as any);

    return function () {
      unsubscribe("plugin:list_result", handleListResult);
      unsubscribe("plugin:marketplaces_result", handleMarketplacesResult);
      unsubscribe("plugin:search_result", handleSearchResult);
      unsubscribe("plugin:install_result", handleInstallResult);
      unsubscribe("plugin:uninstall_result", handleUninstallResult);
      unsubscribe("plugin:update_result", handleUpdateResult);
      unsubscribe("plugin:details_result", handleDetailsResult);
      unsubscribe("plugin:errors_result", handleErrorsResult);
      unsubscribe("plugin:discover_result", handleDiscoverResult);
    };
  }, []);

  function showAction(text: string, success: boolean) {
    setActionMessage({ text, success });
    setTimeout(function () { setActionMessage(null); }, 3000);
  }

  function handleViewDetails(plugin: PluginInfo) {
    send({ type: "plugin:details", name: plugin.name, marketplace: plugin.marketplace } as any);
  }

  function handleInstall(name: string, marketplace: string) {
    const key = name + "@" + marketplace;
    setInstallingKey(key);
    send({ type: "plugin:install", name: name, marketplace: marketplace } as any);
  }

  function handleUninstall(plugin: PluginInfo) {
    setUninstallingKey(plugin.key);
    setConfirmUninstall(null);
    send({ type: "plugin:uninstall", name: plugin.name, marketplace: plugin.marketplace } as any);
  }

  function handleUpdate(plugin: PluginInfo) {
    setUpdatingKey(plugin.key);
    send({ type: "plugin:update", name: plugin.name, marketplace: plugin.marketplace } as any);
  }

  const handleSearchInput = useCallback(function (value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(function () {
      send({ type: "plugin:search", query: value.trim() } as any);
    }, 300);
  }, [send]);

  const installedKeys = useMemo(function () {
    return new Set(plugins.map(function (p) { return p.key; }));
  }, [plugins]);

  if (!loaded) {
    return (
      <div className="py-4 space-y-3 animate-pulse">
        {[0, 1, 2].map(function (i) { return <div key={i} className="bg-base-content/[0.03] rounded-xl h-16" />; })}
      </div>
    );
  }

  return (
    <div className="py-2 space-y-8">
      {actionMessage && (
        <div className={
          "text-[12px] px-3 py-2 rounded-lg border " +
          (actionMessage.success
            ? "bg-success/10 border-success/20 text-success"
            : "bg-error/10 border-error/20 text-error")
        }>
          {actionMessage.text}
        </div>
      )}

      {pluginErrors.length > 0 && (
        <PluginErrorsSection errors={pluginErrors} />
      )}

      <InstalledPlugins
        plugins={plugins}
        updatingKey={updatingKey}
        uninstallingKey={uninstallingKey}
        confirmUninstall={confirmUninstall}
        onViewDetails={handleViewDetails}
        onUpdate={handleUpdate}
        onUninstall={handleUninstall}
        onConfirmUninstall={setConfirmUninstall}
      />

      <MarketplaceSearch
        query={searchQuery}
        results={searchResults}
        searching={searching}
        hasSearched={hasSearched}
        installingKey={installingKey}
        installedKeys={installedKeys}
        onSearch={handleSearchInput}
        onInstall={handleInstall}
      />

      <DiscoverSection
        plugins={discoverPlugins}
        loaded={discoverLoaded}
        installingKey={installingKey}
        installedKeys={installedKeys}
        onInstall={handleInstall}
      />

      <MarketplaceList marketplaces={marketplaces} />

      {detailPlugin && (
        <PluginDetailModal
          plugin={detailPlugin}
          onClose={function () { setDetailPlugin(null); }}
        />
      )}
    </div>
  );
}

function InstalledPlugins({
  plugins,
  updatingKey,
  uninstallingKey,
  confirmUninstall,
  onViewDetails,
  onUpdate,
  onUninstall,
  onConfirmUninstall,
}: {
  plugins: PluginInfo[];
  updatingKey: string | null;
  uninstallingKey: string | null;
  confirmUninstall: string | null;
  onViewDetails: (p: PluginInfo) => void;
  onUpdate: (p: PluginInfo) => void;
  onUninstall: (p: PluginInfo) => void;
  onConfirmUninstall: (key: string | null) => void;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-base-content/40 mb-2">Installed Plugins</div>
      {plugins.length === 0 ? (
        <div className="py-6 text-center">
          <div className="text-[12px] text-base-content/30 mb-0.5">No plugins installed</div>
          <div className="text-[11px] text-base-content/20">Browse the marketplace or search below to add plugins.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {plugins.map(function (plugin) {
            return (
              <PluginCard
                key={plugin.key}
                plugin={plugin}
                isUpdating={updatingKey === plugin.key}
                isUninstalling={uninstallingKey === plugin.key}
                isConfirmingUninstall={confirmUninstall === plugin.key}
                onViewDetails={function () { onViewDetails(plugin); }}
                onUpdate={function () { onUpdate(plugin); }}
                onUninstall={function () { onUninstall(plugin); }}
                onConfirmUninstall={function () { onConfirmUninstall(plugin.key); }}
                onCancelUninstall={function () { onConfirmUninstall(null); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PluginCard({
  plugin,
  isUpdating,
  isUninstalling,
  isConfirmingUninstall,
  onViewDetails,
  onUpdate,
  onUninstall,
  onConfirmUninstall,
  onCancelUninstall,
}: {
  plugin: PluginInfo;
  isUpdating: boolean;
  isUninstalling: boolean;
  isConfirmingUninstall: boolean;
  onViewDetails: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
  onConfirmUninstall: () => void;
  onCancelUninstall: () => void;
}) {
  return (
    <div
      onClick={onViewDetails}
      className="flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl cursor-pointer hover:border-base-content/30 hover:bg-base-300/80 transition-colors duration-[120ms]"
      role="button"
      tabIndex={0}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewDetails(); } }}
    >
      <Blocks size={14} className="text-base-content/25 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-base-content truncate">{plugin.name}</span>
          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
            v{plugin.version}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-base-content/30">{plugin.marketplace}</span>
          <span className="text-[11px] text-base-content/25">
            {plugin.skillCount} skill{plugin.skillCount !== 1 ? "s" : ""}
            {plugin.hookCount > 0 ? ", " + plugin.hookCount + " hook" + (plugin.hookCount !== 1 ? "s" : "") : ""}
            {plugin.ruleCount > 0 ? ", " + plugin.ruleCount + " rule" + (plugin.ruleCount !== 1 ? "s" : "") : ""}
          </span>
        </div>
        {plugin.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-1">{plugin.description}</div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0 mt-0.5" onClick={function (e) { e.stopPropagation(); }}>
        {isUpdating ? (
          <Loader2 size={12} className="text-primary animate-spin mt-1 mx-1" />
        ) : (
          <button
            onClick={onUpdate}
            aria-label={"Update " + plugin.name}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-info focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw size={12} />
          </button>
        )}
        {isConfirmingUninstall ? (
          <div className="flex gap-1">
            <button
              onClick={onUninstall}
              className="btn btn-error btn-xs"
              disabled={isUninstalling}
            >
              {isUninstalling ? <Loader2 size={10} className="animate-spin" /> : "Remove"}
            </button>
            <button onClick={onCancelUninstall} className="btn btn-ghost btn-xs">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onConfirmUninstall}
            aria-label={"Remove " + plugin.name}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function MarketplaceSearch({
  query,
  results,
  searching,
  hasSearched,
  installingKey,
  installedKeys,
  onSearch,
  onInstall,
}: {
  query: string;
  results: MarketplacePluginEntry[];
  searching: boolean;
  hasSearched: boolean;
  installingKey: string | null;
  installedKeys: Set<string>;
  onSearch: (q: string) => void;
  onInstall: (name: string, marketplace: string) => void;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-base-content/40 mb-2">Browse Marketplace</div>
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={function (e) { onSearch(e.target.value); }}
          placeholder="Search plugins..."
          className="w-full bg-base-300 border border-base-content/15 rounded-xl pl-8 pr-3 py-2.5 text-[13px] text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary transition-colors"
        />
        {searching && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
        )}
      </div>
      {hasSearched && results.length === 0 && !searching && (
        <div className="py-4 text-center text-[13px] text-base-content/30">
          No plugins found for "{query}"
        </div>
      )}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(function (entry) {
            const key = entry.name + "@" + entry.marketplace;
            const isInstalled = installedKeys.has(key);
            const isInstalling = installingKey === key;
            return (
              <div
                key={key}
                className="flex items-start gap-3 px-3 py-2.5 bg-base-300/50 border border-base-content/10 rounded-xl"
              >
                <Package size={14} className="text-base-content/20 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-base-content truncate">{entry.name}</span>
                    <span className="text-[10px] font-mono text-base-content/30">{entry.marketplace}</span>
                  </div>
                  {entry.description && (
                    <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-2">{entry.description}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {entry.author && (
                      <span className="text-[10px] text-base-content/25">{entry.author.name}</span>
                    )}
                    {entry.installs != null && entry.installs > 0 && (
                      <span className="text-[10px] text-base-content/25 flex items-center gap-0.5">
                        <Download size={9} />
                        {formatInstalls(entry.installs)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 mt-0.5" onClick={function (e) { e.stopPropagation(); }}>
                  {isInstalled ? (
                    <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-success/10 text-success/70">
                      Installed
                    </span>
                  ) : isInstalling ? (
                    <Loader2 size={14} className="text-primary animate-spin mx-2" />
                  ) : (
                    <button
                      onClick={function () { onInstall(entry.name, entry.marketplace); }}
                      className="btn btn-primary btn-xs"
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MarketplaceList({ marketplaces }: { marketplaces: PluginMarketplaceInfo[] }) {
  if (marketplaces.length === 0) return null;
  return (
    <div>
      <div className="text-[12px] font-semibold text-base-content/40 mb-2">Registered Marketplaces</div>
      <div className="space-y-1.5">
        {marketplaces.map(function (m) {
          return (
            <div key={m.name} className="flex items-center gap-2.5 px-3 py-2 bg-base-300/30 border border-base-content/10 rounded-lg">
              <Package size={12} className="text-base-content/20 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-bold text-base-content/60">{m.name}</span>
                <span className="text-[11px] text-base-content/25 ml-2">{m.source.repo}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PluginDetailModal({ plugin, onClose }: { plugin: PluginDetails; onClose: () => void }) {
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () { document.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={"Plugin: " + plugin.name}>
      <div className="absolute inset-0 bg-base-content/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-xl shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Blocks size={16} className="text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-[15px] font-mono font-bold text-base-content truncate">{plugin.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-base-content/40">v{plugin.version}</span>
                <span className="text-[10px] text-base-content/30">{plugin.marketplace}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-3 border-b border-base-content/10 bg-base-300/30">
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {plugin.author && (
                <MetaItem label="Author" value={plugin.author.name} />
              )}
              {plugin.license && (
                <MetaItem label="License" value={plugin.license} />
              )}
              <MetaItem label="Installed" value={formatDate(plugin.installedAt)} />
              <MetaItem label="Updated" value={formatDate(plugin.lastUpdated)} />
              {plugin.homepage && (
                <a
                  href={plugin.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary/60 hover:text-primary transition-colors"
                >
                  <ExternalLink size={10} />
                  Homepage
                </a>
              )}
            </div>
          </div>

          {plugin.description && (
            <div className="px-5 py-3 border-b border-base-content/10">
              <p className="text-[13px] text-base-content/60">{plugin.description}</p>
            </div>
          )}

          {plugin.keywords && plugin.keywords.length > 0 && (
            <div className="px-5 py-3 border-b border-base-content/10">
              <div className="flex flex-wrap gap-1.5">
                {plugin.keywords.map(function (kw) {
                  return (
                    <span key={kw} className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
                      {kw}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {plugin.skills.length > 0 && (
            <div className="px-5 py-3 border-b border-base-content/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Puzzle size={12} className="text-base-content/30" />
                <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-wider">
                  Skills ({plugin.skills.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {plugin.skills.map(function (skill) {
                  return (
                    <div key={skill.name} className="flex items-start gap-2 py-1">
                      <ChevronRight size={10} className="text-base-content/20 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[12px] font-bold text-base-content/70">{skill.name}</span>
                        {skill.description && (
                          <div className="text-[11px] text-base-content/35 line-clamp-1">{skill.description}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(plugin.hooks).length > 0 && (
            <div className="px-5 py-3 border-b border-base-content/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Webhook size={12} className="text-base-content/30" />
                <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-wider">
                  Hooks ({Object.keys(plugin.hooks).length})
                </span>
              </div>
              <div className="space-y-1">
                {Object.keys(plugin.hooks).map(function (hookName) {
                  return (
                    <div key={hookName} className="flex items-center gap-2 py-0.5">
                      <ChevronRight size={10} className="text-base-content/20 flex-shrink-0" />
                      <span className="text-[12px] font-mono text-base-content/50">{hookName}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {plugin.rules.length > 0 && (
            <div className="px-5 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ScrollText size={12} className="text-base-content/30" />
                <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-wider">
                  Rules ({plugin.rules.length})
                </span>
              </div>
              <div className="space-y-1">
                {plugin.rules.map(function (rule) {
                  return (
                    <div key={rule} className="flex items-center gap-2 py-0.5">
                      <ChevronRight size={10} className="text-base-content/20 flex-shrink-0" />
                      <span className="text-[12px] font-mono text-base-content/50">{rule}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-base-content/15 flex-shrink-0">
          <div className="text-[11px] font-mono text-base-content/30 truncate">
            {plugin.gitCommitSha.slice(0, 8)} &middot; {plugin.installPath}
          </div>
        </div>
      </div>
    </div>
  );
}

function PluginErrorsSection({ errors }: { errors: PluginError[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={12} className="text-warning" />
        <span className="text-[12px] font-semibold text-warning/80">
          Errors ({errors.length})
        </span>
      </div>
      <div className="space-y-2">
        {errors.map(function (err) {
          return (
            <div key={err.key} className="px-3 py-2.5 bg-warning/5 border border-warning/20 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-bold text-base-content">{err.name}</span>
                <span className="text-[10px] font-mono text-base-content/30">{err.marketplace}</span>
              </div>
              {err.errors.map(function (e, i) {
                return (
                  <div key={i} className="flex items-start gap-1.5 mt-0.5">
                    <AlertTriangle size={10} className="text-warning/60 mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-warning/70">{e}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiscoverSection({
  plugins,
  loaded,
  installingKey,
  installedKeys,
  onInstall,
}: {
  plugins: MarketplacePluginEntry[];
  loaded: boolean;
  installingKey: string | null;
  installedKeys: Set<string>;
  onInstall: (name: string, marketplace: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 12;

  if (!loaded) return null;
  if (plugins.length === 0) return null;

  const visible = showAll ? plugins : plugins.slice(0, INITIAL_COUNT);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-semibold text-base-content/40">
          Discover ({plugins.length} available)
        </div>
      </div>
      <div className="space-y-2">
        {visible.map(function (entry) {
          const key = entry.name + "@" + entry.marketplace;
          const isInstalled = installedKeys.has(key);
          const isInstalling = installingKey === key;
          return (
            <div
              key={key}
              className="flex items-start gap-3 px-3 py-2.5 bg-base-300/50 border border-base-content/10 rounded-xl"
            >
              <Package size={14} className="text-base-content/20 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-base-content truncate">{entry.name}</span>
                  <span className="text-[10px] font-mono text-base-content/30">{entry.marketplace}</span>
                </div>
                {entry.description && (
                  <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-2">{entry.description}</div>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {entry.author && (
                    <span className="text-[10px] text-base-content/25">{entry.author.name}</span>
                  )}
                  {entry.installs != null && entry.installs > 0 && (
                    <span className="text-[10px] text-base-content/25 flex items-center gap-0.5">
                      <Download size={9} />
                      {formatInstalls(entry.installs)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 mt-0.5" onClick={function (e) { e.stopPropagation(); }}>
                {isInstalled ? (
                  <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-success/10 text-success/70">
                    Installed
                  </span>
                ) : isInstalling ? (
                  <Loader2 size={14} className="text-primary animate-spin mx-2" />
                ) : (
                  <button
                    onClick={function () { onInstall(entry.name, entry.marketplace); }}
                    className="btn btn-primary btn-xs"
                  >
                    Install
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!showAll && plugins.length > INITIAL_COUNT && (
        <button
          onClick={function () { setShowAll(true); }}
          className="mt-3 text-[12px] text-primary/60 hover:text-primary transition-colors"
        >
          Show all {plugins.length} plugins
        </button>
      )}
      {showAll && plugins.length > INITIAL_COUNT && (
        <button
          onClick={function () { setShowAll(false); }}
          className="mt-3 text-[12px] text-primary/60 hover:text-primary transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] font-mono text-base-content/35 uppercase tracking-wider">{label}</span>
      <span className="text-[12px] text-base-content/70">{value}</span>
    </div>
  );
}

function formatInstalls(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
  if (count >= 1000) return (count / 1000).toFixed(1) + "k";
  return String(count);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}
