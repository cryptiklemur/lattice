import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Columns2, AlignLeft, FileText, Image } from "lucide-react";

interface ToolResultRendererProps {
  toolName: string;
  args: string;
  result: string;
}

function parseArgs(argsStr: string): Record<string, unknown> {
  try {
    return JSON.parse(argsStr);
  } catch {
    return {};
  }
}

function isImagePath(path: string): boolean {
  var ext = path.split(".").pop()?.toLowerCase() || "";
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext);
}

function hasMarkdownTable(text: string): boolean {
  return /\|.+\|[\r\n]+\|[\s-:]+\|/.test(text);
}

function computeLineDiff(oldText: string, newText: string): Array<{ type: "same" | "add" | "remove"; text: string }> {
  var oldLines = oldText.split("\n");
  var newLines = newText.split("\n");
  var result: Array<{ type: "same" | "add" | "remove"; text: string }> = [];

  var prefixLen = 0;
  while (prefixLen < oldLines.length && prefixLen < newLines.length && oldLines[prefixLen] === newLines[prefixLen]) {
    prefixLen++;
  }

  var suffixLen = 0;
  while (
    suffixLen < oldLines.length - prefixLen &&
    suffixLen < newLines.length - prefixLen &&
    oldLines[oldLines.length - 1 - suffixLen] === newLines[newLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  var contextBefore = Math.max(0, prefixLen - 3);
  for (var i = contextBefore; i < prefixLen; i++) {
    result.push({ type: "same", text: oldLines[i] });
  }

  for (var j = prefixLen; j < oldLines.length - suffixLen; j++) {
    result.push({ type: "remove", text: oldLines[j] });
  }
  for (var k = prefixLen; k < newLines.length - suffixLen; k++) {
    result.push({ type: "add", text: newLines[k] });
  }

  var suffixStart = Math.max(oldLines.length - suffixLen, prefixLen);
  var contextAfter = Math.min(suffixStart + 3, oldLines.length);
  for (var l = suffixStart; l < contextAfter; l++) {
    result.push({ type: "same", text: oldLines[l] });
  }

  return result;
}

function DiffUnified(props: { oldText: string; newText: string }) {
  var lines = computeLineDiff(props.oldText, props.newText);
  return (
    <div className="font-mono text-[11px] leading-relaxed overflow-x-auto">
      {lines.map(function (line, i) {
        var bg = line.type === "add" ? "bg-success/10" : line.type === "remove" ? "bg-error/10" : "";
        var prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
        var color = line.type === "add" ? "text-success/70" : line.type === "remove" ? "text-error/70" : "text-base-content/40";
        return (
          <div key={i} className={bg + " px-2 whitespace-pre-wrap break-words"}>
            <span className={color + " select-none inline-block w-4"}>{prefix}</span>
            <span className={color}>{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function DiffSideBySide(props: { oldText: string; newText: string }) {
  var lines = computeLineDiff(props.oldText, props.newText);
  var leftLines: Array<{ text: string; type: string }> = [];
  var rightLines: Array<{ text: string; type: string }> = [];

  for (var i = 0; i < lines.length; i++) {
    if (lines[i].type === "same") {
      leftLines.push({ text: lines[i].text, type: "same" });
      rightLines.push({ text: lines[i].text, type: "same" });
    } else if (lines[i].type === "remove") {
      leftLines.push({ text: lines[i].text, type: "remove" });
    } else if (lines[i].type === "add") {
      rightLines.push({ text: lines[i].text, type: "add" });
    }
  }

  var maxLen = Math.max(leftLines.length, rightLines.length);
  while (leftLines.length < maxLen) leftLines.push({ text: "", type: "pad" });
  while (rightLines.length < maxLen) rightLines.push({ text: "", type: "pad" });

  return (
    <div className="font-mono text-[11px] leading-relaxed overflow-x-auto grid grid-cols-2 gap-0">
      <div className="border-r border-base-content/8">
        {leftLines.map(function (line, i) {
          var bg = line.type === "remove" ? "bg-error/10" : "";
          var color = line.type === "remove" ? "text-error/70" : line.type === "same" ? "text-base-content/40" : "text-transparent";
          return (
            <div key={i} className={bg + " px-2 whitespace-pre-wrap break-words min-h-[1.4em]"}>
              <span className={color}>{line.text}</span>
            </div>
          );
        })}
      </div>
      <div>
        {rightLines.map(function (line, i) {
          var bg = line.type === "add" ? "bg-success/10" : "";
          var color = line.type === "add" ? "text-success/70" : line.type === "same" ? "text-base-content/40" : "text-transparent";
          return (
            <div key={i} className={bg + " px-2 whitespace-pre-wrap break-words min-h-[1.4em]"}>
              <span className={color}>{line.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffRenderer(props: { oldText: string; newText: string }) {
  var [mode, setMode] = useState<"unified" | "split">("unified");

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold">Diff</div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={function () { setMode("unified"); }}
            className={"p-0.5 rounded transition-colors " + (mode === "unified" ? "text-primary/70 bg-primary/10" : "text-base-content/25 hover:text-base-content/40")}
            title="Unified view"
          >
            <AlignLeft size={11} />
          </button>
          <button
            type="button"
            onClick={function () { setMode("split"); }}
            className={"p-0.5 rounded transition-colors " + (mode === "split" ? "text-primary/70 bg-primary/10" : "text-base-content/25 hover:text-base-content/40")}
            title="Side-by-side view"
          >
            <Columns2 size={11} />
          </button>
        </div>
      </div>
      <div className="rounded-md bg-base-100/50 overflow-hidden">
        {mode === "unified" ? (
          <DiffUnified oldText={props.oldText} newText={props.newText} />
        ) : (
          <DiffSideBySide oldText={props.oldText} newText={props.newText} />
        )}
      </div>
    </div>
  );
}

function ImageRenderer(props: { path: string }) {
  var [error, setError] = useState(false);
  var [modalOpen, setModalOpen] = useState(false);
  var imgSrc = "/api/file?path=" + encodeURIComponent(props.path);
  var imageModalRef = useRef<HTMLDivElement>(null);
  var closeImageModal = useCallback(function () { setModalOpen(false); }, []);
  useFocusTrap(imageModalRef, closeImageModal, modalOpen);

  useEffect(function () {
    if (!modalOpen) return;
    var root = document.getElementById("root");
    if (root) root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return function () {
      if (root) root.style.overflow = "";
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [modalOpen]);

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-base-content/40">
        <Image size={12} />
        <span className="font-mono">{props.path}</span>
      </div>
    );
  }
  return (
    <>
      <div>
        <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold mb-1">Screenshot</div>
        <img
          src={imgSrc}
          alt={props.path}
          className="max-w-full max-h-[240px] rounded-md border border-base-content/10 cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all object-contain"
          onError={function () { setError(true); }}
          onClick={function () { setModalOpen(true); }}
          loading="lazy"
        />
        <div className="text-[10px] text-base-content/25 font-mono mt-1 truncate">{props.path}</div>
      </div>
      {modalOpen && createPortal(
        <div
          ref={imageModalRef}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 cursor-pointer overscroll-contain"
          onClick={function () { setModalOpen(false); }}
          onWheel={function (e) { e.stopPropagation(); }}
          onTouchMove={function (e) { e.stopPropagation(); }}
          role="dialog"
          aria-label="Image preview"
          tabIndex={0}
        >
          <div className="relative max-w-[95vw] max-h-[90vh] sm:max-w-[85vw] sm:max-h-[85vh]" onClick={function (e) { e.stopPropagation(); }}>
            <img
              src={imgSrc}
              alt={props.path}
              className="max-w-full max-h-[90vh] sm:max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="absolute -top-10 right-0 flex items-center gap-3">
              <a
                href={imgSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-mono text-white/50 hover:text-white/80 transition-colors"
                onClick={function (e) { e.stopPropagation(); }}
              >
                Open in tab
              </a>
              <button
                onClick={function () { setModalOpen(false); }}
                className="text-white/50 hover:text-white transition-colors text-lg leading-none"
                aria-label="Close preview"
              >
                &times;
              </button>
            </div>
            <div className="text-[11px] text-white/30 font-mono mt-2 truncate text-center">{props.path}</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function FileHeader(props: { path: string }) {
  var parts = props.path.split("/");
  var filename = parts[parts.length - 1] || props.path;
  var ext = filename.split(".").pop() || "";
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <FileText size={10} className="text-base-content/25" />
      <span className="text-[10px] font-mono text-base-content/40 truncate">{filename}</span>
      {ext && <span className="text-[9px] font-mono text-base-content/20 uppercase">{ext}</span>}
    </div>
  );
}

export function ToolResultRenderer(props: ToolResultRendererProps) {
  var args = parseArgs(props.args);
  var result = props.result;

  if ((props.toolName === "Edit" || props.toolName === "MultiEdit") && args.old_string && args.new_string) {
    return (
      <div className="px-2.5 py-2">
        <DiffRenderer oldText={String(args.old_string)} newText={String(args.new_string)} />
        {result && !result.includes("has been updated successfully") && (
          <div className="mt-2">
            <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold mb-0.5">Result</div>
            <pre className="font-mono text-[11px] text-base-content/45 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-100/50 rounded-md p-2 max-h-[160px] overflow-y-auto">
              {result}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (props.toolName === "mcp__playwright__browser_take_screenshot" || props.toolName === "mcp__playwright__browser_snapshot") {
    var screenshotMatch = result.match(/\[Screenshot[^\]]*\]\(([^)]+)\)/);
    var pathMatch = result.match(/path:\s*['"]?([^\s'"]+\.(?:png|jpg|jpeg))/i);
    var imagePath = screenshotMatch ? screenshotMatch[1] : pathMatch ? pathMatch[1] : null;
    if (imagePath) {
      return (
        <div className="px-2.5 py-2">
          <ImageRenderer path={imagePath} />
        </div>
      );
    }
  }

  if (props.toolName === "Read" && args.file_path && isImagePath(String(args.file_path))) {
    return (
      <div className="px-2.5 py-2">
        <ImageRenderer path={String(args.file_path)} />
      </div>
    );
  }

  if (props.toolName === "Read" && args.file_path && result) {
    return (
      <div className="px-2.5 py-2">
        <FileHeader path={String(args.file_path)} />
        <pre className="font-mono text-[11px] text-base-content/45 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-100/50 rounded-md p-2 max-h-[240px] overflow-y-auto">
          {result}
        </pre>
      </div>
    );
  }

  if (result && hasMarkdownTable(result)) {
    return (
      <div className="px-2.5 py-2">
        <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold mb-0.5">Result</div>
        <div className="prose prose-sm max-w-none text-[11px] [&_table]:text-[11px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_th]:text-base-content/60 [&_td]:text-base-content/45 [&_table]:border-base-content/10 [&_th]:border-base-content/10 [&_td]:border-base-content/10 [&_th]:bg-base-100/50">
          <Markdown remarkPlugins={[remarkGfm]}>{result}</Markdown>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="px-2.5 py-2">
      <div className="text-[9px] text-base-content/25 uppercase tracking-wider font-semibold mb-0.5">Result</div>
      <pre className="font-mono text-[11px] text-base-content/45 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-100/50 rounded-md p-2 max-h-[240px] overflow-y-auto">
        {result}
      </pre>
    </div>
  );
}
