import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Plus, List, LayoutGrid, ChevronDown, Sparkles } from "lucide-react";
import type { Spec, SpecStatus, ServerMessage } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { useOnline } from "../../hooks/useOnline";
import { useSession } from "../../hooks/useSession";
import { openSessionTab, getPendingSpecId, clearPendingSpecId, setSpecIdOnTab, getWorkspaceStore } from "../../stores/workspace";
import { useStore } from "@tanstack/react-store";
import { setPendingSystemPrompt, setPendingAutoSend, setSpecContext } from "../../stores/session";
import { SpecEditor } from "./specs/SpecEditor";
import { SpecListView } from "./specs/SpecListView";
import { SpecBoardView } from "./specs/SpecBoardView";

type ViewMode = "list" | "board";

function getPersistedViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem("lattice:specs:viewMode");
    if (stored === "list" || stored === "board") return stored;
  } catch {}
  return "list";
}

export function SpecsView() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const { activeProjectSlug } = useSidebar();
  const online = useOnline();
  const session = useSession();
  const urlSpecId = useStore(getWorkspaceStore(), function (s) {
    const specsTab = s.tabs.find(function (t) { return t.type === "specs"; });
    return specsTab?.specId || null;
  });
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(getPersistedViewMode);
  const [statusFilter, setStatusFilter] = useState<SpecStatus | "all">("in-progress");
  const [editingSpecId, setEditingSpecId] = useState<string | null>(urlSpecId);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [superpowersInstalled, setSuperpowersInstalled] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const handleMessage = useCallback(function (msg: ServerMessage) {
    if (msg.type === "specs:list_result") {
      setSpecs(msg.specs);
      setLoading(false);
      const pending = getPendingSpecId();
      if (pending) {
        const match = msg.specs.find(function (s: Spec) { return s.id === pending; });
        if (match) {
          setEditingSpecId(pending);
        }
        clearPendingSpecId();
      }
      return;
    }
    if (msg.type === "specs:created") {
      setSpecs(function (prev) {
        if (prev.some(function (s) { return s.id === msg.spec.id; })) return prev;
        return [...prev, msg.spec];
      });
      return;
    }
    if (msg.type === "specs:updated" || msg.type === "specs:session_linked" || msg.type === "specs:session_unlinked" || msg.type === "specs:activity_added") {
      setSpecs(function (prev) {
        return prev.map(function (s) { return s.id === msg.spec.id ? msg.spec : s; });
      });
      return;
    }
    if (msg.type === "specs:deleted") {
      setSpecs(function (prev) { return prev.filter(function (s) { return s.id !== msg.id; }); });
      if (editingSpecId === msg.id) {
        setEditingSpecId(null);
      }
      return;
    }
  }, [editingSpecId]);

  useEffect(function () {
    setLoading(true);
    subscribe("specs:list_result", handleMessage);
    subscribe("specs:created", handleMessage);
    subscribe("specs:updated", handleMessage);
    subscribe("specs:deleted", handleMessage);
    subscribe("specs:session_linked", handleMessage);
    subscribe("specs:session_unlinked", handleMessage);
    subscribe("specs:activity_added", handleMessage);
    send({ type: "specs:list", projectSlug: activeProjectSlug ?? undefined });
    return function () {
      unsubscribe("specs:list_result", handleMessage);
      unsubscribe("specs:created", handleMessage);
      unsubscribe("specs:updated", handleMessage);
      unsubscribe("specs:deleted", handleMessage);
      unsubscribe("specs:session_linked", handleMessage);
      unsubscribe("specs:session_unlinked", handleMessage);
      unsubscribe("specs:activity_added", handleMessage);
    };
  }, [send, subscribe, unsubscribe, handleMessage, activeProjectSlug]);

  useEffect(function () {
    function handleSuperpowersStatus(msg: ServerMessage) {
      if (msg.type === "superpowers:status") {
        setSuperpowersInstalled((msg as any).installed);
      }
    }
    subscribe("superpowers:status", handleSuperpowersStatus);
    send({ type: "superpowers:status_request" } as any);
    return function () {
      unsubscribe("superpowers:status", handleSuperpowersStatus);
    };
  }, [send, subscribe, unsubscribe]);

  useEffect(function () {
    function handleBrainstormStarted(msg: ServerMessage) {
      if ((msg as any).type === "specs:brainstorm-started") {
        const data = msg as any;
        setPendingSystemPrompt(data.systemPrompt);
        openSessionTab(data.sessionId, activeProjectSlug ?? "", "Brainstorm", "brainstorm");
        session.activateSession(activeProjectSlug ?? "", data.sessionId);
      }
    }
    function handlePlanStarted(msg: ServerMessage) {
      if ((msg as any).type === "specs:plan-started") {
        const data = msg as any;
        const specTitle = data.spec?.title || "Spec";
        setPendingSystemPrompt(data.systemPrompt);
        setPendingAutoSend("Write the implementation plan.");
        setSpecContext({ specId: data.spec?.id, specTitle });
        openSessionTab(data.sessionId, activeProjectSlug ?? "", "Plan: " + specTitle, "write-plan");
        session.activateSession(activeProjectSlug ?? "", data.sessionId);
      }
    }
    function handleExecuteStarted(msg: ServerMessage) {
      if ((msg as any).type === "specs:execute-started") {
        const data = msg as any;
        const specTitle = data.spec?.title || "Spec";
        setPendingSystemPrompt(data.systemPrompt);
        setPendingAutoSend("Execute the implementation plan.");
        setSpecContext({ specId: data.spec?.id, specTitle });
        openSessionTab(data.sessionId, activeProjectSlug ?? "", "Execute: " + specTitle, "execute");
        session.activateSession(activeProjectSlug ?? "", data.sessionId);
      }
    }
    subscribe("specs:brainstorm-started", handleBrainstormStarted);
    subscribe("specs:plan-started", handlePlanStarted);
    subscribe("specs:execute-started", handleExecuteStarted);
    return function () {
      unsubscribe("specs:brainstorm-started", handleBrainstormStarted);
      unsubscribe("specs:plan-started", handlePlanStarted);
      unsubscribe("specs:execute-started", handleExecuteStarted);
    };
  }, [subscribe, unsubscribe, activeProjectSlug, session]);

  useEffect(function () {
    if (loading) return;
    const pending = getPendingSpecId();
    if (pending) {
      const match = specs.find(function (s) { return s.id === pending; });
      if (match) {
        setEditingSpecId(pending);
      }
      clearPendingSpecId();
    }
  });

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return function () { document.removeEventListener("mousedown", handleClickOutside); };
  }, []);

  function handleChangeViewMode(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem("lattice:specs:viewMode", mode);
    } catch {}
  }

  function handleCreate() {
    send({
      type: "specs:create",
      projectSlug: activeProjectSlug ?? "",
      title: "Untitled Spec",
    });
  }

  function handleCreateWithBrainstorm() {
    send({ type: "specs:create-with-brainstorm", projectSlug: activeProjectSlug ?? "" } as any);
  }

  function handleSelectSpec(spec: Spec) {
    setEditingSpecId(spec.id);
    setSpecIdOnTab(spec.id);
  }

  const editingSpec = editingSpecId ? specs.find(function (s) { return s.id === editingSpecId; }) : null;

  if (editingSpec) {
    return (
      <SpecEditor
        spec={editingSpec}
        onBack={function () { setEditingSpecId(null); setSpecIdOnTab(null); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-base-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/15 flex-shrink-0">
        <span className="text-[13px] font-semibold text-base-content">Specs</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-base-200 rounded-lg p-0.5">
            <button
              type="button"
              onClick={function () { handleChangeViewMode("list"); }}
              className={
                "p-1 rounded transition-colors " +
                (viewMode === "list"
                  ? "bg-base-300 text-base-content"
                  : "text-base-content/30 hover:text-base-content/60")
              }
              aria-label="List view"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={function () { handleChangeViewMode("board"); }}
              className={
                "p-1 rounded transition-colors " +
                (viewMode === "board"
                  ? "bg-base-300 text-base-content"
                  : "text-base-content/30 hover:text-base-content/60")
              }
              aria-label="Board view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              onClick={function () { setShowNewMenu(!showNewMenu); }}
              disabled={!online}
              className="btn btn-primary btn-xs gap-1"
            >
              <Plus size={12} />
              New Spec
              <ChevronDown size={10} />
            </button>
            {showNewMenu && (
              <div className="absolute right-0 top-full mt-1 bg-base-200 border border-base-content/15 rounded-lg shadow-lg z-50 min-w-[220px] py-1">
                <button
                  type="button"
                  onClick={function () {
                    setShowNewMenu(false);
                    handleCreateWithBrainstorm();
                  }}
                  disabled={!superpowersInstalled}
                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-base-content/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-start gap-2"
                >
                  <Sparkles size={14} className="text-warning mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-medium text-base-content">Brainstorm with AI</span>
                    {superpowersInstalled ? (
                      <span className="text-[10px] text-base-content/40">AI-guided brainstorm into a structured spec</span>
                    ) : (
                      <span className="text-[10px] text-warning/70">Requires: claude plugins install superpowers</span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={function () {
                    setShowNewMenu(false);
                    handleCreate();
                  }}
                  className="w-full text-left px-3 py-2 text-[12px] hover:bg-base-content/5 transition-colors flex items-start gap-2"
                >
                  <ClipboardList size={14} className="text-base-content/40 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-medium text-base-content">Blank Spec</span>
                    <span className="text-[10px] text-base-content/40">Create an empty spec manually</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex flex-col gap-3 mt-2">
            <div className="h-12 bg-base-content/10 animate-pulse motion-reduce:animate-none rounded" />
            <div className="h-12 bg-base-content/10 animate-pulse motion-reduce:animate-none rounded" />
            <div className="h-12 bg-base-content/10 animate-pulse motion-reduce:animate-none rounded" />
          </div>
        ) : specs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center mt-16 gap-3">
            <ClipboardList size={28} className="text-base-content/15" />
            <div>
              <div className="text-[13px] text-base-content/40">No specs yet</div>
              <div className="text-[11px] text-base-content/30 mt-1">
                Track features, bugs, and tasks with detailed specs.
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!online}
              className="btn btn-primary btn-sm mt-2"
            >
              Create your first spec
            </button>
          </div>
        ) : viewMode === "list" ? (
          <SpecListView
            specs={specs}
            onSelectSpec={handleSelectSpec}
            onUpdateSpec={function (id, updates) { send({ type: "specs:update", id, ...updates } as any); }}
            onDeleteSpec={function (id) { send({ type: "specs:delete", id } as any); }}
            filter={statusFilter}
            onFilterChange={setStatusFilter}
          />
        ) : (
          <SpecBoardView specs={specs} onSelectSpec={handleSelectSpec} onStatusChange={function (specId: string, status: SpecStatus) {
            send({ type: "specs:update", id: specId, status: status });
          }} />
        )}
      </div>
    </div>
  );
}
