import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Spec, SpecStatus, ServerMessage } from "#shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import { openSpecById } from "../../stores/workspace";
import { getSidebarStore } from "../../stores/sidebar";
import { STATUS_DOT, PRIORITY_COLOR, STATUS_LABELS, PRIORITY_LABELS } from "../workspace/specs/spec-constants";

const STATUS_ABBREV: Record<SpecStatus, string> = {
  "draft": "DFT",
  "in-progress": "WIP",
  "on-hold": "HOLD",
  "completed": "DONE",
};

export function SpecsSidebarWidget() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const { activeProjectSlug } = useSidebar();
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const handleMessage = useCallback(function (msg: ServerMessage) {
    if (msg.type === "specs:list_result") {
      setSpecs(msg.specs);
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
      return;
    }
  }, []);

  useEffect(function () {
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

  const activeSpecs = specs.filter(function (s) { return s.status !== "completed"; });

  if (activeSpecs.length === 0) return null;

  function handleSpecClick(specId: string) {
    openSpecById(specId);
    const state = getSidebarStore().state;
    if (state.activeView.type !== "chat") {
      getSidebarStore().setState(function (s) {
        return { ...s, activeView: { type: "chat" } };
      });
    }
  }

  return (
    <div className="mx-3 mt-1 mb-1">
      <button
        type="button"
        onClick={function () { setCollapsed(function (v) { return !v; }); }}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-base-content/30 hover:text-base-content/50 transition-colors"
      >
        <ChevronDown size={10} className={"transition-transform " + (collapsed ? "-rotate-90" : "")} />
        Active Specs
        <span className="text-[9px] font-mono text-base-content/20 ml-auto">{activeSpecs.length}</span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {activeSpecs.slice(0, 8).map(function (spec) {
            return (
              <button
                key={spec.id}
                type="button"
                onClick={function () { handleSpecClick(spec.id); }}
                className="flex items-center gap-2 px-2 py-1 rounded-lg text-left hover:bg-base-content/5 transition-colors w-full"
              >
                <span className={"w-2 h-2 rounded-full flex-shrink-0 " + STATUS_DOT[spec.status]} title={STATUS_LABELS[spec.status]} />
                <span className="text-[10px] font-mono text-base-content/30 flex-shrink-0 w-7" title={STATUS_LABELS[spec.status]}>
                  {STATUS_ABBREV[spec.status]}
                </span>
                <span className={"text-[11px] truncate min-w-0 flex-1 " + (!spec.title || spec.title === "Untitled" || spec.title === "Untitled Spec" ? "text-base-content/30 italic" : "text-base-content/60")}>
                  {spec.title || "Untitled"}
                </span>
                <span className={"text-[10px] font-mono flex-shrink-0 " + PRIORITY_COLOR[spec.priority]} title={PRIORITY_LABELS[spec.priority] + " priority"}>
                  {spec.priority[0].toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
