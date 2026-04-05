import { useState, useRef, useEffect, memo, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Wrench, TriangleAlert, ChevronDown, ChevronRight, Check, X, Shield, Zap, Link, Copy, SquarePlus, Bookmark, BookmarkCheck, RotateCcw, ClipboardCopy, FileText, MessageSquarePlus, History } from "lucide-react";
import type { HistoryMessage, ChatPermissionResponseMessage } from "@lattice/shared";
import { useStore } from "@tanstack/react-store";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getSessionStore, setPendingPrefill } from "../../stores/session";
import { getBookmarkStore, findBookmarkByUuid } from "../../stores/bookmarks";
import { ToolResultRenderer } from "./ToolResultRenderer";
import { formatToolSummary } from "./toolSummary";
import { PromptQuestion } from "./PromptQuestion";
import { TodoCard } from "./TodoCard";
import { ElicitationCard } from "./ElicitationCard";
import { ContextMenu, useContextMenu } from "../ui/ContextMenu";
import type { ContextMenuEntry } from "../ui/ContextMenu";

function TableWrapper(props: React.HTMLAttributes<HTMLTableElement>) {
  var wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(function () {
    var el = wrapperRef.current;
    if (!el) return;
    function check() {
      if (!el) return;
      var hasOverflow = el.scrollWidth > el.clientWidth + 1;
      var atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      el.classList.toggle("has-overflow", hasOverflow);
      el.classList.toggle("scrolled-end", atEnd || !hasOverflow);
    }
    check();
    el.addEventListener("scroll", check, { passive: true });
    var ro = new ResizeObserver(check);
    ro.observe(el);
    return function () {
      el!.removeEventListener("scroll", check);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="table-wrapper">
      <table {...props} />
    </div>
  );
}

var mdComponents = {
  table: TableWrapper,
};

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

function MessageAnchor(props: { id: string | undefined }) {
  if (!props.id) return null;
  function handleClick() {
    var url = window.location.pathname + "#msg-" + props.id;
    window.history.replaceState(null, "", url);
    navigator.clipboard.writeText(window.location.origin + url);
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 text-base-content/20 hover:text-base-content/50 cursor-pointer p-0.5 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none rounded"
      title="Copy link to message"
      aria-label="Copy link to message"
    >
      <Link size={11} />
    </button>
  );
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, function (m) { return m.replace(/```\w*\n?/g, "").replace(/```$/g, ""); })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .trim();
}

function MessageActions(props: { text: string; showNewSession?: boolean; messageUuid?: string; messageType?: "user" | "assistant" }) {
  var [copied, setCopied] = useState(false);
  var ws = useWebSocket();
  var bookmarkState = useStore(getBookmarkStore(), function (s) { return s; });
  var isBookmarked = useMemo(function () {
    if (!props.messageUuid) return false;
    for (var i = 0; i < bookmarkState.bookmarks.length; i++) {
      if (bookmarkState.bookmarks[i].messageUuid === props.messageUuid) return true;
    }
    return false;
  }, [props.messageUuid, bookmarkState.bookmarks]);

  function handleCopy(e: React.MouseEvent) {
    var content = e.shiftKey ? stripMarkdown(props.text) : props.text;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 1500);
  }

  function handleNewSession() {
    var state = getSessionStore().state;
    if (!state.activeProjectSlug) return;
    setPendingPrefill(props.text);
    ws.send({ type: "session:create", projectSlug: state.activeProjectSlug });
  }

  function handleBookmarkToggle() {
    var state = getSessionStore().state;
    if (!state.activeSessionId || !state.activeProjectSlug || !props.messageUuid || !props.messageType) return;
    if (isBookmarked) {
      var bm = findBookmarkByUuid(props.messageUuid);
      if (bm) {
        ws.send({ type: "bookmark:remove", id: bm.id });
      }
    } else {
      ws.send({
        type: "bookmark:add",
        sessionId: state.activeSessionId,
        projectSlug: state.activeProjectSlug,
        messageUuid: props.messageUuid,
        messageText: props.text.slice(0, 100),
        messageType: props.messageType,
      });
    }
  }

  var btnClass = "opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 text-base-content/20 hover:text-base-content/50 cursor-pointer p-0.5 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none rounded";

  return (
    <>
      <button type="button" onClick={handleCopy} className={btnClass} title={copied ? "Copied!" : "Copy message (Shift+click for plain text)"} aria-label={copied ? "Copied" : "Copy message"}>
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      {props.showNewSession && (
        <button type="button" onClick={handleNewSession} className={btnClass} title="Start new session with this message" aria-label="Start new session with this message">
          <SquarePlus size={11} />
        </button>
      )}
      {props.messageUuid && props.messageType && (
        <button type="button" onClick={handleBookmarkToggle} className={btnClass + (isBookmarked ? " !opacity-100 !text-warning" : "")} title={isBookmarked ? "Remove bookmark" : "Bookmark message"} aria-label={isBookmarked ? "Remove bookmark" : "Bookmark message"}>
          {isBookmarked ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
        </button>
      )}
    </>
  );
}

function parseSkillInvocation(text: string): { skillName: string; content: string } | null {
  var firstNewline = text.search(/\r?\n/);
  if (firstNewline === -1) return null;
  var firstLine = text.slice(0, firstNewline).trim();
  if (firstLine.indexOf(":") === -1) return null;
  if (!/\n---[\r\n]/.test(text)) return null;
  return { skillName: firstLine, content: text.slice(firstNewline).replace(/^\r?\n+---[\r\n]+/, "").trim() };
}

function SkillMessage(props: { skillName: string; content: string; time: string | null; uuid?: string }) {
  var [expanded, setExpanded] = useState(false);
  return (
    <div id={props.uuid ? "msg-" + props.uuid : undefined} className="chat chat-end px-5 py-1 group/msg">
      <div className="chat-bubble chat-bubble-primary text-[13px] leading-relaxed break-words max-w-[95%] sm:max-w-[85%] shadow-sm">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={function () { setExpanded(!expanded); }}
          className="flex items-center gap-2 w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-content/30 rounded py-0.5"
        >
          <Zap size={13} className="text-primary-content/50 shrink-0" />
          <span className="font-mono font-semibold text-primary-content text-[13px] tracking-tight">
            /{props.skillName}
          </span>
          <ChevronRight
            size={14}
            className={"text-primary-content/30 ml-auto shrink-0 transition-transform duration-200 " + (expanded ? "rotate-90" : "")}
          />
        </button>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-primary-content/10 relative">
            <div className="max-h-[400px] overflow-y-auto skill-content-scroll prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-primary-content prose-headings:text-[13px] prose-headings:mt-3 prose-headings:mb-1 prose-p:text-primary-content/80 prose-strong:text-primary-content prose-code:text-primary-content/70 prose-code:text-[11px] prose-pre:bg-primary/20 prose-a:text-primary-content/90 prose-a:underline text-[12px] leading-relaxed prose-li:text-primary-content/75 prose-li:text-[12px] prose-hr:border-primary-content/10">
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{props.content}</Markdown>
            </div>
          </div>
        )}
      </div>
      {props.time && (
        <div className="chat-footer text-[10px] text-base-content/30 mt-0.5 flex items-center gap-1">
          {props.time}
          <MessageAnchor id={props.uuid} />
          <MessageActions text={"/" + props.skillName} showNewSession messageUuid={props.uuid} messageType="user" />
        </div>
      )}
    </div>
  );
}

function RewindButton(props: { uuid: string }) {
  var ws = useWebSocket();
  var [pending, setPending] = useState(false);
  var [preview, setPreview] = useState<{ canRewind: boolean; filesChanged?: number; error?: string } | null>(null);

  useEffect(function () {
    function handlePreview(msg: any) {
      if (msg.type === "chat:rewind_preview_result" && msg.messageUuid === props.uuid) {
        setPreview(msg);
        setPending(false);
      }
    }
    function handleExecResult(msg: any) {
      if (msg.type === "chat:rewind_execute_result" && msg.messageUuid === props.uuid) {
        setPreview(null);
      }
    }
    ws.subscribe("chat:rewind_preview_result", handlePreview);
    ws.subscribe("chat:rewind_execute_result", handleExecResult);
    return function () {
      ws.unsubscribe("chat:rewind_preview_result", handlePreview);
      ws.unsubscribe("chat:rewind_execute_result", handleExecResult);
    };
  }, [ws, props.uuid]);

  function handleClick() {
    if (preview) {
      ws.send({ type: "chat:rewind_execute", messageUuid: props.uuid, mode: "files" } as any);
      setPreview(null);
      return;
    }
    setPending(true);
    ws.send({ type: "chat:rewind_preview", messageUuid: props.uuid } as any);
  }

  if (preview && !preview.canRewind) {
    return (
      <span className="text-error/60 text-[10px]" title={preview.error || "Cannot rewind"}>
        {preview.error || "Cannot rewind"}
      </span>
    );
  }

  if (preview && preview.canRewind) {
    return (
      <span className="flex items-center gap-1">
        <button
          onClick={handleClick}
          className="btn btn-ghost btn-xs h-4 min-h-0 px-1 text-warning/70 hover:text-warning"
          title={"Rewind files (" + (preview.filesChanged || 0) + " changed)"}
        >
          <RotateCcw className="!size-3" />
          <span className="text-[10px]">Rewind {preview.filesChanged || 0} files</span>
        </button>
        <button
          onClick={function () { setPreview(null); }}
          className="btn btn-ghost btn-xs h-4 min-h-0 px-0.5 text-base-content/30 hover:text-base-content/60"
        >
          <X className="!size-3" />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="btn btn-ghost btn-xs h-4 min-h-0 px-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity text-base-content/30 hover:text-base-content/60"
      title="Rewind files to this point"
    >
      <RotateCcw className={"!size-3" + (pending ? " animate-spin" : "")} />
    </button>
  );
}

function UserMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  var time = formatTime(msg.timestamp);
  var text = msg.text || "";
  var skill = parseSkillInvocation(text);
  var ctxMenu = useContextMenu<HistoryMessage>();
  var ws = useWebSocket();
  var bookmarkState = useStore(getBookmarkStore(), function (s) { return s; });
  var isBookmarked = useMemo(function () {
    if (!msg.uuid) return false;
    for (var i = 0; i < bookmarkState.bookmarks.length; i++) {
      if (bookmarkState.bookmarks[i].messageUuid === msg.uuid) return true;
    }
    return false;
  }, [msg.uuid, bookmarkState.bookmarks]);

  function handleNewSession() {
    var state = getSessionStore().state;
    if (!state.activeProjectSlug) return;
    setPendingPrefill(text);
    ws.send({ type: "session:create", projectSlug: state.activeProjectSlug });
  }

  function handleBookmarkToggle() {
    var state = getSessionStore().state;
    if (!state.activeSessionId || !state.activeProjectSlug || !msg.uuid) return;
    if (isBookmarked) {
      var bm = findBookmarkByUuid(msg.uuid);
      if (bm) {
        ws.send({ type: "bookmark:remove", id: bm.id });
      }
    } else {
      ws.send({
        type: "bookmark:add",
        sessionId: state.activeSessionId,
        projectSlug: state.activeProjectSlug,
        messageUuid: msg.uuid,
        messageText: text.slice(0, 100),
        messageType: "user",
      });
    }
  }

  function buildContextItems(): ContextMenuEntry[] {
    return [
      { label: "Copy", icon: <Copy size={14} />, onClick: function () { navigator.clipboard.writeText(text); } },
      { label: "Copy as plain text", icon: <FileText size={14} />, onClick: function () { navigator.clipboard.writeText(stripMarkdown(text)); } },
      { type: "divider" as const },
      { label: "Start new session with this message", icon: <MessageSquarePlus size={14} />, onClick: handleNewSession },
      { type: "divider" as const },
      { label: isBookmarked ? "Unbookmark" : "Bookmark", icon: isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />, onClick: handleBookmarkToggle, hidden: !msg.uuid },
      { label: "Copy link to message", icon: <Link size={14} />, onClick: function () { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "#msg-" + msg.uuid); }, hidden: !msg.uuid },
    ];
  }

  if (skill) {
    return <SkillMessage skillName={skill.skillName} content={skill.content} time={time} uuid={msg.uuid} />;
  }
  return (
    <div id={msg.uuid ? "msg-" + msg.uuid : undefined} data-allow-context-menu className="chat chat-end px-5 py-1 group/msg" onContextMenu={function (e) { ctxMenu.open(e, msg); }}>
      <div className="chat-bubble chat-bubble-primary text-[13px] leading-relaxed break-words max-w-[95%] sm:max-w-[85%] shadow-sm">
        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-primary-content prose-p:text-primary-content prose-strong:text-primary-content prose-code:text-primary-content/80 prose-pre:bg-primary/20 prose-a:text-primary-content/90 prose-a:underline prose-li:text-primary-content [&_ul>li::marker]:text-primary-content [&_ol>li::marker]:text-primary-content">
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</Markdown>
        </div>
      </div>
      {time && (
        <div className="chat-footer text-[10px] text-base-content/30 mt-0.5 flex items-center gap-1">
          {time}
          {msg.uuid && <RewindButton uuid={msg.uuid} />}
          <MessageAnchor id={msg.uuid} />
          <MessageActions text={text} showNewSession messageUuid={msg.uuid} messageType="user" />
        </div>
      )}
      {ctxMenu.state && <ContextMenu x={ctxMenu.state.x} y={ctxMenu.state.y} items={buildContextItems()} onClose={ctxMenu.close} label="User message actions" />}
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
  var text = msg.text || "";
  var ctxMenu = useContextMenu<HistoryMessage>();
  var ws = useWebSocket();
  var bookmarkState = useStore(getBookmarkStore(), function (s) { return s; });
  var isBookmarked = useMemo(function () {
    if (!msg.uuid) return false;
    for (var i = 0; i < bookmarkState.bookmarks.length; i++) {
      if (bookmarkState.bookmarks[i].messageUuid === msg.uuid) return true;
    }
    return false;
  }, [msg.uuid, bookmarkState.bookmarks]);

  function handleNewSession() {
    var state = getSessionStore().state;
    if (!state.activeProjectSlug) return;
    setPendingPrefill(text);
    ws.send({ type: "session:create", projectSlug: state.activeProjectSlug });
  }

  function handleBookmarkToggle() {
    var state = getSessionStore().state;
    if (!state.activeSessionId || !state.activeProjectSlug || !msg.uuid) return;
    if (isBookmarked) {
      var bm = findBookmarkByUuid(msg.uuid);
      if (bm) {
        ws.send({ type: "bookmark:remove", id: bm.id });
      }
    } else {
      ws.send({
        type: "bookmark:add",
        sessionId: state.activeSessionId,
        projectSlug: state.activeProjectSlug,
        messageUuid: msg.uuid,
        messageText: text.slice(0, 100),
        messageType: "assistant",
      });
    }
  }

  function buildContextItems(): ContextMenuEntry[] {
    return [
      { label: "Copy", icon: <Copy size={14} />, onClick: function () { navigator.clipboard.writeText(text); } },
      { label: "Copy as plain text", icon: <FileText size={14} />, onClick: function () { navigator.clipboard.writeText(stripMarkdown(text)); } },
      { type: "divider" as const },
      { label: "Start new session with this message", icon: <MessageSquarePlus size={14} />, onClick: handleNewSession },
      { type: "divider" as const },
      { label: isBookmarked ? "Unbookmark" : "Bookmark", icon: isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />, onClick: handleBookmarkToggle, hidden: !msg.uuid },
      { label: "Copy link to message", icon: <Link size={14} />, onClick: function () { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "#msg-" + msg.uuid); }, hidden: !msg.uuid },
    ];
  }

  return (
    <div id={msg.uuid ? "msg-" + msg.uuid : undefined} data-allow-context-menu className="chat chat-start px-5 py-1 group/msg" onContextMenu={function (e) { ctxMenu.open(e, msg); }}>
      <div className="chat-image">
        <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
      </div>
      <div className="chat-bubble bg-base-300/70 text-base-content text-[13px] leading-relaxed break-words max-w-[95%] sm:max-w-[85%] shadow-sm border border-base-content/5">
        <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-base-content prose-p:text-base-content prose-strong:text-base-content prose-code:text-base-content/70 prose-code:bg-base-100/50 prose-pre:bg-base-100 prose-pre:text-base-content/70 prose-a:text-primary prose-a:underline prose-li:text-base-content">
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</Markdown>
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
          <MessageAnchor id={msg.uuid} />
          <MessageActions text={text} showNewSession messageUuid={msg.uuid} messageType="assistant" />
        </div>
      )}
      {ctxMenu.state && <ContextMenu x={ctxMenu.state.x} y={ctxMenu.state.y} items={buildContextItems()} onClose={ctxMenu.close} label="Assistant message actions" />}
    </div>
  );
}

function ToolMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  var [expanded, setExpanded] = useState<boolean>(false);
  var hasResult = Boolean(msg.content);
  var ctxMenu = useContextMenu<HistoryMessage>();

  var parsedArgs: string = msg.args || "";
  try {
    if (msg.args) {
      parsedArgs = JSON.stringify(JSON.parse(msg.args), null, 2);
    }
  } catch {
    parsedArgs = msg.args || "";
  }

  function buildContextItems(): ContextMenuEntry[] {
    return [
      { label: "Copy output", icon: <ClipboardCopy size={14} />, onClick: function () { navigator.clipboard.writeText(msg.content || ""); }, disabled: !hasResult },
      { label: "Copy tool input", icon: <Copy size={14} />, onClick: function () { navigator.clipboard.writeText(parsedArgs); } },
    ];
  }

  return (
    <div data-allow-context-menu className="ml-14 mr-5 py-0.5 max-w-[95%] sm:max-w-[75%] group/msg" onContextMenu={function (e) { ctxMenu.open(e, msg); }}>
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
      {hasResult && (
        <div className="flex items-center gap-1 mt-0.5 px-0.5">
          <MessageActions text={msg.content || ""} />
        </div>
      )}
      {ctxMenu.state && <ContextMenu x={ctxMenu.state.x} y={ctxMenu.state.y} items={buildContextItems()} onClose={ctxMenu.close} label="Tool message actions" />}
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
            <div className={"absolute left-0 sm:left-[88px] z-50 bg-base-300 border border-warning/20 rounded-lg shadow-xl p-1 text-[12px] font-mono w-[calc(100vw-48px)] sm:w-auto sm:min-w-[220px] max-w-[280px] " + (dropUp ? "bottom-full mb-1" : "top-full mt-1")}>
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

function CompactSummaryMessage(props: { message: HistoryMessage }) {
  var [expanded, setExpanded] = useState(false);
  var msg = props.message;
  var text = msg.text || "";
  var time = formatTime(msg.timestamp);

  return (
    <div id={msg.uuid ? "msg-" + msg.uuid : undefined} className="px-5 py-3">
      <button
        type="button"
        onClick={function () { setExpanded(function (v) { return !v; }); }}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 group/compact focus-visible:outline-none"
      >
        <div className="h-px flex-1 bg-base-content/8 group-hover/compact:bg-base-content/15 transition-colors duration-150" />
        <div className={"flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-150 " + (expanded ? "border-primary/30 bg-primary/8 text-primary/70" : "border-base-content/10 bg-base-200/60 text-base-content/35 hover:border-base-content/20 hover:text-base-content/55")}>
          <History size={11} className="shrink-0" />
          <span className="text-[10px] font-mono font-semibold tracking-wider uppercase">Context Compacted</span>
          {time && <span className="text-[9px] opacity-60 ml-0.5">{time}</span>}
          <ChevronDown size={10} className={"ml-0.5 transition-transform duration-200 " + (expanded ? "rotate-180" : "")} />
        </div>
        <div className="h-px flex-1 bg-base-content/8 group-hover/compact:bg-base-content/15 transition-colors duration-150" />
      </button>

      {expanded && (
        <div className="mt-3 mx-auto max-w-[760px]">
          <div className="rounded-xl border border-base-content/8 bg-base-200/40 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-base-content/6 bg-base-200/60">
              <History size={12} className="text-base-content/30 shrink-0" />
              <span className="text-[10px] font-mono font-semibold text-base-content/35 uppercase tracking-wider">Session Summary</span>
              <span className="ml-auto text-[9px] text-base-content/20 font-mono">{time}</span>
            </div>
            <div className="max-h-[480px] overflow-y-auto p-4 prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-headings:text-base-content/70 prose-headings:text-[12px] prose-headings:font-mono prose-headings:uppercase prose-headings:tracking-wide prose-headings:mt-4 prose-headings:mb-1.5 prose-p:text-base-content/50 prose-p:text-[12px] prose-p:leading-relaxed prose-strong:text-base-content/65 prose-code:text-base-content/50 prose-code:text-[11px] prose-code:bg-base-content/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-li:text-base-content/50 prose-li:text-[12px] prose-hr:border-base-content/8">
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{text}</Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export var Message = memo(function Message(props: MessageProps) {
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

  if (msg.type === "compact_summary") {
    return <CompactSummaryMessage message={msg} />;
  }

  if (msg.type === "permission_request") {
    return <PermissionMessage message={msg} />;
  }

  if (msg.type === "prompt_question") {
    return <PromptQuestion message={msg} />;
  }

  if (msg.type === "todo_update") {
    return <TodoCard message={msg} />;
  }

  if (msg.type === "elicitation") {
    return (
      <ElicitationCard
        requestId={msg.toolId || ""}
        serverName={msg.elicitationServerName || "MCP Server"}
        message={msg.elicitationMessage || ""}
        mode={msg.elicitationMode || "form"}
        url={msg.elicitationUrl}
        requestedSchema={msg.elicitationSchema}
        resolved={msg.elicitationStatus !== "pending"}
        resolvedAction={msg.elicitationStatus === "accepted" ? "accept" : msg.elicitationStatus === "declined" ? "decline" : undefined}
      />
    );
  }

  return null;
});
