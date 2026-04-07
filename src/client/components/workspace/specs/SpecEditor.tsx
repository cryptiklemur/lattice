import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Check, Trash2, X, Plus } from "lucide-react";
import type { Spec, SpecSection, SpecStatus, SpecPriority, SpecEffort } from "#shared";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useOnline } from "../../../hooks/useOnline";
import { SpecRichEditor } from "./SpecRichEditor";
import { SpecActivityTab } from "./SpecActivityTab";
import { SpecSessionsTab } from "./SpecSessionsTab";
import { STATUS_DOT } from "./SpecCard";

type SectionKey = keyof SpecSection;

var SECTION_TABS: Array<{ key: string; label: string }> = [
  { key: "summary", label: "Summary" },
  { key: "currentState", label: "Current State" },
  { key: "requirements", label: "Requirements" },
  { key: "implementationPlan", label: "Implementation" },
  { key: "migrationMap", label: "Migration" },
  { key: "testing", label: "Testing" },
  { key: "activity", label: "Activity" },
  { key: "sessions", label: "Sessions" },
];

var STATUS_OPTIONS: SpecStatus[] = ["draft", "in-progress", "on-hold", "completed"];
var PRIORITY_OPTIONS: SpecPriority[] = ["high", "medium", "low"];
var EFFORT_OPTIONS: SpecEffort[] = ["small", "medium", "large", "xl"];

interface SpecEditorProps {
  spec: Spec;
  onBack: () => void;
}

export function SpecEditor({ spec, onBack }: SpecEditorProps) {
  var { send } = useWebSocket();
  var online = useOnline();

  var [title, setTitle] = useState(spec.title);
  var [tagline, setTagline] = useState(spec.tagline);
  var [status, setStatus] = useState(spec.status);
  var [priority, setPriority] = useState(spec.priority);
  var [effort, setEffort] = useState(spec.estimatedEffort);
  var [author, setAuthor] = useState(spec.author);
  var [tags, setTags] = useState(spec.tags);
  var [sections, setSections] = useState(spec.sections);
  var [activeTab, setActiveTab] = useState("summary");
  var [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  var [showDeleteModal, setShowDeleteModal] = useState(false);
  var [tagInput, setTagInput] = useState("");

  var debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  var pendingSectionRef = useRef<SpecSection | null>(null);
  var specIdRef = useRef(spec.id);
  specIdRef.current = spec.id;

  useEffect(function () {
    setTitle(spec.title);
    setTagline(spec.tagline);
    setStatus(spec.status);
    setPriority(spec.priority);
    setEffort(spec.estimatedEffort);
    setAuthor(spec.author);
    setTags(spec.tags);
    setSections(spec.sections);
  }, [spec.id]);

  var flushPending = useCallback(function () {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (pendingSectionRef.current) {
      send({ type: "specs:update", id: specIdRef.current, sections: pendingSectionRef.current });
      pendingSectionRef.current = null;
    }
  }, [send]);

  useEffect(function () {
    return function () {
      flushPending();
    };
  }, [flushPending]);

  function handleSectionChange(key: SectionKey, content: string) {
    var updated = { ...sections, [key]: content };
    setSections(updated);
    pendingSectionRef.current = updated;
    setSaveState("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function () {
      send({ type: "specs:update", id: specIdRef.current, sections: pendingSectionRef.current! });
      pendingSectionRef.current = null;
      setSaveState("saved");
      setTimeout(function () { setSaveState("idle"); }, 1500);
    }, 800);
  }

  function sendMetadata(patch: Record<string, unknown>) {
    send({ type: "specs:update", id: spec.id, ...patch } as never);
    setSaveState("saved");
    setTimeout(function () { setSaveState("idle"); }, 1500);
  }

  function handleTitleBlur() {
    if (title !== spec.title) sendMetadata({ title });
  }

  function handleTaglineBlur() {
    if (tagline !== spec.tagline) sendMetadata({ tagline });
  }

  function handleStatusChange(val: SpecStatus) {
    setStatus(val);
    sendMetadata({ status: val });
  }

  function handlePriorityChange(val: SpecPriority) {
    setPriority(val);
    sendMetadata({ priority: val });
  }

  function handleEffortChange(val: SpecEffort) {
    setEffort(val);
    sendMetadata({ estimatedEffort: val });
  }

  function handleAuthorBlur() {
    if (author !== spec.author) sendMetadata({ author });
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      var newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setTagInput("");
      sendMetadata({ tags: newTags });
    }
  }

  function handleRemoveTag(index: number) {
    var newTags = tags.filter(function (_, i) { return i !== index; });
    setTags(newTags);
    sendMetadata({ tags: newTags });
  }

  function handleBack() {
    flushPending();
    onBack();
  }

  function handleDelete() {
    send({ type: "specs:delete", id: spec.id });
    onBack();
  }

  function handleUnlinkSession(sessionId: string) {
    send({ type: "specs:unlink-session", id: spec.id, sessionId });
  }

  var isSectionTab = activeTab !== "activity" && activeTab !== "sessions";

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-content/15 flex-shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="p-1 rounded text-base-content/40 hover:text-base-content hover:bg-base-content/5 transition-colors"
          aria-label="Back to specs"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 ml-auto text-[11px] text-base-content/30 font-mono">
          {saveState === "saving" && (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check size={12} className="text-success" />
              <span>Saved</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={function () { setShowDeleteModal(true); }}
          disabled={!online}
          className="p-1 rounded text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30"
          aria-label="Delete spec"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <input
            type="text"
            value={title}
            onChange={function (e) { setTitle(e.target.value); }}
            onBlur={handleTitleBlur}
            disabled={!online}
            placeholder="Untitled spec"
            className="w-full bg-transparent text-[17px] font-mono font-bold text-base-content placeholder:text-base-content/20 outline-none border-none"
          />
          <input
            type="text"
            value={tagline}
            onChange={function (e) { setTagline(e.target.value); }}
            onBlur={handleTaglineBlur}
            disabled={!online}
            placeholder="Add a tagline..."
            className="w-full bg-transparent text-[13px] text-base-content/40 placeholder:text-base-content/20 outline-none border-none mt-0.5"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 py-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-base-content/30 font-mono uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={function (e) { handleStatusChange(e.target.value as SpecStatus); }}
              disabled={!online}
              className="h-7 px-2 bg-base-200 border border-base-content/10 rounded text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors"
            >
              {STATUS_OPTIONS.map(function (s) {
                return <option key={s} value={s}>{s}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-base-content/30 font-mono uppercase tracking-wider">Priority</label>
            <select
              value={priority}
              onChange={function (e) { handlePriorityChange(e.target.value as SpecPriority); }}
              disabled={!online}
              className="h-7 px-2 bg-base-200 border border-base-content/10 rounded text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors"
            >
              {PRIORITY_OPTIONS.map(function (p) {
                return <option key={p} value={p}>{p}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-base-content/30 font-mono uppercase tracking-wider">Effort</label>
            <select
              value={effort}
              onChange={function (e) { handleEffortChange(e.target.value as SpecEffort); }}
              disabled={!online}
              className="h-7 px-2 bg-base-200 border border-base-content/10 rounded text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors"
            >
              {EFFORT_OPTIONS.map(function (e) {
                return <option key={e} value={e}>{e}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-base-content/30 font-mono uppercase tracking-wider">Author</label>
            <input
              type="text"
              value={author}
              onChange={function (e) { setAuthor(e.target.value); }}
              onBlur={handleAuthorBlur}
              disabled={!online}
              placeholder="Author"
              className="h-7 px-2 bg-base-200 border border-base-content/10 rounded text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 py-2 flex-wrap">
          {tags.map(function (tag, i) {
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base-content/10 text-[11px] font-mono text-base-content/60">
                {tag}
                <button
                  type="button"
                  onClick={function () { handleRemoveTag(i); }}
                  disabled={!online}
                  className="text-base-content/30 hover:text-base-content transition-colors"
                  aria-label={"Remove tag " + tag}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
          <input
            type="text"
            value={tagInput}
            onChange={function (e) { setTagInput(e.target.value); }}
            onKeyDown={handleAddTag}
            disabled={!online}
            placeholder="Add tag..."
            className="bg-transparent text-[11px] text-base-content/60 placeholder:text-base-content/20 outline-none border-none w-20"
          />
        </div>

        <div className="border-b border-base-content/10 overflow-x-auto flex-shrink-0" role="tablist">
          <div className="flex px-4 gap-0">
            {SECTION_TABS.map(function (tab) {
              var isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={function () { setActiveTab(tab.key); }}
                  className={
                    "px-3 py-2 text-[11px] font-mono whitespace-nowrap border-b-2 transition-colors " +
                    (isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-base-content/40 hover:text-base-content/70")
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3">
          {isSectionTab && (
            <SpecRichEditor
              content={sections[activeTab as SectionKey]}
              onChange={function (content) { handleSectionChange(activeTab as SectionKey, content); }}
              placeholder={"Write " + activeTab + " details..."}
              disabled={!online}
            />
          )}
          {activeTab === "activity" && (
            <SpecActivityTab activity={spec.activity} />
          )}
          {activeTab === "sessions" && (
            <SpecSessionsTab
              linkedSessions={spec.linkedSessions}
              onUnlink={handleUnlinkSession}
              disabled={!online}
            />
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-base-300 border border-base-content/15 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-[15px] font-mono font-bold text-base-content mb-2">Delete spec?</h3>
            <p className="text-[13px] text-base-content/60 mb-4">
              This will permanently delete "{spec.title || "Untitled"}". This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={function () { setShowDeleteModal(false); }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-error btn-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
