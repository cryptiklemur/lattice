import { Brain, Wrench } from "lucide-react";

interface StatusBarProps {
  status: {
    phase: string;
    toolName?: string;
    elapsed?: number;
    summary?: string;
  } | null;
}

export function StatusBar(props: StatusBarProps) {
  var active = props.status !== null;

  return (
    <div
      className="grid transition-all duration-200 ease-out"
      style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-7 text-[12px] font-mono text-base-content/50 border-t border-base-300 bg-base-200">
          {props.status && (
            <>
              {props.status.phase === "thinking" ? (
                <Brain size={12} className="text-primary animate-pulse" />
              ) : (
                <Wrench size={12} className="text-primary" />
              )}
              <span className="truncate">
                {props.status.phase === "thinking"
                  ? "Thinking..."
                  : props.status.toolName || "Processing..."}
              </span>
              {props.status.summary && (
                <span className="text-base-content/30 truncate">
                  {props.status.summary}
                </span>
              )}
              {props.status.elapsed != null && (
                <span className="text-base-content/30 ml-auto flex-shrink-0">
                  {(props.status.elapsed / 1000).toFixed(1)}s
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
