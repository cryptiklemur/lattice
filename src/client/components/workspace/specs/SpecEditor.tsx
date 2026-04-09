import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Check, Trash2, X, ClipboardList, Play, Copy } from "lucide-react";
import type { Spec, SpecSection, SpecStatus, SpecPriority, SpecEffort } from "#shared";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useOnline } from "../../../hooks/useOnline";
import { SpecMarkdownEditor } from "./SpecMarkdownEditor";
import { SpecActivityTab } from "./SpecActivityTab";
import { SpecSessionsTab } from "./SpecSessionsTab";
import { DeleteSpecModal } from "./DeleteSpecModal";

type SectionKey = keyof SpecSection;

const SECTION_TABS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "summary", label: "Summary", placeholder: "Describe what this spec covers and why it matters..." },
  { key: "currentState", label: "Current State", placeholder: "What exists today? Describe the current implementation..." },
  { key: "requirements", label: "Requirements", placeholder: "What needs to change? List acceptance criteria..." },
  { key: "implementationPlan", label: "Implementation", placeholder: "How will this be built? Outline the approach..." },
  { key: "migrationMap", label: "Migration", placeholder: "What needs to be created, updated, or removed..." },
  { key: "testing", label: "Testing", placeholder: "How will this be verified? Describe the test plan..." },
  { key: "activity", label: "Activity", placeholder: "" },
  { key: "sessions", label: "Sessions", placeholder: "" },
];

const STATUS_OPTIONS: SpecStatus[] = ["draft", "in-progress", "on-hold", "completed"];
const PRIORITY_OPTIONS: SpecPriority[] = ["high", "medium", "low"];
const EFFORT_OPTIONS: SpecEffort[] = ["small", "medium", "large", "xl"];

const STATUS_LABEL: Record<string, string> = { "draft": "Draft", "in-progress": "In Progress", "on-hold": "On Hold", "completed": "Completed" };
const PRIORITY_LABEL: Record<string, string> = { "high": "High", "medium": "Medium", "low": "Low" };
const EFFORT_LABEL: Record<string, string> = { "small": "Small", "medium": "Medium", "large": "Large", "xl": "XL" };

interface SpecEditorProps {
  spec: Spec;
  onBack: () => void;
}

export function SpecEditor({ spec, onBack }: SpecEditorProps) {
  const { send } = useWebSocket();
  const online = useOnline();

  const [title, setTitle] = useState(spec.title);
  const [tagline, setTagline] = useState(spec.tagline);
  const [status, setStatus] = useState(spec.status);
  const [priority, setPriority] = useState(spec.priority);
  const [effort, setEffort] = useState(spec.estimatedEffort);
  const [author, setAuthor] = useState(spec.author);
  const [tags, setTags] = useState(spec.tags);
  const [sections, setSections] = useState(spec.sections);
  const [activeTab, setActiveTab] = useState("summary");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [idCopied, setIdCopied] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSectionRef = useRef<SpecSection | null>(null);
  const specIdRef = useRef(spec.id);
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

  const flushPending = useCallback(function () {
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
    const updated = { ...sections, [key]: content };
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
      const newTags = [...tags, tagInput.trim()];
      setTags(newTags);
      setTagInput("");
      sendMetadata({ tags: newTags });
    }
  }

  function handleRemoveTag(index: number) {
    const newTags = tags.filter(function (_, i) { return i !== index; });
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

  function handleCopyId() {
    navigator.clipboard.writeText(spec.id);
    setIdCopied(true);
    setTimeout(function () { setIdCopied(false); }, 1500);
  }

  const isSectionTab = activeTab !== "activity" && activeTab !== "sessions";

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-base-content/15 flex-shrink-0 bg-base-200">
        <button
          type="button"
          onClick={handleBack}
          className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          aria-label="Back to specs"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="flex items-center gap-1.5 ml-auto text-[11px] text-base-content/30 font-mono" aria-live="polite" aria-atomic="true">
          {saveState === "saving" && (
            <>
              <Loader2 size={11} className="animate-spin motion-reduce:animate-none" />
              <span>Saving</span>
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check size={11} className="text-success" />
              <span>Saved</span>
            </>
          )}
        </div>

        <div className="tooltip tooltip-bottom" data-tip={!spec.sections.summary || !spec.sections.requirements ? "Fill in Summary and Requirements first" : "Start a plan session"}>
          <button
            type="button"
            onClick={function () {
              send({ type: "specs:start-plan", specId: spec.id, projectSlug: spec.projectSlug } as any);
            }}
            disabled={!online || !spec.sections.summary || !spec.sections.requirements}
            className="btn btn-xs btn-ghost gap-1.5 text-base-content/50 hover:text-base-content disabled:text-base-content/20"
            aria-label="Write Plan"
          >
            <ClipboardList size={12} />
            <span className="hidden sm:inline text-[11px] font-mono">Write Plan</span>
          </button>
        </div>

        <div className="tooltip tooltip-bottom" data-tip={!spec.sections.implementationPlan ? "Write an Implementation Plan first" : "Start an execution session"}>
          <button
            type="button"
            onClick={function () {
              send({ type: "specs:start-execute", specId: spec.id, projectSlug: spec.projectSlug } as any);
            }}
            disabled={!online || !spec.sections.implementationPlan}
            className="btn btn-xs btn-ghost gap-1.5 text-base-content/50 hover:text-base-content disabled:text-base-content/20"
            aria-label="Execute Plan"
          >
            <Play size={12} />
            <span className="hidden sm:inline text-[11px] font-mono">Execute</span>
          </button>
        </div>

        <button
          type="button"
          onClick={function () { setShowDeleteModal(true); }}
          disabled={!online}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error hover:bg-error/10 disabled:opacity-30"
          aria-label="Delete spec"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-1">
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
            className="w-full bg-transparent text-[13px] text-base-content/40 placeholder:text-base-content/20 outline-none border-none mt-1"
          />
          <button
            type="button"
            onClick={handleCopyId}
            className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-base-content/20 hover:text-base-content/40 transition-colors duration-[120ms]"
            title="Copy spec ID"
          >
            {idCopied ? <Check size={9} className="text-success" /> : <Copy size={9} />}
            {spec.id}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 px-5 py-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="spec-status" className="text-[10px] font-mono font-semibold text-base-content/30 uppercase tracking-wider">Status</label>
            <select
              id="spec-status"
              value={status}
              onChange={function (e) { handleStatusChange(e.target.value as SpecStatus); }}
              disabled={!online}
              className="h-8 px-3 bg-base-300 border border-base-content/15 rounded-xl text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            >
              {STATUS_OPTIONS.map(function (s) {
                return <option key={s} value={s}>{STATUS_LABEL[s]}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="spec-priority" className="text-[10px] font-mono font-semibold text-base-content/30 uppercase tracking-wider">Priority</label>
            <select
              id="spec-priority"
              value={priority}
              onChange={function (e) { handlePriorityChange(e.target.value as SpecPriority); }}
              disabled={!online}
              className="h-8 px-3 bg-base-300 border border-base-content/15 rounded-xl text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            >
              {PRIORITY_OPTIONS.map(function (p) {
                return <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="spec-effort" className="text-[10px] font-mono font-semibold text-base-content/30 uppercase tracking-wider">Effort</label>
            <select
              id="spec-effort"
              value={effort}
              onChange={function (e) { handleEffortChange(e.target.value as SpecEffort); }}
              disabled={!online}
              className="h-8 px-3 bg-base-300 border border-base-content/15 rounded-xl text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            >
              {EFFORT_OPTIONS.map(function (e) {
                return <option key={e} value={e}>{EFFORT_LABEL[e]}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 lg:col-span-2">
            <label htmlFor="spec-author" className="text-[10px] font-mono font-semibold text-base-content/30 uppercase tracking-wider">Author</label>
            <input
              id="spec-author"
              type="text"
              value={author}
              onChange={function (e) { setAuthor(e.target.value); }}
              onBlur={handleAuthorBlur}
              disabled={!online}
              placeholder="Author"
              className="h-8 px-3 bg-base-300 border border-base-content/15 rounded-xl text-[12px] text-base-content font-mono focus:border-primary focus-visible:outline-none transition-colors duration-[120ms]"
            />
          </div>
        </div>

        {(tags.length > 0 || online) && (
          <div className="flex items-center gap-1.5 px-5 pb-3 flex-wrap">
            {tags.map(function (tag, i) {
              return (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-base-content/8 text-[11px] font-mono text-base-content/50">
                  {tag}
                  <button
                    type="button"
                    onClick={function () { handleRemoveTag(i); }}
                    disabled={!online}
                    className="text-base-content/30 hover:text-base-content transition-colors duration-[120ms]"
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
              placeholder="+ tag"
              aria-label="Add tag"
              className="bg-transparent text-[11px] font-mono text-base-content/50 placeholder:text-base-content/20 outline-none border-none w-16"
            />
          </div>
        )}

        <div className="border-b border-base-content/15 overflow-x-auto flex-shrink-0" role="tablist">
          <div className="flex px-5 gap-0">
            {SECTION_TABS.map(function (tab) {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  id={"spec-tab-" + tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="spec-tabpanel"
                  onClick={function () { setActiveTab(tab.key); }}
                  className={
                    "px-3 py-2.5 text-[11px] font-mono truncate border-b-2 transition-colors duration-[120ms] " +
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

        <div id="spec-tabpanel" role="tabpanel" aria-labelledby={"spec-tab-" + activeTab} className="p-5">
          {isSectionTab && (
            <SpecMarkdownEditor
              content={sections[activeTab as SectionKey]}
              onChange={function (content) { handleSectionChange(activeTab as SectionKey, content); }}
              placeholder={SECTION_TABS.find(function (t) { return t.key === activeTab; })?.placeholder || "Write something..."}
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
        <DeleteSpecModal
          title={spec.title}
          onCancel={function () { setShowDeleteModal(false); }}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
