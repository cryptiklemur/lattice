import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface SpecMarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function tiptapJsonToMarkdown(json: Record<string, unknown>): string {
  const doc = json as { type: string; content?: unknown[] };
  if (!doc.content) return "";
  return convertNodes(doc.content).trim();
}

function convertNodes(nodes: unknown[], listPrefix?: string): string {
  let result = "";
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as { type: string; content?: unknown[]; attrs?: Record<string, unknown> };
    result += convertNode(node, listPrefix);
  }
  return result;
}

function convertNode(node: { type: string; content?: unknown[]; attrs?: Record<string, unknown> }, listPrefix?: string): string {
  switch (node.type) {
    case "paragraph":
      return inlineContent(node.content) + "\n\n";
    case "heading": {
      const level = (node.attrs?.level as number) || 1;
      return "#".repeat(level) + " " + inlineContent(node.content) + "\n\n";
    }
    case "bulletList":
      return convertNodes(node.content || [], "- ");
    case "orderedList":
      return convertNodes(node.content || [], "1. ");
    case "listItem": {
      const inner = node.content?.[0] && (node.content[0] as { content?: unknown[] }).content
        ? (node.content[0] as { content: unknown[] }).content
        : node.content;
      return (listPrefix || "- ") + inlineContent(inner).trim() + "\n";
    }
    case "taskList":
      return convertNodes(node.content || [], "task");
    case "taskItem": {
      const checked = node.attrs?.checked ? "x" : " ";
      const taskInner = node.content?.[0] && (node.content[0] as { content?: unknown[] }).content
        ? (node.content[0] as { content: unknown[] }).content
        : node.content;
      return "- [" + checked + "] " + inlineContent(taskInner).trim() + "\n";
    }
    case "codeBlock": {
      const lang = (node.attrs?.language as string) || "";
      return "```" + lang + "\n" + inlineContent(node.content) + "\n```\n\n";
    }
    case "blockquote":
      return convertNodes(node.content || []).split("\n").map(function (line) { return line ? "> " + line : ">"; }).join("\n") + "\n";
    case "horizontalRule":
      return "---\n\n";
    default:
      if (node.content) return convertNodes(node.content);
      return "";
  }
}

function inlineContent(content?: unknown[]): string {
  if (!content) return "";
  let result = "";
  for (let i = 0; i < content.length; i++) {
    const node = content[i] as { type: string; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: unknown[] };
    if (node.type === "text") {
      let text = node.text || "";
      if (node.marks) {
        for (let m = 0; m < node.marks.length; m++) {
          const mark = node.marks[m];
          if (mark.type === "bold") text = "**" + text + "**";
          else if (mark.type === "italic") text = "*" + text + "*";
          else if (mark.type === "strike") text = "~~" + text + "~~";
          else if (mark.type === "code") text = "`" + text + "`";
          else if (mark.type === "link") text = "[" + text + "](" + (mark.attrs?.href || "") + ")";
        }
      }
      result += text;
    } else if (node.type === "hardBreak") {
      result += "\n";
    } else if (node.content) {
      result += inlineContent(node.content);
    }
  }
  return result;
}

function recoverMarkdownNewlines(text: string): string {
  if (text.includes("\n")) return text;
  if (!text.match(/#{1,6} /) && !text.match(/\| /)) return text;
  let result = text;
  result = result.replace(/((?:^|[^#\n]))(#{1,6} )/g, "$1\n\n$2");
  result = result.replace(/ (```)/g, "\n\n$1");
  result = result.replace(/(```) /g, "$1\n");
  result = result.replace(/ (---) /g, "\n\n$1\n\n");
  result = result.replace(/ (- \[[ x]\] )/g, "\n$1");
  result = result.replace(/ (- [A-Za-z`*])/g, "\n$1");
  result = result.replace(/ (\d+\. )/g, "\n$1");
  result = result.replace(/ (> )/g, "\n$1");
  result = result.replace(/\| \|/g, "|\n|");
  result = result.replace(/ (\*\*[A-Z])/g, "\n\n$1");
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

function tryParseTiptapJson(str: string): string | null {
  if (!str || !str.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(str);
    if (parsed.type === "doc") {
      const md = tiptapJsonToMarkdown(parsed);
      return recoverMarkdownNewlines(md);
    }
  } catch {}
  return null;
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.4em", fontWeight: "bold" },
  { tag: tags.heading2, fontSize: "1.2em", fontWeight: "bold" },
  { tag: tags.heading3, fontSize: "1.1em", fontWeight: "600" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", opacity: "0.5" },
  { tag: tags.link, textDecoration: "underline" },
  { tag: tags.url, textDecoration: "underline", opacity: "0.6" },
  { tag: tags.monospace, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" },
  { tag: tags.processingInstruction, opacity: "0.4" },
  { tag: tags.quote, fontStyle: "italic", opacity: "0.7" },
]);

const baseTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    padding: "12px 16px",
    minHeight: "280px",
    lineHeight: "1.7",
    caretColor: "oklch(var(--p))",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-cursor": {
    borderLeftColor: "oklch(var(--p))",
  },
  ".cm-selectionBackground": {
    backgroundColor: "oklch(var(--p) / 0.15) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "oklch(var(--p) / 0.2) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "oklch(var(--bc) / 0.03)",
  },
  ".cm-gutters": {
    display: "none",
  },
});

export function SpecMarkdownEditor({ content, onChange, placeholder, disabled }: SpecMarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initializedRef = useRef(false);
  const isExternalUpdateRef = useRef(false);

  const normalizeContent = useCallback(function (raw: string): string {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const converted = tryParseTiptapJson(raw);
      if (converted !== null) return converted;
      return recoverMarkdownNewlines(raw);
    }
    return raw;
  }, []);

  useEffect(function () {
    if (!containerRef.current) return;

    const normalized = normalizeContent(content);
    if (normalized !== content) {
      onChangeRef.current(normalized);
    }

    const startState = EditorState.create({
      doc: normalized,
      extensions: [
        baseTheme,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownHighlightStyle),
        keymap.of([...defaultKeymap, indentWithTab]),
        cmPlaceholder(placeholder || "Write markdown..."),
        EditorView.editable.of(!disabled),
        EditorView.lineWrapping,
        EditorView.updateListener.of(function (update) {
          if (update.docChanged && !isExternalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return function () {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(function () {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    const normalized = normalizeContent(content);
    if (normalized !== currentDoc) {
      isExternalUpdateRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: normalized,
        },
      });
      isExternalUpdateRef.current = false;
    }
  }, [content, normalizeContent]);

  return (
    <div className="border border-base-content/15 rounded-xl overflow-hidden bg-base-300">
      <div
        ref={containerRef}
        className="[&_.cm-editor]:bg-base-300 [&_.cm-content]:text-base-content/80 [&_.cm-placeholder]:text-base-content/30"
      />
    </div>
  );
}
