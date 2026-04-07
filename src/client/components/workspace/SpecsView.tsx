import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, List, LayoutGrid } from "lucide-react";
import type { Spec, SpecStatus, ServerMessage } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { useOnline } from "../../hooks/useOnline";
import { SpecEditor } from "./specs/SpecEditor";
import { SpecListView } from "./specs/SpecListView";
import { SpecBoardView } from "./specs/SpecBoardView";

type ViewMode = "list" | "board";

function getPersistedViewMode(): ViewMode {
  try {
    var stored = localStorage.getItem("lattice:specs:viewMode");
    if (stored === "list" || stored === "board") return stored;
  } catch {}
  return "list";
}

export function SpecsView() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var { activeProjectSlug } = useSidebar();
  var online = useOnline();
  var [specs, setSpecs] = useState<Spec[]>([]);
  var [loading, setLoading] = useState(true);
  var [viewMode, setViewMode] = useState<ViewMode>(getPersistedViewMode);
  var [statusFilter, setStatusFilter] = useState<SpecStatus | "all">("in-progress");
  var [editingSpecId, setEditingSpecId] = useState<string | null>(null);

  var handleMessage = useCallback(function (msg: ServerMessage) {
    if (msg.type === "specs:list_result") {
      setSpecs(msg.specs);
      setLoading(false);
      return;
    }
    if (msg.type === "specs:created") {
      setSpecs(function (prev) { return [...prev, msg.spec]; });
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

  function handleSelectSpec(spec: Spec) {
    setEditingSpecId(spec.id);
  }

  var editingSpec = editingSpecId ? specs.find(function (s) { return s.id === editingSpecId; }) : null;

  if (editingSpec) {
    return (
      <SpecEditor
        spec={editingSpec}
        onBack={function () { setEditingSpecId(null); }}
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
          <button
            type="button"
            onClick={handleCreate}
            disabled={!online}
            className="btn btn-primary btn-xs gap-1"
          >
            <Plus size={12} />
            New Spec
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex flex-col gap-3 mt-2">
            <div className="h-12 bg-base-content/10 animate-pulse rounded" />
            <div className="h-12 bg-base-content/10 animate-pulse rounded" />
            <div className="h-12 bg-base-content/10 animate-pulse rounded" />
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
          <SpecListView specs={specs} onSelectSpec={handleSelectSpec} filter={statusFilter} onFilterChange={setStatusFilter} />
        ) : (
          <SpecBoardView specs={specs} onSelectSpec={handleSelectSpec} onStatusChange={function (specId: string, status: SpecStatus) {
            send({ type: "specs:update", id: specId, status: status });
          }} />
        )}
      </div>
    </div>
  );
}
