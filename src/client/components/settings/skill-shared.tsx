import { useState, useEffect } from "react";
import { Trash2, RefreshCw, X, Loader2, FileText } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SkillInfo } from "@lattice/shared";

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  var match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  var meta: Record<string, string> = {};
  var lines = match[1].split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var colonIdx = lines[i].indexOf(":");
    if (colonIdx > 0) {
      var key = lines[i].slice(0, colonIdx).trim();
      var value = lines[i].slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      meta[key] = value;
    }
  }
  return { meta, body: match[2] };
}

export function SkillItem({
  skill,
  badge,
  onClick,
  actions,
}: {
  skill: SkillInfo;
  badge?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={
        "flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl transition-colors duration-[120ms]" +
        (onClick ? " cursor-pointer hover:border-base-content/30 hover:bg-base-300/80" : "")
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <FileText size={14} className="text-base-content/25 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-base-content truncate">{skill.name}</span>
          {badge && (
            <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
              {badge}
            </span>
          )}
        </div>
        {skill.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-2">{skill.description}</div>
        )}
      </div>
      {actions && (
        <div className="flex gap-1 flex-shrink-0 mt-0.5" onClick={function (e) { e.stopPropagation(); }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export function SkillActions({
  skill,
  onDelete,
  onUpdate,
  isDeleting,
  isUpdating,
}: {
  skill: SkillInfo;
  onDelete: () => void;
  onUpdate: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  var [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      {isUpdating ? (
        <Loader2 size={12} className="text-primary animate-spin mt-1 mx-1" />
      ) : (
        <button
          onClick={onUpdate}
          aria-label={"Update " + skill.name}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-info focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw size={12} />
        </button>
      )}
      {confirmDelete ? (
        <div className="flex gap-1">
          <button
            onClick={function () { onDelete(); setConfirmDelete(false); }}
            className="btn btn-error btn-xs"
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 size={10} className="animate-spin" /> : "Delete"}
          </button>
          <button
            onClick={function () { setConfirmDelete(false); }}
            className="btn btn-ghost btn-xs"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={function () { setConfirmDelete(true); }}
          aria-label={"Delete " + skill.name}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Trash2 size={12} />
        </button>
      )}
    </>
  );
}

export function SkillViewModal({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  var parsed = parseFrontmatter(content);
  var hasMeta = Object.keys(parsed.meta).length > 0;

  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return function () { document.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={"Skill: " + (parsed.meta.name || path)}>
      <div className="absolute inset-0 bg-base-content/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-primary flex-shrink-0" />
            <h2 className="text-[15px] font-mono font-bold text-base-content truncate">
              {parsed.meta.name || path.split("/").pop() || path}
            </h2>
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
          {hasMeta && (
            <div className="px-5 py-3 border-b border-base-content/10 bg-base-300/30">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {Object.entries(parsed.meta).map(function ([key, value]) {
                  return (
                    <div key={key} className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-mono text-base-content/35 uppercase tracking-wider">{key}</span>
                      <span className="text-[12px] text-base-content/70">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-5 py-4">
            <div className="prose prose-sm max-w-none prose-headings:text-base-content prose-headings:font-mono prose-p:text-base-content/70 prose-strong:text-base-content prose-code:text-base-content/60 prose-code:bg-base-100/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-pre:bg-base-100 prose-pre:text-base-content/70 prose-pre:text-[11px] prose-a:text-primary prose-li:text-base-content/70 prose-li:marker:text-base-content/30 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown remarkPlugins={[remarkGfm]}>{parsed.body}</Markdown>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-base-content/15 flex-shrink-0">
          <div className="text-[11px] font-mono text-base-content/30 truncate">{path}</div>
        </div>
      </div>
    </div>
  );
}
