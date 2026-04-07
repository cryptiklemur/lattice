import { useEffect, useState, useRef, useMemo } from "react";
import { Lightbulb } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSession } from "../../hooks/useSession";
import { useTheme } from "../../hooks/useTheme";
import type { ServerMessage } from "#shared";

function resolveThemeVars(): string {
  var style = getComputedStyle(document.documentElement);
  var base100 = style.getPropertyValue("--color-base-100").trim();
  var base200 = style.getPropertyValue("--color-base-200").trim();
  var base300 = style.getPropertyValue("--color-base-300").trim();
  var baseContent = style.getPropertyValue("--color-base-content").trim();
  var primary = style.getPropertyValue("--color-primary").trim();
  var primaryContent = style.getPropertyValue("--color-primary-content").trim();

  // Extract raw oklch values (strip "oklch(" and ")")
  function raw(v: string): string {
    return v.replace(/^oklch\(/, "").replace(/\)$/, "");
  }
  var bc = raw(baseContent);
  var p = raw(primary);

  return `
  :root {
    --bg-primary: ${base100};
    --bg-secondary: ${base200};
    --bg-tertiary: ${base300};
    --border: oklch(${bc} / 0.15);
    --text-primary: ${baseContent};
    --text-secondary: oklch(${bc} / 0.6);
    --accent: ${primary};
    --accent-content: ${primaryContent};
    --selected-bg: oklch(${p} / 0.12);
    --selected-border: ${primary};
  }`;
}

var IFRAME_CSS_BODY = `

  *, *::before, *::after { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 16px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 14px;
    line-height: 1.6;
  }

  h2, h3 {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary);
    margin: 0 0 8px;
  }

  h2 { font-size: 18px; }
  h3 { font-size: 14px; }

  .subtitle {
    color: var(--text-secondary);
    font-size: 12px;
    margin-bottom: 16px;
  }

  .section {
    margin-bottom: 20px;
  }

  .label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }

  .option:hover {
    border-color: var(--accent);
  }

  .option.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
  }

  .letter {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    background: var(--selected-bg);
    border-radius: 4px;
    padding: 2px 6px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }

  .card {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-secondary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }

  .card:hover {
    border-color: var(--accent);
  }

  .card.selected {
    background: var(--selected-bg);
    border-color: var(--selected-border);
  }

  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .pros-cons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .pros-cons > div {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .mockup {
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    font-size: 12px;
  }

  .mockup-header {
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .mockup-body {
    background: var(--bg-secondary);
    padding: 12px;
  }

  .mock-nav {
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    padding: 6px 12px;
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .mock-sidebar {
    background: var(--bg-tertiary);
    border-right: 1px solid var(--border);
    padding: 10px;
    width: 120px;
    flex-shrink: 0;
  }

  .mock-content {
    flex: 1;
    padding: 10px;
  }

  .mock-button {
    display: inline-block;
    background: var(--accent);
    color: var(--accent-content);
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
  }

  .mock-input {
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    background: var(--bg-primary);
    color: var(--text-primary);
    width: 100%;
  }

  .placeholder {
    background: var(--bg-tertiary);
    border-radius: 4px;
    height: 12px;
    margin-bottom: 6px;
  }
`;

var CLICK_SCRIPT = `
  function toggleSelect(el) {
    var isOption = el.classList.contains('option');
    var isCard = el.classList.contains('card');
    if (!isOption && !isCard) return;
    if (el.classList.contains('selected')) {
      el.classList.remove('selected');
    } else {
      el.classList.add('selected');
    }
  }

  document.addEventListener('click', function(e) {
    var el = e.target.closest('[data-choice]');
    if (!el) return;
    toggleSelect(el);
    var h3 = el.querySelector('h3');
    var label = h3 ? h3.textContent.trim() : (el.textContent || '').trim().slice(0, 80);
    parent.postMessage({ type: 'brainstorm-select', choice: el.dataset.choice, text: label }, '*');
  });
`;

export function BrainstormView() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { sendMessage } = useSession();
  var [html, setHtml] = useState<string | null>(null);
  var [sessionDir, setSessionDir] = useState<string | null>(null);
  var sessionDirRef = useRef<string | null>(null);

  sessionDirRef.current = sessionDir;

  useEffect(function () {
    function onContent(msg: ServerMessage) {
      if (msg.type !== "brainstorm:content") return;
      setHtml(msg.html);
      setSessionDir(msg.sessionDir);
    }

    function onCleared(msg: ServerMessage) {
      if (msg.type !== "brainstorm:cleared") return;
      setHtml(null);
      setSessionDir(null);
    }

    function onStatus(msg: ServerMessage) {
      if (msg.type !== "brainstorm:status") return;
      if (msg.active && msg.html) {
        setHtml(msg.html);
        setSessionDir(msg.sessionDir ?? null);
      } else {
        setHtml(null);
        setSessionDir(null);
      }
    }

    subscribe("brainstorm:content", onContent);
    subscribe("brainstorm:cleared", onCleared);
    subscribe("brainstorm:status", onStatus);

    send({ type: "brainstorm:status_request" });

    return function () {
      unsubscribe("brainstorm:content", onContent);
      unsubscribe("brainstorm:cleared", onCleared);
      unsubscribe("brainstorm:status", onStatus);
    };
  }, []);

  useEffect(function () {
    function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== "brainstorm-select") return;
      var dir = sessionDirRef.current;
      if (!dir) return;
      send({
        type: "brainstorm:select",
        choice: e.data.choice,
        text: e.data.text,
        sessionDir: dir,
      });
      sendMessage("I selected: " + e.data.text);
    }

    window.addEventListener("message", onMessage);
    return function () {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  var { currentThemeId } = useTheme();
  var themeVars = useMemo(resolveThemeVars, [currentThemeId]);

  var srcdoc = html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${themeVars}\n${IFRAME_CSS_BODY}</style></head><body>${html}<script>${CLICK_SCRIPT}</script></body></html>`
    : null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-base-content/10 bg-base-100 flex-shrink-0">
        <Lightbulb size={16} className="text-warning" />
        <span className="text-sm font-semibold text-base-content">Brainstorm</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {srcdoc ? (
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            className="w-full h-full border-none"
            title="Brainstorm"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-base-content/30 gap-3">
            <Lightbulb size={32} className="text-base-content/15" />
            <div className="text-[13px] font-mono">No brainstorm active</div>
            <div className="text-[11px] text-base-content/20 max-w-[260px] text-center">
              Ask Claude to brainstorm options and they'll appear here.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
