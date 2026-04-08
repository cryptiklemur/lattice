import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { X, FolderOpen, FileText, Loader2 } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useProjects } from "../../hooks/useProjects";
import type { ServerMessage } from "#shared";

interface BrowseEntry {
  name: string;
  path: string;
  hasClaudeMd: boolean;
  projectName: string | null;
}

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddProjectModal({ isOpen, onClose }: AddProjectModalProps) {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { projects } = useProjects();

  var [path, setPath] = useState("");
  var [entries, setEntries] = useState<BrowseEntry[]>([]);
  var [title, setTitle] = useState("");
  var [titleManuallySet, setTitleManuallySet] = useState(false);
  var [dropdownOpen, setDropdownOpen] = useState(false);
  var [highlightIndex, setHighlightIndex] = useState(-1);
  var [error, setError] = useState<string | null>(null);
  var [adding, setAdding] = useState(false);
  var [suggestions, setSuggestions] = useState<Array<{ path: string; name: string; hasClaudeMd: boolean }>>([]);
  var [homedir, setHomedir] = useState("");
  var debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  var inputRef = useRef<HTMLInputElement>(null);
  var dropdownRef = useRef<HTMLDivElement>(null);
  var inputFocusedRef = useRef(false);
  var addingRef = useRef(false);
  var modalRef = useRef<HTMLDivElement>(null);
  var stableOnClose = useCallback(function () { onClose(); }, [onClose]);
  useFocusTrap(modalRef, stableOnClose, isOpen);

  useEffect(function () {
    if (!isOpen) return;

    setPath("");
    setEntries([]);
    setTitle("");
    setTitleManuallySet(false);
    setDropdownOpen(false);
    setError(null);
    setAdding(false);
    setSuggestions([]);
    addingRef.current = false;

    send({ type: "browse:list", path: "~" } as any);
    send({ type: "browse:suggestions" } as any);

    function handleBrowseResult(msg: ServerMessage) {
      if (msg.type !== "browse:list_result") return;
      var data = msg as { type: "browse:list_result"; path: string; homedir: string; entries: BrowseEntry[] };
      setEntries(data.entries);
      setHomedir(data.homedir);
      setHighlightIndex(-1);
      if (inputFocusedRef.current && data.entries.length > 0) {
        setDropdownOpen(true);
      }
    }

    function handleSuggestions(msg: ServerMessage) {
      if (msg.type !== "browse:suggestions_result") return;
      var data = msg as { type: "browse:suggestions_result"; suggestions: Array<{ path: string; name: string; hasClaudeMd: boolean }> };
      setSuggestions(data.suggestions);
    }

    function handleProjectsList(msg: ServerMessage) {
      if (msg.type !== "projects:list") return;
      if (addingRef.current) {
        addingRef.current = false;
        setAdding(false);
        onClose();
      }
    }

    subscribe("browse:list_result", handleBrowseResult);
    subscribe("browse:suggestions_result", handleSuggestions);
    subscribe("projects:list", handleProjectsList);

    return function () {
      unsubscribe("browse:list_result", handleBrowseResult);
      unsubscribe("browse:suggestions_result", handleSuggestions);
      unsubscribe("projects:list", handleProjectsList);
    };
  }, [isOpen]);

  useEffect(function () {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return function () {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen]);

  useEffect(function () {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    var trimmed = path.trim();
    if (!trimmed) {
      send({ type: "browse:list", path: "~" } as any);
      return;
    }

    debounceRef.current = setTimeout(function () {
      var parentDir = trimmed;
      if (!trimmed.endsWith("/")) {
        var lastSlash = trimmed.lastIndexOf("/");
        parentDir = lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : trimmed;
      }
      send({ type: "browse:list", path: parentDir } as any);
    }, 200);
  }, [path, isOpen]);

  function resolvePath(p: string): string {
    if (p.startsWith("~/") && homedir) return homedir + p.slice(1);
    if (p === "~" && homedir) return homedir;
    return p;
  }

  function handleSelectEntry(entry: BrowseEntry) {
    var newPath = entry.path + "/";
    setPath(newPath);
    setDropdownOpen(false);
    setError(null);

    if (!titleManuallySet) {
      if (entry.projectName) {
        setTitle(entry.projectName);
      } else {
        setTitle(entry.name);
      }
    }

    send({ type: "browse:list", path: entry.path } as any);

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    setTitleManuallySet(value.length > 0);
  }

  function handleInputFocus() {
    inputFocusedRef.current = true;
    if (getFilteredEntries().length > 0) {
      setDropdownOpen(true);
    }
  }

  function handleInputBlur() {
    inputFocusedRef.current = false;
  }

  function getFilteredEntries(): BrowseEntry[] {
    var trimmed = path.trim();
    if (!trimmed || trimmed.endsWith("/")) return entries;

    var lastSlash = trimmed.lastIndexOf("/");
    var filter = lastSlash >= 0 ? trimmed.slice(lastSlash + 1).toLowerCase() : trimmed.toLowerCase();
    if (!filter) return entries;

    return entries.filter(function (e) {
      return e.name.toLowerCase().startsWith(filter);
    });
  }

  function isValidPath(): boolean {
    var trimmed = path.trim();
    if (!trimmed) return false;
    var resolved = resolvePath(trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed);
    var alreadyAdded = projects.some(function (p) { return p.path === resolved; });
    if (alreadyAdded) return false;
    return true;
  }

  function getValidationMessage(): { type: "info" | "error" | "success"; text: string } | null {
    var trimmed = path.trim();
    if (!trimmed) return { type: "info", text: "Type a path to browse directories" };

    var resolved = resolvePath(trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed);
    var alreadyAdded = projects.some(function (p) { return p.path === resolved; });
    if (alreadyAdded) return { type: "error", text: "Already added as a project" };

    return null;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    var filtered = getFilteredEntries();
    if (!dropdownOpen || filtered.length === 0) {
      if (e.key === "Enter" && canAdd) {
        e.preventDefault();
        handleAdd();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(function (prev) {
        var next = prev + 1;
        if (next >= filtered.length) next = 0;
        scrollHighlightIntoView(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(function (prev) {
        var next = prev - 1;
        if (next < 0) next = filtered.length - 1;
        scrollHighlightIntoView(next);
        return next;
      });
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < filtered.length) {
        e.preventDefault();
        handleSelectEntry(filtered[highlightIndex]);
        setHighlightIndex(-1);
      } else if (e.key === "Enter" && canAdd) {
        e.preventDefault();
        handleAdd();
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setDropdownOpen(false);
      setHighlightIndex(-1);
    }
  }

  function scrollHighlightIntoView(index: number) {
    if (!dropdownRef.current) return;
    var items = dropdownRef.current.children;
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }

  var canAdd = isValidPath() && !adding;

  function handleAdd() {
    var trimmed = path.trim();
    if (!trimmed || adding) return;

    var resolved = resolvePath(trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed);
    var finalTitle = title.trim() || resolved.split("/").pop() || "Untitled";

    setAdding(true);
    addingRef.current = true;
    send({
      type: "settings:update",
      settings: {
        projects: [{ path: resolved, title: finalTitle }],
      },
    } as any);
  }

  if (!isOpen) return null;

  var filtered = getFilteredEntries();
  var validation = getValidationMessage();

  return (
    <div ref={modalRef} className="fixed inset-0 z-[9999] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Add Project">
      <div className="absolute inset-0 bg-base-content/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-xl shadow-lg w-full max-w-3xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15">
          <h2 className="text-[15px] font-mono font-bold text-base-content">Add Project</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="project-path" className="block text-[12px] font-semibold text-base-content/40 mb-1.5">
              Project Path
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="project-path"
                type="text"
                value={path}
                onChange={function (e) { setPath(e.target.value); setDropdownOpen(true); setHighlightIndex(-1); setError(null); }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                placeholder="~/projects/my-app"
                autoFocus
                className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content font-mono text-[12px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
              />

              {dropdownOpen && filtered.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 mt-1 z-50 bg-base-200 border border-base-content/15 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  {filtered.map(function (entry, idx) {
                    var isHighlighted = idx === highlightIndex;
                    return (
                      <button
                        key={entry.path}
                        onMouseDown={function (e) { e.preventDefault(); }}
                        onClick={function () { handleSelectEntry(entry); setHighlightIndex(-1); }}
                        onMouseEnter={function () { setHighlightIndex(idx); }}
                        className={
                          "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-mono transition-colors duration-[80ms] " +
                          (isHighlighted
                            ? "bg-base-content/10 text-base-content"
                            : "text-base-content/60 hover:bg-base-content/5 hover:text-base-content")
                        }
                      >
                        <FolderOpen size={12} className="text-base-content/25 flex-shrink-0" />
                        <span className="flex-1 truncate">{entry.name}/</span>
                        {entry.projectName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent/70 flex-shrink-0 truncate max-w-[100px]">
                            {entry.projectName}
                          </span>
                        )}
                        {entry.hasClaudeMd && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary/70 flex-shrink-0">
                            <FileText size={8} />
                            CLAUDE.md
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="text-[10px] text-base-content/25 mt-1">Type a path or click directories to navigate</div>

            {!path.trim() && suggestions.length > 0 && !dropdownOpen && (
              <div className="mt-2">
                <div className="text-[11px] font-semibold text-base-content/30 mb-1.5">Projects Claude has worked in</div>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {suggestions.map(function (s) {
                    return (
                      <button
                        key={s.path}
                        title={s.path}
                        onClick={function () {
                          setPath(s.path + "/");
                          if (!titleManuallySet) setTitle(s.name);
                          setSuggestions([]);
                          send({ type: "browse:list", path: s.path } as any);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] font-mono text-base-content/50 hover:bg-base-content/5 hover:text-base-content rounded-lg transition-colors duration-[80ms]"
                      >
                        <FolderOpen size={12} className="text-base-content/25 flex-shrink-0" />
                        <span className="flex-1 truncate">{s.path}</span>
                        {s.hasClaudeMd && (
                          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary/70 flex-shrink-0">
                            <FileText size={8} />
                            CLAUDE.md
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="project-title" className="block text-[12px] font-semibold text-base-content/40 mb-1.5">
              Title <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={function (e) { handleTitleChange(e.target.value); }}
              placeholder="Auto-derived from path"
              className="w-full h-9 px-3 bg-base-300 border border-base-content/15 rounded-xl text-base-content text-[13px] focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            />
          </div>

          {validation && (
            <div className={
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] " +
              (validation.type === "error"
                ? "bg-error/10 border-error/20 text-error"
                : validation.type === "success"
                ? "bg-success/10 border-success/20 text-success"
                : "bg-base-content/5 border-base-content/10 text-base-content/40")
            }>
              {validation.text}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-base-content/15 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-sm text-[12px]">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className={"btn btn-primary btn-sm text-[12px]" + (!canAdd ? " opacity-50 cursor-not-allowed" : "")}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : "Add Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
