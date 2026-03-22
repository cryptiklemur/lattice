import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, X, Loader2, Brain, ExternalLink } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage } from "@lattice/shared";

interface MemoryEntry {
  filename: string;
  name: string;
  description: string;
  type: string;
}

interface ProjectMemoryProps {
  projectSlug?: string;
}

var MEMORY_TYPES = ["user", "feedback", "project", "reference"];

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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "memory";
}

function buildContent(name: string, description: string, type: string, body: string): string {
  return "---\nname: " + name + "\ndescription: " + description + "\ntype: " + type + "\n---\n" + body;
}

function MemoryCard({
  memory,
  onClick,
  onDelete,
}: {
  memory: MemoryEntry;
  onClick: () => void;
  onDelete: () => void;
}) {
  var [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl transition-colors duration-[120ms] cursor-pointer hover:border-base-content/30 hover:bg-base-300/80"
      role="button"
      tabIndex={0}
      onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    >
      <Brain size={14} className="text-base-content/25 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-base-content truncate">{memory.name || memory.filename}</span>
          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
            {memory.type}
          </span>
        </div>
        {memory.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-2">{memory.description}</div>
        )}
      </div>
      <div className="flex gap-1 flex-shrink-0 mt-0.5" onClick={function (e) { e.stopPropagation(); }}>
        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={function () { onDelete(); setConfirmDelete(false); }}
              className="btn btn-error btn-xs"
            >
              Delete
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
            aria-label={"Delete " + memory.name}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function MemoryViewModal({
  memory,
  content,
  onClose,
  onEdit,
}: {
  memory: MemoryEntry;
  content: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  var parsed = parseFrontmatter(content);
  var hasMeta = Object.keys(parsed.meta).length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Brain size={16} className="text-primary flex-shrink-0" />
            <h2 className="text-[15px] font-mono font-bold text-base-content truncate">
              {parsed.meta.name || memory.filename}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
            >
              <X size={16} />
            </button>
          </div>
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
          <div className="text-[11px] font-mono text-base-content/30 truncate">{memory.filename}</div>
        </div>
      </div>
    </div>
  );
}

function MemoryEditModal({
  memory,
  initialContent,
  onClose,
  onSave,
  isSaving,
}: {
  memory: MemoryEntry | null;
  initialContent: string;
  onClose: () => void;
  onSave: (filename: string, content: string) => void;
  isSaving: boolean;
}) {
  var isNew = memory === null;
  var parsed = parseFrontmatter(initialContent);

  var [name, setName] = useState(parsed.meta.name || (memory ? memory.name : ""));
  var [description, setDescription] = useState(parsed.meta.description || (memory ? memory.description : ""));
  var [type, setType] = useState(parsed.meta.type || (memory ? memory.type : "project"));
  var [body, setBody] = useState(parsed.body);

  function handleSave() {
    var content = buildContent(name, description, type, body);
    var filename = isNew ? slugify(name) + ".md" : memory!.filename;
    onSave(filename, content);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-primary flex-shrink-0" />
            <h2 className="text-[15px] font-mono font-bold text-base-content">
              {isNew ? "New Memory" : "Edit Memory"}
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

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5 block">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={function (e) { setName(e.target.value); }}
                className="input input-sm w-full bg-base-300 border-base-content/15 text-[13px]"
                placeholder="Memory name"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5 block">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={function (e) { setDescription(e.target.value); }}
                className="input input-sm w-full bg-base-300 border-base-content/15 text-[13px]"
                placeholder="Brief description"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5 block">
                Type
              </label>
              <select
                value={type}
                onChange={function (e) { setType(e.target.value); }}
                className="select select-sm w-full bg-base-300 border-base-content/15 text-[13px]"
              >
                {MEMORY_TYPES.map(function (t) {
                  return <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>;
                })}
              </select>
            </div>

            {!isNew && (
              <div>
                <label className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5 block">
                  Filename
                </label>
                <input
                  type="text"
                  value={memory!.filename}
                  readOnly
                  className="input input-sm w-full bg-base-100/50 border-base-content/10 text-[13px] text-base-content/40 cursor-not-allowed"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono text-base-content/40 uppercase tracking-wider mb-1.5 block">
              Content
            </label>
            <textarea
              value={body}
              onChange={function (e) { setBody(e.target.value); }}
              className="textarea w-full bg-base-300 border-base-content/15 text-[13px] font-mono resize-none min-h-[200px]"
              placeholder="Memory content (markdown supported)"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-base-content/15 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="btn btn-primary btn-sm gap-1.5"
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectMemory({ projectSlug }: ProjectMemoryProps) {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [memories, setMemories] = useState<MemoryEntry[]>([]);
  var [loading, setLoading] = useState(false);
  var [viewState, setViewState] = useState<{ memory: MemoryEntry; content: string } | null>(null);
  var [editState, setEditState] = useState<{ memory: MemoryEntry | null; content: string } | null>(null);
  var [isSaving, setIsSaving] = useState(false);
  var [pendingView, setPendingView] = useState<MemoryEntry | null>(null);

  useEffect(function () {
    function handleListResult(msg: ServerMessage) {
      if (msg.type !== "memory:list_result") return;
      var data = msg as { type: "memory:list_result"; memories: MemoryEntry[] };
      setMemories(data.memories);
      setLoading(false);
    }

    function handleViewResult(msg: ServerMessage) {
      if (msg.type !== "memory:view_result") return;
      var data = msg as { type: "memory:view_result"; content: string };
      setPendingView(function (prev) {
        if (prev) {
          setViewState({ memory: prev, content: data.content });
        }
        return null;
      });
    }

    function handleSaveResult(msg: ServerMessage) {
      if (msg.type !== "memory:save_result") return;
      setIsSaving(false);
      setEditState(null);
      setViewState(null);
    }

    function handleDeleteResult(msg: ServerMessage) {
      if (msg.type !== "memory:delete_result") return;
    }

    subscribe("memory:list_result", handleListResult);
    subscribe("memory:view_result", handleViewResult);
    subscribe("memory:save_result", handleSaveResult);
    subscribe("memory:delete_result", handleDeleteResult);

    return function () {
      unsubscribe("memory:list_result", handleListResult);
      unsubscribe("memory:view_result", handleViewResult);
      unsubscribe("memory:save_result", handleSaveResult);
      unsubscribe("memory:delete_result", handleDeleteResult);
    };
  }, []);

  useEffect(function () {
    if (!projectSlug) return;
    setLoading(true);
    send({ type: "memory:list", projectSlug } as any);
  }, [projectSlug]);

  function handleView(memory: MemoryEntry) {
    setPendingView(memory);
    send({ type: "memory:view", projectSlug, filename: memory.filename } as any);
  }

  function handleDelete(memory: MemoryEntry) {
    send({ type: "memory:delete", projectSlug, filename: memory.filename } as any);
  }

  function handleSave(filename: string, content: string) {
    setIsSaving(true);
    send({ type: "memory:save", projectSlug, filename, content } as any);
  }

  function handleEditFromView() {
    if (!viewState) return;
    setEditState({ memory: viewState.memory, content: viewState.content });
    setViewState(null);
  }

  var grouped: Record<string, MemoryEntry[]> = {};
  for (var i = 0; i < memories.length; i++) {
    var m = memories[i];
    var t = m.type || "other";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(m);
  }

  var groupKeys = Object.keys(grouped);

  return (
    <div className="py-2 space-y-6">
      <a
        href="https://docs.anthropic.com/en/docs/claude-code/memory"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-base-content/30 hover:text-primary/70 flex items-center gap-1 transition-colors"
      >
        <ExternalLink size={11} />
        Claude Code docs
      </a>
      <div className="flex items-center justify-end">
        <button
          onClick={function () { setEditState({ memory: null, content: "" }); }}
          className="btn btn-primary btn-sm gap-1.5"
        >
          <Plus size={13} />
          New Memory
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={18} className="animate-spin text-base-content/30" />
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="py-12 text-center text-[13px] text-base-content/40">
          No memories found.
        </div>
      )}

      {!loading && groupKeys.map(function (groupKey) {
        return (
          <div key={groupKey}>
            <div className="text-[12px] font-semibold text-base-content/40 mb-2">
              {groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}
            </div>
            <div className="space-y-2">
              {grouped[groupKey].map(function (memory) {
                return (
                  <MemoryCard
                    key={memory.filename}
                    memory={memory}
                    onClick={function () { handleView(memory); }}
                    onDelete={function () { handleDelete(memory); }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {viewState && (
        <MemoryViewModal
          memory={viewState.memory}
          content={viewState.content}
          onClose={function () { setViewState(null); }}
          onEdit={handleEditFromView}
        />
      )}

      {editState !== null && (
        <MemoryEditModal
          memory={editState.memory}
          initialContent={editState.content}
          onClose={function () { setEditState(null); }}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
