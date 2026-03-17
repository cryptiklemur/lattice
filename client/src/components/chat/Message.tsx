import { useState } from "react";
import { ChevronRight, Lock, TriangleAlert } from "lucide-react";
import type { HistoryMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";

interface MessageProps {
  message: HistoryMessage;
}

function formatTime(timestamp: number): string {
  var d = new Date(timestamp);
  var h = d.getHours().toString().padStart(2, "0");
  var m = d.getMinutes().toString().padStart(2, "0");
  return h + ":" + m;
}

function UserMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  return (
    <div className="chat chat-end px-5 py-1">
      <div className="chat-bubble bg-primary text-primary-content text-[14px] leading-relaxed whitespace-pre-wrap break-words max-w-[75%]">
        {msg.text}
      </div>
      <div className="chat-footer text-[11px] text-base-content/40 mt-0.5">
        {formatTime(msg.timestamp)}
      </div>
    </div>
  );
}

function AssistantMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  return (
    <div className="chat chat-start px-5 py-1">
      <div className="chat-image">
        <div className="w-6 h-6 rounded-full bg-base-200 border border-base-300 flex items-center justify-center mt-0.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
        </div>
      </div>
      <div className="chat-bubble bg-transparent text-base-content text-[14px] leading-relaxed whitespace-pre-wrap break-words p-0 shadow-none min-h-0">
        {msg.text || ""}
      </div>
      <div className="chat-footer text-[11px] text-base-content/40 mt-0.5">
        {formatTime(msg.timestamp)}
      </div>
    </div>
  );
}

function ToolMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  var [expanded, setExpanded] = useState<boolean>(false);
  var hasResult = Boolean(msg.content);

  var parsedArgs: string = msg.args || "";
  try {
    if (msg.args) {
      parsedArgs = JSON.stringify(JSON.parse(msg.args), null, 2);
    }
  } catch {
    parsedArgs = msg.args || "";
  }

  return (
    <div className="px-5 py-1">
      <div className="bg-base-200 border border-base-300 rounded-md overflow-hidden text-[12px]">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-base-content/60 cursor-pointer bg-transparent"
          onClick={function () {
            setExpanded(function (v) { return !v; });
          }}
        >
          <ChevronRight
            size={12}
            className="flex-shrink-0 transition-transform duration-150"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <Lock size={13} className="text-primary flex-shrink-0" />
          <span className="font-mono font-semibold text-base-content flex-1">
            {msg.name}
          </span>
          {hasResult ? (
            <span className="text-[10px] text-base-content/40 bg-base-300 px-1.5 py-0.5 rounded">
              done
            </span>
          ) : (
            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              running
            </span>
          )}
        </button>

        {expanded && (
          <div className="border-t border-base-300">
            {parsedArgs && (
              <div className="p-2.5">
                <div className="text-[10px] text-base-content/40 mb-1.5 uppercase tracking-[0.05em]">
                  Arguments
                </div>
                <pre className="font-mono text-[12px] text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed">
                  {parsedArgs}
                </pre>
              </div>
            )}
            {hasResult && (
              <div className={"p-2.5" + (parsedArgs ? " border-t border-base-300" : "")}>
                <div className="text-[10px] text-base-content/40 mb-1.5 uppercase tracking-[0.05em]">
                  Result
                </div>
                <pre className="font-mono text-[12px] text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed max-h-[300px] overflow-y-auto">
                  {msg.content}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  var { send } = useWebSocket();
  var [responded, setResponded] = useState<boolean>(false);

  var parsedArgs: string = msg.args || "";
  try {
    if (msg.args) {
      parsedArgs = JSON.stringify(JSON.parse(msg.args), null, 2);
    }
  } catch {
    parsedArgs = msg.args || "";
  }

  function respond(allow: boolean) {
    if (responded || !msg.toolId) {
      return;
    }
    setResponded(true);
    send({ type: "chat:permission_response", requestId: msg.toolId, allow });
  }

  return (
    <div className="px-5 py-1">
      <div className="alert alert-warning border border-warning/30 bg-warning/10 text-[13px] flex-col items-start gap-2.5">
        <div className="flex items-center gap-2">
          <TriangleAlert size={15} className="text-warning flex-shrink-0" />
          <span className="font-semibold text-base-content">Permission required</span>
          <code className="font-mono text-[12px] bg-base-300 px-1.5 py-0.5 rounded text-base-content/70">
            {msg.name}
          </code>
        </div>

        {parsedArgs && (
          <pre className="font-mono text-[12px] text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-300 px-2.5 py-2 rounded w-full">
            {parsedArgs}
          </pre>
        )}

        {!responded ? (
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={function () { respond(true); }}
            >
              Allow
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={function () { respond(false); }}
            >
              Deny
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-base-content/40">Response sent</span>
        )}
      </div>
    </div>
  );
}

export function Message(props: MessageProps) {
  var msg = props.message;

  if (msg.type === "user") {
    return <UserMessage message={msg} />;
  }

  if (msg.type === "assistant") {
    return <AssistantMessage message={msg} />;
  }

  if (msg.type === "tool_start") {
    return <ToolMessage message={msg} />;
  }

  if (msg.type === "permission_request") {
    return <PermissionMessage message={msg} />;
  }

  return null;
}
