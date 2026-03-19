import { useState, useEffect } from "react";
import { X, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { SaveFooter } from "../ui/SaveFooter";
import { useSaveState } from "../../hooks/useSaveState";
import type { ProjectSettings } from "@lattice/shared";

interface RuleEntry {
  filename: string;
  content: string;
}

export function ProjectRules({
  settings,
  updateSection,
}: {
  settings: ProjectSettings;
  updateSection: (section: string, data: Record<string, unknown>) => void;
}) {
  var globalRules = settings.global.rules ?? [];

  var [rules, setRules] = useState<RuleEntry[]>(function () {
    return (settings.rules ?? []).map(function (r) {
      return { filename: r.filename, content: r.content };
    });
  });
  var [expandedGlobal, setExpandedGlobal] = useState<Set<number>>(new Set());
  var [expandedProject, setExpandedProject] = useState<Set<number>>(new Set());
  var [adding, setAdding] = useState(false);
  var [newFilename, setNewFilename] = useState("");
  var [newContent, setNewContent] = useState("");
  var save = useSaveState();

  useEffect(function () {
    if (save.saving) {
      save.confirmSave();
    } else {
      setRules((settings.rules ?? []).map(function (r) {
        return { filename: r.filename, content: r.content };
      }));
      save.resetFromServer();
    }
  }, [settings]);

  function toggleGlobal(idx: number) {
    setExpandedGlobal(function (prev) {
      var next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function toggleProject(idx: number) {
    setExpandedProject(function (prev) {
      var next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function handleContentChange(idx: number, content: string) {
    setRules(function (prev) {
      return prev.map(function (r, i) {
        return i === idx ? { ...r, content } : r;
      });
    });
    save.markDirty();
  }

  function handleDelete(idx: number) {
    setRules(function (prev) {
      return prev.filter(function (_, i) { return i !== idx; });
    });
    setExpandedProject(new Set());
    save.markDirty();
  }

  function handleAdd() {
    var fn = newFilename.trim();
    if (!fn || !fn.endsWith(".md")) return;
    setRules(function (prev) {
      return [...prev, { filename: fn, content: newContent }];
    });
    setNewFilename("");
    setNewContent("");
    setAdding(false);
    save.markDirty();
  }

  function handleCancelAdd() {
    setAdding(false);
    setNewFilename("");
    setNewContent("");
  }

  function handleSave() {
    save.startSave();
    updateSection("rules", { rules });
  }

  function preview(content: string): string {
    var trimmed = content.trim();
    if (trimmed.length <= 80) return trimmed;
    return trimmed.slice(0, 80) + "...";
  }

  var textareaClass = "w-full px-3 py-2 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms] resize-y min-h-[120px]";
  var inputClass = "w-full h-9 sm:h-7 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]";

  return (
    <div className="py-2">
      <div className="mb-6">
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Global Rules
        </h2>
        {globalRules.length === 0 && (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global rules.
          </div>
        )}
        {globalRules.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {globalRules.map(function (rule, idx) {
              var isExpanded = expandedGlobal.has(idx);
              return (
                <div key={rule.filename + "-" + idx} className="border border-base-content/10 rounded-xl overflow-hidden">
                  <button
                    onClick={function () { toggleGlobal(idx); }}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-base-300/50 hover:bg-base-300/70 transition-colors duration-[120ms] cursor-pointer text-left"
                  >
                    {isExpanded
                      ? <ChevronDown size={12} className="text-base-content/40 flex-shrink-0" />
                      : <ChevronRight size={12} className="text-base-content/40 flex-shrink-0" />
                    }
                    <span className="font-mono text-[12px] text-base-content/40 flex-1 truncate">
                      {rule.filename}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-base-content/30">
                      global
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

      <div>
        <h2 className="text-[12px] font-semibold text-base-content/40 mb-3">
          Project Rules
        </h2>
        {rules.length === 0 && !adding && (
          <div className="py-4 text-center text-[13px] text-base-content/30 mb-3">
            No project rules.
          </div>
        )}
        {rules.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {rules.map(function (rule, idx) {
              var isExpanded = expandedProject.has(idx);
              return (
                <div key={rule.filename + "-" + idx} className="border border-base-content/15 rounded-xl overflow-hidden">
                  <div className="w-full flex items-center gap-2 px-3 py-2 bg-base-300 text-left">
                    <button
                      onClick={function () { toggleProject(idx); }}
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:text-base-content/80 transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown size={12} className="text-base-content/60 flex-shrink-0" />
                        : <ChevronRight size={12} className="text-base-content/60 flex-shrink-0" />
                      }
                      <span className="font-mono text-[12px] text-base-content flex-1 truncate text-left">
                        {rule.filename}
                      </span>
                    </button>
                    <button
                      onClick={function () { handleDelete(idx); }}
                      className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={"Delete " + rule.filename}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {!isExpanded && (
                    <div className="px-3 py-1.5 text-[11px] text-base-content/50 font-mono truncate">
                      {preview(rule.content)}
                    </div>
                  )}
                  {isExpanded && (
                    <div className="px-3 py-2 bg-base-300/30">
                      <textarea
                        value={rule.content}
                        onChange={function (e) { handleContentChange(idx, e.target.value); }}
                        className={textareaClass}
                        rows={8}
                        aria-label={"Content for " + rule.filename}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {adding && (
          <div className="border border-dashed border-base-content/20 rounded-xl p-3 mb-3 flex flex-col gap-2">
            <input
              type="text"
              value={newFilename}
              onChange={function (e) { setNewFilename(e.target.value); }}
              placeholder="filename.md"
              aria-label="New rule filename"
              className={inputClass}
            />
            <textarea
              value={newContent}
              onChange={function (e) { setNewContent(e.target.value); }}
              placeholder="Rule content..."
              aria-label="New rule content"
              className={textareaClass}
              rows={5}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCancelAdd}
                className="btn btn-ghost btn-sm text-[12px]"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newFilename.trim() || !newFilename.trim().endsWith(".md")}
                className={
                  "btn btn-sm btn-primary text-[12px]" +
                  (!newFilename.trim() || !newFilename.trim().endsWith(".md") ? " opacity-50 cursor-not-allowed" : "")
                }
              >
                Add
              </button>
            </div>
          </div>
        )}

        {!adding && (
          <button
            onClick={function () { setAdding(true); }}
            className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-xl border border-dashed border-base-content/20 bg-transparent text-base-content/40 text-[12px] hover:text-base-content/60 hover:border-base-content/30 transition-colors duration-[120ms] mb-5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100"
          >
            <Plus size={12} />
            Add Rule
          </button>
        )}

        <SaveFooter dirty={save.dirty} saving={save.saving} saveState={save.saveState} onSave={handleSave} />
      </div>
    </div>
  );
}
