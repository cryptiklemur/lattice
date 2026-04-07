import { Link2Off } from "lucide-react";
import type { SpecLinkedSession } from "#shared";

function relativeTime(ts: number): string {
  var diff = Date.now() - ts;
  var seconds = Math.floor(diff / 1000);
  if (seconds < 60) return seconds + "s ago";
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  var days = Math.floor(hours / 24);
  return days + "d ago";
}

interface SpecSessionsTabProps {
  linkedSessions: SpecLinkedSession[];
  onUnlink: (sessionId: string) => void;
  disabled?: boolean;
}

export function SpecSessionsTab({ linkedSessions, onUnlink, disabled }: SpecSessionsTabProps) {
  if (linkedSessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-[13px] text-base-content/30 font-mono">
        No linked sessions
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-2">
      {linkedSessions.map(function (session) {
        return (
          <div key={session.sessionId} className="flex items-center gap-3 px-1 py-1.5 rounded hover:bg-base-content/5 transition-colors">
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
              className="p-1 rounded text-base-content/30 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
