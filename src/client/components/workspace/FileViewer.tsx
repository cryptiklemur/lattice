import { useEffect, useRef, useState } from "react";
import { Copy, Check, ExternalLink, FileCode, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { HighlighterCore } from "shiki";

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLanguages = new Set<string>();

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(function (shiki) {
      return shiki.createHighlighter({
        themes: ["css-variables"],
        langs: [],
      });
    });
  }
  return highlighterPromise;
}

async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();
  let resolvedLang = lang === "text" ? "text" : lang;

  if (resolvedLang !== "text" && !loadedLanguages.has(resolvedLang)) {
    try {
      await highlighter.loadLanguage(resolvedLang as any);
      loadedLanguages.add(resolvedLang);
    } catch {
      resolvedLang = "text";
    }
  }

  return highlighter.codeToHtml(code, {
    lang: resolvedLang,
    theme: "css-variables",
  });
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  py: "python",
  rs: "rust",
  go: "go",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  graphql: "graphql",
  dockerfile: "dockerfile",
  makefile: "makefile",
  vue: "vue",
  svelte: "svelte",
  lua: "lua",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
};

function getLanguage(path: string): string {
  const filename = path.split("/").pop() || "";
  const lower = filename.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_LANG[ext] || "text";
}

function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

interface FileViewerProps {
  path: string;
  content: string;
  editorUrl: string | null;
}

export function FileViewer(props: FileViewerProps) {
  const { path, content, editorUrl } = props;
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRendered, setShowRendered] = useState(true);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const language = getLanguage(path);
  const lineCount = content.split("\n").length;
  const isMd = isMarkdown(path);
  const filename = path.split("/").pop() || path;

  useEffect(function () {
    setHighlightedHtml(null);
    if (isMd && showRendered) return;

    let cancelled = false;
    highlightCode(content, language).then(function (html) {
      if (cancelled) return;
      setHighlightedHtml(html);
    }).catch(function () {
      // fallback to plain text
    });

    return function () {
      cancelled = true;
    };
  }, [content, language, isMd, showRendered]);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(function () {
      setCopied(false);
    }, 2000);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="h-9 flex-shrink-0 flex items-center gap-2 px-4 border-b border-base-content/15 bg-base-200">
        <FileCode size={13} className="text-base-content/40 flex-shrink-0" />
        <span className="text-[12px] font-mono text-base-content/60 truncate">{filename}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-base-300 text-base-content/40 uppercase flex-shrink-0">
          {language}
        </span>
        <span className="text-[10px] font-mono text-base-content/30 flex-shrink-0">
          {lineCount} lines
        </span>
        <div className="flex-1" />
        {isMd && (
          <button
            onClick={function () { setShowRendered(!showRendered); }}
            className={
              "btn btn-ghost btn-xs gap-1 text-[11px] " +
              (showRendered ? "text-primary" : "text-base-content/50")
            }
            title={showRendered ? "Show source" : "Show rendered"}
          >
            <Eye size={13} />
            {showRendered ? "Source" : "Rendered"}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content"
          title="Copy to clipboard"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
        </button>
        {editorUrl && (
          <a
            href={editorUrl}
            className="btn btn-ghost btn-xs text-base-content/50 hover:text-base-content"
            title="Open in editor"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isMd && showRendered ? (
          <div className="prose prose-sm max-w-none p-4">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : highlightedHtml ? (
          <div
            className="p-4 text-[13px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!bg-transparent"
            style={{
              "--shiki-foreground": "var(--base05)",
              "--shiki-background": "transparent",
              "--shiki-token-constant": "var(--base09)",
              "--shiki-token-string": "var(--base0B)",
              "--shiki-token-comment": "var(--base03)",
              "--shiki-token-keyword": "var(--base0E)",
              "--shiki-token-parameter": "var(--base08)",
              "--shiki-token-function": "var(--base0D)",
              "--shiki-token-string-expression": "var(--base0B)",
              "--shiki-token-punctuation": "var(--base05)",
              "--shiki-token-link": "var(--base0D)",
            } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="m-0 p-4 text-[13px] font-mono text-base-content leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
