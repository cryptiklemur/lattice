import { useState, useEffect, useRef } from "react";
import { Search, Download, ChevronDown, Loader2 } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useProjects } from "../../hooks/useProjects";
import type { ServerMessage, MarketplaceSkill } from "#shared";

interface SkillMarketplaceProps {
  defaultScope?: "global" | "project";
  defaultProjectSlug?: string;
}

export function SkillMarketplace({ defaultScope, defaultProjectSlug }: SkillMarketplaceProps) {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const { projects } = useProjects();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketplaceSkill[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState<string | null>(null);
  const [lastInstallScope, setLastInstallScope] = useState<"global" | "project">("global");
  const [lastInstallProjectSlug, setLastInstallProjectSlug] = useState<string | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(function () {
    function handleResults(msg: ServerMessage) {
      if (msg.type !== "skills:search_results") return;
      const data = msg as ServerMessage & { query: string; skills: MarketplaceSkill[]; count: number; error?: string };
      setResults(data.skills);
      setCount(data.count);
      setError(data.error ?? null);
      setSearching(false);
    }

    function handleInstallResult(msg: ServerMessage) {
      if (msg.type !== "skills:install_result") return;
      const result = msg as { type: "skills:install_result"; success: boolean };
      if (result.success && lastInstallScope === "project" && lastInstallProjectSlug) {
        send({ type: "project-settings:get", projectSlug: lastInstallProjectSlug });
      }
      setInstalling(null);
    }

    subscribe("skills:search_results", handleResults);
    subscribe("skills:install_result", handleInstallResult);

    return function () {
      unsubscribe("skills:search_results", handleResults);
      unsubscribe("skills:install_result", handleInstallResult);
    };
  }, []);

  useEffect(function () {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setCount(0);
      setError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(function () {
      send({ type: "skills:search", query: trimmed });
    }, 300);
  }, [query]);

  function handleInstall(skill: MarketplaceSkill, scope: "global" | "project", projectSlug?: string) {
    setInstalling(skill.id);
    setScopeOpen(null);
    setLastInstallScope(scope);
    setLastInstallProjectSlug(projectSlug);
    send({
      type: "skills:install",
      source: skill.source,
      scope: scope,
      projectSlug: projectSlug,
    });
  }

  function formatInstalls(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  return (
    <div>
      <div className="text-[12px] font-semibold text-base-content/40 mb-2">Skill Marketplace</div>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
        <input
          type="text"
          value={query}
          onChange={function (e) { setQuery(e.target.value); }}
          placeholder="Search skills.sh..."
          className="w-full h-9 sm:h-7 pl-9 pr-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
        />
        {searching && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 animate-spin" />
        )}
      </div>
      {error && (
        <div className="text-[12px] text-warning mb-2">{error}</div>
      )}
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.slice(0, 15).map(function (skill) {
            const isInstalling = installing === skill.id;
            const isScopeOpen = scopeOpen === skill.id;
            return (
              <div
                key={skill.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-base-300 border border-base-content/15"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-base-content truncate">{skill.name}</div>
                  <div className="text-[11px] font-mono text-base-content/30 truncate">{skill.source}</div>
                </div>
                <span className="text-[10px] text-base-content/30 font-mono flex-shrink-0">
                  {formatInstalls(skill.installs)}
                </span>
                <div className="relative flex-shrink-0">
                  {isInstalling ? (
                    <Loader2 size={14} className="text-primary animate-spin" />
                  ) : (
                    <button
                      onClick={function () { setScopeOpen(isScopeOpen ? null : skill.id); }}
                      className="btn btn-ghost btn-xs text-[11px] text-base-content/50 hover:text-primary gap-1"
                    >
                      <Download size={12} />
                      Install
                      <ChevronDown size={10} />
                    </button>
                  )}
                  {isScopeOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-base-200 border border-base-content/15 rounded-xl shadow-lg py-1 min-w-[160px]">
                      <button
                        onClick={function () { handleInstall(skill, "global"); }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-base-content/60 hover:bg-base-content/5 hover:text-base-content"
                      >
                        Install globally
                      </button>
                      {projects.map(function (p) {
                        return (
                          <button
                            key={p.slug}
                            onClick={function () { handleInstall(skill, "project", p.slug); }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-base-content/60 hover:bg-base-content/5 hover:text-base-content truncate"
                          >
                            Install to {p.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {query.trim() && !searching && results.length === 0 && !error && (
        <div className="py-4 text-center text-[13px] text-base-content/30">
          No skills found.
        </div>
      )}
    </div>
  );
}
