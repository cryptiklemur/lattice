import { useState } from "react";
import { Wrench, TriangleAlert } from "lucide-react";
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
    <div className="chat chat-end px-4 py-1.5">
      <div className="chat-bubble chat-bubble-primary text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[75%]">
        {msg.text}
      </div>
      <div className="chat-footer opacity-50 text-xs mt-1">
        {formatTime(msg.timestamp)}
      </div>
    </div>
  );
}

function AssistantMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  return (
    <div className="px-5 py-1.5">
      <div className="flex gap-3 items-start">
        <div className="w-6 h-6 rounded-full bg-base-200 border border-base-300 flex items-center justify-center flex-shrink-0 mt-0.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
        </div>
        <div className="flex-1 min-w-0 border-l-2 border-primary/40 pl-3">
          <div className="text-[14px] text-base-content leading-relaxed whitespace-pre-wrap break-words">
            {msg.text || ""}
          </div>
          <div className="text-[11px] text-base-content/40 mt-1">
            {formatTime(msg.timestamp)}
          </div>
        </div>
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
    <div className="pl-[52px] pr-5 py-1">
      <div className={"collapse collapse-arrow rounded-md overflow-hidden text-[12px] bg-base-200 border border-base-300 " + (hasResult ? "border-l-2 border-l-base-300" : "border-l-2 border-l-primary")}>
        <input
          type="checkbox"
          checked={expanded}
          onChange={function () { setExpanded(function (v) { return !v; }); }}
          className="peer"
        />
        <div className="collapse-title flex items-center gap-2.5 py-2 px-3 min-h-0 cursor-pointer">
          <Wrench size={13} className="text-primary flex-shrink-0" />
          <span className="font-mono font-semibold text-sm text-base-content flex-1 truncate">
            {msg.name}
          </span>
          {hasResult ? (
            <span className="text-xs text-base-content/40 bg-base-300 px-2 py-0.5 rounded-full mr-4">
              done
            </span>
          ) : (
            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full mr-4">
              running
            </span>
          )}
        </div>

        <div className="collapse-content px-0 pt-0">
          <div className="border-t border-base-300">
            {parsedArgs && (
              <div className="p-3">
                <div className="text-xs text-base-content/40 mb-2 uppercase tracking-wider font-semibold">
                  Arguments
                </div>
                <pre className="font-mono text-xs text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-300/50 rounded-lg p-2.5">
                  {parsedArgs}
                </pre>
              </div>
            )}
            {hasResult && (
              <div className={"p-3" + (parsedArgs ? " border-t border-base-300" : "")}>
                <div className="text-xs text-base-content/40 mb-2 uppercase tracking-wider font-semibold">
                  Result
                </div>
                <pre className="font-mono text-xs text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-300/50 rounded-lg p-2.5 max-h-[280px] overflow-y-auto">
                  {msg.content}
                </pre>
              </div>
            )}
          </div>
        </div>
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
    <div className="pl-[52px] pr-5 py-1">
      <div className="border-l-2 border-warning bg-warning/10 rounded-r-md p-3 flex flex-col gap-2.5 text-[13px]">
        <div className="flex items-center gap-2.5">
          <TriangleAlert size={16} className="text-warning flex-shrink-0" />
          <span className="font-semibold text-sm text-base-content">Permission required</span>
          <code className="font-mono text-xs bg-base-300 px-2 py-0.5 rounded text-base-content/70">
            {msg.name}
          </code>
        </div>

        {parsedArgs && (
          <pre className="font-mono text-xs text-base-content/60 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-300/60 px-3 py-2.5 rounded-lg w-full">
            {parsedArgs}
          </pre>
        )}

        {!responded ? (
          <div className="flex gap-2">
            <button
              className="btn btn-warning btn-sm"
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
          <span className="text-xs text-base-content/40">Response sent</span>
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
