import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { Wrench, TriangleAlert, ChevronDown, Check, X, Shield } from "lucide-react";
import type { HistoryMessage, ChatPermissionResponseMessage } from "@lattice/shared";
import { useWebSocket } from "../../hooks/useWebSocket";
import { ToolResultRenderer } from "./ToolResultRenderer";
import { formatToolSummary } from "./toolSummary";

interface MessageProps {
  message: HistoryMessage;
  responseCost?: number | null;
  responseDuration?: number | null;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return "";
  var d = new Date(timestamp);
  var now = new Date();
  var h = d.getHours().toString().padStart(2, "0");
  var m = d.getMinutes().toString().padStart(2, "0");
  var time = h + ":" + m;

  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var yesterday = new Date(today.getTime() - 86400000);
  var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return time;
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return "Yesterday " + time;
  }
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[d.getMonth()] + " " + d.getDate() + ", " + time;
}

function UserMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  var time = formatTime(msg.timestamp);
  return (
    <div className="chat chat-end px-5 py-1">
      <div className="chat-bubble chat-bubble-primary text-[13px] leading-relaxed break-words max-w-[95%] sm:max-w-[85%] shadow-sm">
        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-primary-content prose-p:text-primary-content prose-strong:text-primary-content prose-code:text-primary-content/80 prose-pre:bg-primary/20 prose-a:text-primary-content/90 prose-a:underline">
          <Markdown>{msg.text || ""}</Markdown>
        </div>
      </div>
      {time && (
        <div className="chat-footer text-[10px] text-base-content/30 mt-0.5">
          {time}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  var seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds + "s";
  var minutes = Math.floor(seconds / 60);
  var remainingSeconds = seconds % 60;
  return minutes + "m " + remainingSeconds + "s";
}

function formatTokenCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function AssistantMessage(props: { message: HistoryMessage; responseCost?: number | null; responseDuration?: number | null }) {
  var msg = props.message;
  var time = formatTime(msg.timestamp);
  return (
    <div className="chat chat-start px-5 py-1">
      <div className="chat-image">
        <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
      </div>
      <div className="chat-bubble bg-base-300/70 text-base-content text-[13px] leading-relaxed break-words max-w-[95%] sm:max-w-[85%] shadow-sm border border-base-content/5">
        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-base-content prose-p:text-base-content prose-strong:text-base-content prose-code:text-base-content/70 prose-code:bg-base-100/50 prose-pre:bg-base-100 prose-pre:text-base-content/70 prose-a:text-primary prose-a:underline prose-li:text-base-content">
          <Markdown>{msg.text || ""}</Markdown>
        </div>
      </div>
      {time && (
        <div className="chat-footer text-[10px] text-base-content/30 mt-0.5 flex items-center gap-2">
          <span>{time}</span>
          {props.responseDuration != null && props.responseDuration > 0 && (
            <span className="text-base-content/20">{formatDuration(props.responseDuration)}</span>
          )}
          {(props.responseCost != null && props.responseCost > 0) ? (
            <span className="text-base-content/20">{"$" + props.responseCost.toFixed(4)}</span>
          ) : (msg.costEstimate != null && msg.costEstimate > 0) ? (
            <span className="text-base-content/20">{"~$" + msg.costEstimate.toFixed(4)}</span>
          ) : null}
          {msg.outputTokens != null && msg.outputTokens > 0 && (
            <span className="text-base-content/15">{formatTokenCount(msg.outputTokens)} out</span>
          )}
        </div>
      )}
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
    <div className="ml-14 mr-5 py-0.5 max-w-[95%] sm:max-w-[75%]">
      <div
        className={
          "rounded-lg overflow-hidden text-[12px] border transition-colors duration-100 " +
          (hasResult
            ? "bg-base-200/50 border-base-content/8"
            : "bg-base-200/70 border-primary/20")
        }
      >
        <button
          type="button"
          onClick={function () { setExpanded(function (v) { return !v; }); }}
          className="flex items-center gap-2 w-full py-1.5 px-2.5 hover:bg-base-content/5 transition-colors duration-100 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset rounded-lg"
        >
          <Wrench size={11} className={hasResult ? "text-base-content/30" : "text-primary/70"} />
          <span className="font-mono font-medium text-[12px] text-base-content/70 flex-shrink-0">
            {msg.name}
          </span>
          <span className="text-[10px] text-base-content/30 truncate min-w-0 flex-1 text-left">
            {formatToolSummary(msg.name || "", msg.args || "")}
          </span>
          {hasResult ? (
            <span className="text-[10px] text-base-content/30 flex-shrink-0">done</span>
          ) : (
            <span className="text-[10px] text-primary/70 flex-shrink-0">running</span>
          )}
          <ChevronDown
            size={11}
            className={"text-base-content/30 transition-transform duration-150 " + (expanded ? "rotate-180" : "")}
          />
        </button>

        {expanded && (
          <div className="border-t border-base-content/8">
            <ToolResultRenderer toolName={msg.name || ""} args={msg.args || ""} result={msg.content || ""} />
            {!(msg.name === "Edit" || msg.name === "MultiEdit") && parsedArgs && (
              <div className="px-2.5 py-2 border-t border-base-content/8">
                <div className="text-[9px] text-base-content/25 mb-0.5 uppercase tracking-wider font-semibold">Args</div>
                <pre className="font-mono text-[11px] text-base-content/45 whitespace-pre-wrap break-words m-0 leading-relaxed bg-base-100/50 rounded-md p-2 max-h-[120px] overflow-y-auto">
                  {parsedArgs}
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
  var [showScopeMenu, setShowScopeMenu] = useState<boolean>(false);
  var [expanded, setExpanded] = useState<boolean>(false);
  var [dropUp, setDropUp] = useState<boolean>(false);
  var scopeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(function () {
    if (showScopeMenu && scopeBtnRef.current) {
      var rect = scopeBtnRef.current.getBoundingClientRect();
      var spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 120);
    }
  }, [showScopeMenu]);

  var isResolved = msg.permissionStatus && msg.permissionStatus !== "pending";

  var parsedArgs: string = msg.args || "";
  try {
    if (msg.args) {
      parsedArgs = JSON.stringify(JSON.parse(msg.args), null, 2);
    }
  } catch {
    parsedArgs = msg.args || "";
  }

  function respond(allow: boolean, alwaysAllow?: boolean, alwaysAllowScope?: "session" | "project") {
    if (isResolved || !msg.toolId) {
      return;
    }
    send({
      type: "chat:permission_response",
      requestId: msg.toolId,
      allow: allow,
      alwaysAllow: alwaysAllow,
      alwaysAllowScope: alwaysAllowScope,
    } as ChatPermissionResponseMessage);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isResolved) return;
    if (e.key === "Enter") {
      e.preventDefault();
      respond(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      respond(false);
    }
  }

  if (isResolved) {
    var statusIcon = msg.permissionStatus === "denied"
      ? <X size={12} className="text-error" />
      : <Check size={12} className="text-success" />;
    var statusText = msg.permissionStatus === "denied"
      ? "Denied"
      : msg.permissionStatus === "always_allowed"
      ? "Always allowed"
      : "Allowed";
    var borderClass = msg.permissionStatus === "denied"
      ? "border-error/15 bg-error/3"
      : "border-success/15 bg-success/3";

    return (
      <div className="ml-14 mr-5 py-0.5 max-w-[95%] sm:max-w-[75%]">
        <div className={"rounded-lg text-[12px] border px-2.5 py-1.5 flex items-center gap-2 " + borderClass}>
          {statusIcon}
          <span className="text-base-content/35">{statusText}</span>
          <code className="font-mono text-[11px] bg-base-300/40 px-1.5 py-0.5 rounded text-base-content/30">
            {msg.name}
          </code>
          <span className="text-[10px] text-base-content/15 ml-auto">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-14 mr-5 py-1 max-w-[95%] sm:max-w-[75%]" onKeyDown={handleKeyDown} tabIndex={0} role="group" aria-label={"Permission request: " + (msg.name || "unknown tool")}>
      <div className="border border-warning/30 bg-warning/5 rounded-lg p-3 flex flex-col gap-2 text-[13px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <TriangleAlert size={14} className="text-warning flex-shrink-0" />
            <code className="font-mono text-[11px] bg-base-300/60 px-1.5 py-0.5 rounded text-base-content/60">
              {msg.name}
            </code>
          </div>
          <div className="text-[13px] text-base-content/80">
            {msg.title || "Permission required"}
          </div>
        </div>

        {parsedArgs && (
          <div>
            <button
              type="button"
              onClick={function () { setExpanded(function (v) { return !v; }); }}
              className="text-[10px] text-base-content/30 hover:text-base-content/50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronDown size={10} className={"transition-transform duration-150 " + (expanded ? "rotate-180" : "")} />
              args
            </button>
            {expanded && (
              <pre className="font-mono text-[11px] text-base-content/50 whitespace-pre-wrap break-words m-0 mt-1 leading-relaxed bg-base-100/50 px-2.5 py-2 rounded-md w-full max-h-[160px] overflow-y-auto">
                {parsedArgs}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-2 items-center relative">
          <button
            className="btn btn-warning btn-sm btn-outline"
            onClick={function () { respond(true); }}
          >
            Allow
          </button>
          <div className="inline-flex">
            <button
              className="btn btn-ghost btn-sm text-warning/70 border border-warning/25 rounded-r-none border-r-0 text-[11px] px-2"
              onClick={function () { respond(true, true, "session"); }}
            >
              Always Allow
            </button>
            <button
              ref={scopeBtnRef}
              className="btn btn-ghost btn-sm text-warning/70 border border-warning/25 rounded-l-none text-[11px] px-1"
              onClick={function () { setShowScopeMenu(function (v) { return !v; }); }}
            >
              <ChevronDown size={10} />
            </button>
          </div>
          <button
            className="btn btn-ghost btn-sm text-base-content/40"
            onClick={function () { respond(false); }}
          >
            Deny
          </button>
          <span className="text-[10px] text-base-content/20 italic ml-auto">waiting for approval...</span>

          {showScopeMenu && (
            <div className={"absolute left-[88px] z-50 bg-base-300 border border-warning/20 rounded-lg shadow-xl p-1 text-[12px] font-mono min-w-[220px] " + (dropUp ? "bottom-full mb-1" : "top-full mt-1")}>
              <button
                className="flex flex-col w-full px-2.5 py-1.5 rounded hover:bg-warning/10 text-left text-base-content/70 transition-colors"
                onClick={function () { setShowScopeMenu(false); respond(true, true, "session"); }}
              >
                <div className="flex items-center gap-2">
                  <Shield size={11} className="text-warning/60" />
                  This session only
                </div>
              </button>
              <button
                className="flex flex-col w-full px-2.5 py-1.5 rounded hover:bg-warning/10 text-left text-base-content/70 transition-colors"
                onClick={function () { setShowScopeMenu(false); respond(true, true, "project"); }}
              >
                <div className="flex items-center gap-2">
                  <Shield size={11} className="text-warning/60" />
                  This project
                </div>
                {msg.permissionRule && (
                  <code className="text-[9px] text-base-content/25 mt-0.5 ml-[19px]">{msg.permissionRule}</code>
                )}
              </button>
            </div>
          )}
        </div>
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
    return <AssistantMessage message={msg} responseCost={props.responseCost} responseDuration={props.responseDuration} />;
  }

  if (msg.type === "tool_start") {
    return <ToolMessage message={msg} />;
  }

  if (msg.type === "permission_request") {
    return <PermissionMessage message={msg} />;
  }

  return null;
}
