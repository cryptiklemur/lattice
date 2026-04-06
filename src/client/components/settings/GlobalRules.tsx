import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "#shared";

interface RuleEntry {
  filename: string;
  content: string;
}

export function GlobalRules() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [rules, setRules] = useState<RuleEntry[]>([]);
  var [claudeMd, setClaudeMd] = useState("");
  var [expanded, setExpanded] = useState<Set<number>>(new Set());
  var [claudeMdExpanded, setClaudeMdExpanded] = useState(false);

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config as unknown as Record<string, unknown>;
      setClaudeMd(cfg.claudeMd ? String(cfg.claudeMd) : "");
      setRules(data.globalRules ?? []);
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  function toggle(idx: number) {
    setExpanded(function (prev) {
      var next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function preview(content: string): string {
    var trimmed = content.trim();
    if (trimmed.length <= 80) return trimmed;
    return trimmed.slice(0, 80) + "...";
  }

  return (
    <div className="py-2">
      <a
        href="https://docs.anthropic.com/en/docs/claude-code/memory"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-base-content/30 hover:text-primary/70 flex items-center gap-1 mb-4 transition-colors"
      >
        <ExternalLink size={11} />
        Claude Code docs
      </a>
      <div className="mb-6">
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Global CLAUDE.md
        </h2>
        {!claudeMd && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global CLAUDE.md found.
          </div>
        )}
        {claudeMd && (
          <div className="border border-base-content/10 rounded-xl overflow-hidden">
            <button
              onClick={function () { setClaudeMdExpanded(!claudeMdExpanded); }}
              className="w-full flex items-center gap-2 px-3 py-2 bg-base-300/50 hover:bg-base-300/70 transition-colors duration-[120ms] cursor-pointer text-left"
            >
              {claudeMdExpanded
                ? <ChevronDown size={12} className="text-base-content/40 flex-shrink-0" />
                : <ChevronRight size={12} className="text-base-content/40 flex-shrink-0" />
              }
              <span className="font-mono text-[12px] text-base-content/40 flex-1 truncate">
                ~/.claude/CLAUDE.md
              </span>
            </button>
            {!claudeMdExpanded && (
              <div className="px-3 py-1.5 text-[11px] text-base-content/30 font-mono truncate">
                {preview(claudeMd)}
              </div>
            )}
            {claudeMdExpanded && (
              <pre className="px-3 py-2 text-[12px] text-base-content/40 font-mono whitespace-pre-wrap break-words bg-base-300/30 max-h-[300px] overflow-auto">
                {claudeMd}
              </pre>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Global Rules
        </h2>
        <p className="text-[11px] text-base-content/30 mb-3">
          Rules from ~/.claude/rules/ — read-only.
        </p>
        {rules.length === 0 && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global rules found.
          </div>
        )}
        {rules.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {rules.map(function (rule, idx) {
              var isExpanded = expanded.has(idx);
              return (
                <div key={rule.filename + "-" + idx} className="border border-base-content/10 rounded-xl overflow-hidden">
                  <button
                    onClick={function () { toggle(idx); }}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-base-300/50 hover:bg-base-300/70 transition-colors duration-[120ms] cursor-pointer text-left"
                  >
                    {isExpanded
                      ? <ChevronDown size={12} className="text-base-content/40 flex-shrink-0" />
                      : <ChevronRight size={12} className="text-base-content/40 flex-shrink-0" />
                    }
                    <span className="font-mono text-[12px] text-base-content/40 flex-1 truncate">
                      {rule.filename}
                    </span>
                  </button>
                  {!isExpanded && (
                    <div className="px-3 py-1.5 text-[11px] text-base-content/30 font-mono truncate">
                      {preview(rule.content)}
                    </div>
                  )}
                  {isExpanded && (
                    <pre className="px-3 py-2 text-[12px] text-base-content/40 font-mono whitespace-pre-wrap break-words bg-base-300/30 max-h-[300px] overflow-auto">
                      {rule.content}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
