import { Link2Off, MessageSquare, Lightbulb, ClipboardList, Play } from "lucide-react";
import type { SpecLinkedSession } from "#shared";
import { relativeTime } from "../../../utils/relativeTime";

const SESSION_TYPE_CONFIG: Record<string, { icon: typeof MessageSquare; label: string; color: string }> = {
  "brainstorm": { icon: Lightbulb, label: "Brainstorm", color: "text-warning" },
  "write-plan": { icon: ClipboardList, label: "Plan", color: "text-info" },
  "execute": { icon: Play, label: "Execute", color: "text-success" },
  "chat": { icon: MessageSquare, label: "Chat", color: "text-base-content/50" },
};

interface SpecSessionsTabProps {
  linkedSessions: SpecLinkedSession[];
  onUnlink: (sessionId: string) => void;
  disabled?: boolean;
}

export function SpecSessionsTab({ linkedSessions, onUnlink, disabled }: SpecSessionsTabProps) {
  if (linkedSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-1">
        <span className="text-[13px] text-base-content/30 font-mono">No linked sessions</span>
        <span className="text-[11px] text-base-content/20">Chat sessions linked to this spec will appear here</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {linkedSessions.map(function (session) {
        return (
          <div key={session.sessionId} className="flex items-center gap-2 sm:gap-3 px-1 py-1.5 rounded hover:bg-base-content/5 transition-colors flex-wrap sm:flex-nowrap">
            {(function () {
              const config = SESSION_TYPE_CONFIG[session.sessionType || "chat"] || SESSION_TYPE_CONFIG["chat"];
              const Icon = config.icon;
              return (
                <span className={"flex items-center gap-1 flex-shrink-0 " + config.color}>
                  <Icon size={13} />
                  <span className="text-[10px] font-mono">{config.label}</span>
                </span>
              );
            })()}
            <span className="text-[12px] font-mono text-base-content/70 flex-shrink-0">
              {session.sessionId.slice(0, 8)}
            </span>
            {session.note && (
              <span className="text-[11px] text-base-content/40 truncate min-w-0 flex-1">
                {session.note}
              </span>
            )}
            <span className="text-[10px] text-base-content/30 font-mono flex-shrink-0 ml-auto">
              {relativeTime(session.linkedAt)}
            </span>
            <button
              type="button"
              onClick={function () { onUnlink(session.sessionId); }}
              disabled={disabled}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={"Unlink session " + session.sessionId.slice(0, 8)}
            >
              <Link2Off size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
