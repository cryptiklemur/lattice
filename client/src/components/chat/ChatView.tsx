import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal, Info, ArrowDown, Pencil, Copy, Check } from "lucide-react";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSession } from "../../hooks/useSession";
import { useProjects } from "../../hooks/useProjects";
import { useWebSocket } from "../../hooks/useWebSocket";
import { setSessionTitle } from "../../stores/session";
import { Message } from "./Message";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { PermissionModeSelector } from "./PermissionModeSelector";
import { StatusBar } from "./StatusBar";

export function ChatView() {
  var { messages, isProcessing, sendMessage, activeSessionId, activeSessionTitle, currentStatus, contextUsage, contextBreakdown } = useSession();
  var { activeProject } = useProjects();
  var ws = useWebSocket();
  var scrollParentRef = useRef<HTMLDivElement>(null);
  var prevLengthRef = useRef<number>(0);
  var isLiveChatRef = useRef<boolean>(false);
  var [isNearBottom, setIsNearBottom] = useState<boolean>(true);
  var [selectedModel, setSelectedModel] = useState<string>("default");
  var [selectedEffort, setSelectedEffort] = useState<string>("medium");
  var [showInfo, setShowInfo] = useState<boolean>(false);
  var [copiedField, setCopiedField] = useState<string | null>(null);
  var [isRenaming, setIsRenaming] = useState<boolean>(false);
  var [renameValue, setRenameValue] = useState<string>("");
  var [showContext, setShowContext] = useState<boolean>(false);
  var infoRef = useRef<HTMLButtonElement>(null);
  var infoPanelRef = useRef<HTMLDivElement>(null);
  var contextBarRef = useRef<HTMLButtonElement>(null);
  var contextPanelRef = useRef<HTMLDivElement>(null);
  var renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(function () {
    var el = scrollParentRef.current;
    if (!el) return;
    var scrollEl = el;
    function handleScroll() {
      var distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      setIsNearBottom(distanceFromBottom < 200);
    }
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return function () { scrollEl.removeEventListener("scroll", handleScroll); };
  }, []);

  var virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: function () {
      return scrollParentRef.current;
    },
    estimateSize: function () {
      return 80;
    },
    overscan: 15,
  });

  var scrollToBottom = useCallback(function () {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: "smooth" });
    }
  }, [messages.length, virtualizer]);

  useEffect(
    function () {
      if (messages.length === 0) {
        prevLengthRef.current = 0;
        isLiveChatRef.current = false;
        return;
      }
      var prevLen = prevLengthRef.current;
      var delta = messages.length - prevLen;
      prevLengthRef.current = messages.length;

      if (prevLen === 0 && delta > 1) {
        isLiveChatRef.current = false;
        var count = messages.length;
        var virt = virtualizer;
        requestAnimationFrame(function () {
          virt.scrollToIndex(count - 1, { align: "end" });
          requestAnimationFrame(function () {
            virt.scrollToIndex(count - 1, { align: "end" });
          });
        });
        return;
      }

      isLiveChatRef.current = true;
      scrollToBottom();
    },
    [messages.length, scrollToBottom]
  );

  useEffect(
    function () {
      if (isProcessing && isLiveChatRef.current) {
        scrollToBottom();
      }
    },
    [isProcessing, scrollToBottom]
  );

  useEffect(function () {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (
        infoPanelRef.current && !infoPanelRef.current.contains(e.target as Node) &&
        infoRef.current && !infoRef.current.contains(e.target as Node)
      ) {
        setShowInfo(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [showInfo]);

  useEffect(function () {
    if (!showContext) return;
    function handleClick(e: MouseEvent) {
      if (
        contextPanelRef.current && !contextPanelRef.current.contains(e.target as Node) &&
        contextBarRef.current && !contextBarRef.current.contains(e.target as Node)
      ) {
        setShowContext(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [showContext]);

  useEffect(function () {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  function handleCopy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(function () { setCopiedField(null); }, 1500);
  }

  function handleRenameStart() {
    setRenameValue(activeSessionTitle || "");
    setIsRenaming(true);
  }

  function handleRenameCommit() {
    if (renameValue.trim() && activeSessionId) {
      if (renameValue.trim() !== activeSessionTitle) {
        ws.send({ type: "session:rename", sessionId: activeSessionId, title: renameValue.trim() });
        setSessionTitle(renameValue.trim());
      }
    }
    setIsRenaming(false);
    setRenameValue("");
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleRenameCommit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
      setRenameValue("");
    }
  }

  function formatTokens(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  var SEGMENT_COLORS: Record<string, string> = {
    system: "var(--color-neutral)",
    builtin_tools: "var(--color-info)",
    instructions: "var(--color-success)",
    memory: "var(--color-warning)",
    user: "var(--color-primary)",
    assistant: "var(--color-secondary)",
    tool_results: "var(--color-accent)",
  };
  var MCP_HUES = [180, 160, 140, 200, 220];
  function getSegmentColor(id: string): string {
    if (SEGMENT_COLORS[id]) return SEGMENT_COLORS[id];
    if (id.startsWith("mcp_")) {
      var idx = 0;
      for (var c = 0; c < id.length; c++) idx += id.charCodeAt(c);
      return "oklch(0.65 0.15 " + MCP_HUES[idx % MCP_HUES.length] + ")";
    }
    return "oklch(0.5 0.1 250)";
  }

  var contextPercent = 0;
  var contextFilled = 0;
  if (contextUsage && contextUsage.contextWindow > 0) {
    contextFilled = contextUsage.inputTokens + contextUsage.cacheReadTokens + contextUsage.cacheCreationTokens;
    contextPercent = Math.min(100, Math.round((contextFilled / contextUsage.contextWindow) * 100));
  }

  var autocompactPercent = contextBreakdown ? Math.round((contextBreakdown.autocompactAt / contextBreakdown.contextWindow) * 100) : 90;
  var isApproachingCompact = contextPercent >= autocompactPercent - 10;
  var isCritical = contextPercent >= autocompactPercent;

  var resumeCommand = activeSessionId && activeProject
    ? "cd " + activeProject.path + " && claude --resume " + activeSessionId
    : activeSessionId
    ? "claude --resume " + activeSessionId
    : "";

  var virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden relative">
      <div className="navbar bg-base-100 border-b border-base-300 min-h-12 px-4 flex-shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {isRenaming ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={function (e) { setRenameValue(e.target.value); }}
              onBlur={handleRenameCommit}
              onKeyDown={handleRenameKeyDown}
              className="input input-sm input-bordered text-sm font-semibold w-full max-w-[280px] bg-base-300 border-base-content/15"
            />
          ) : (
            <>
              <span className="text-sm font-semibold text-base-content truncate">
                {activeSessionTitle || (activeSessionId ? "Session" : "New Session")}
              </span>
              {activeSessionId && (
                <button
                  onClick={handleRenameStart}
                  aria-label="Rename session"
                  className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content/70 transition-colors"
                >
                  <Pencil size={12} />
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-1.5 items-center relative">
          {activeSessionId && (
            <button
              ref={contextBarRef}
              onClick={function () { setShowContext(!showContext); }}
              aria-label="Context usage"
              className={"flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors " + (showContext ? "bg-base-300" : "hover:bg-base-300/50")}
            >
              <div className="w-16 h-1.5 rounded-full bg-base-300 overflow-hidden relative">
                <div
                  className={"h-full rounded-full transition-all duration-300 " + (isCritical ? "bg-error animate-pulse" : isApproachingCompact ? "bg-warning" : "bg-primary/60")}
                  style={{ width: Math.max(contextPercent, 1) + "%" }}
                />
              </div>
              <span className={"text-[10px] font-mono tabular-nums " + (isCritical ? "text-error" : isApproachingCompact ? "text-warning" : "text-base-content/40")}>
                {contextPercent}%
              </span>
            </button>
          )}
          {activeSessionId && (
            <button
              ref={infoRef}
              onClick={function () { setShowInfo(!showInfo); }}
              aria-label="Session info"
              className={"btn btn-ghost btn-sm btn-square transition-colors " + (showInfo ? "text-primary" : "text-base-content/50 hover:text-base-content/70")}
            >
              <Info size={15} />
            </button>
          )}
          {!activeSessionId && (
            <button
              aria-label="Session info"
              disabled
              className="btn btn-ghost btn-sm btn-square text-base-content/30 opacity-40 cursor-not-allowed"
            >
              <Info size={15} />
            </button>
          )}
          <button
            aria-label="Open terminal"
            title="Coming soon"
            disabled
            className="btn btn-ghost btn-sm btn-square text-base-content/30 opacity-40 cursor-not-allowed"
          >
            <Terminal size={15} />
          </button>

          {showContext && activeSessionId && (
            <div
              ref={contextPanelRef}
              className="absolute top-full right-0 mt-1 z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-xl p-3 min-w-[300px] max-w-[340px]"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest text-base-content/40 font-mono font-bold">Context Window</div>
                  <span className={"text-xs font-mono font-bold tabular-nums " + (isCritical ? "text-error" : isApproachingCompact ? "text-warning" : "text-primary")}>
                    {contextPercent}%
                  </span>
                </div>

                {contextBreakdown ? (
                  <>
                    <div className="relative">
                      <div className="w-full h-3 rounded bg-base-200 overflow-hidden flex">
                        {contextBreakdown.segments.filter(function (seg) {
                          return seg.tokens > 0;
                        }).map(function (seg) {
                          var pct = (seg.tokens / contextBreakdown!.contextWindow) * 100;
                          if (pct < 0.2) return null;
                          return (
                            <div
                              key={seg.id}
                              className="h-full transition-all duration-300"
                              style={{ width: pct + "%", backgroundColor: getSegmentColor(seg.id) }}
                            />
                          );
                        })}
                      </div>
                      <div
                        className="absolute top-0 w-px h-full bg-base-content/25"
                        style={{ left: autocompactPercent + "%" }}
                        title={"Auto-compact at " + autocompactPercent + "%"}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] font-mono tabular-nums text-base-content/50">
                      <span>{formatTokens(contextFilled)} used</span>
                      <span>{formatTokens(contextBreakdown.contextWindow)} total</span>
                    </div>

                    <div className="border-t border-base-content/10 pt-2.5 flex flex-col gap-0.5">
                      {contextBreakdown.segments.filter(function (seg) {
                        return seg.tokens > 0;
                      }).map(function (seg) {
                        var pct = contextBreakdown!.contextWindow > 0 ? ((seg.tokens / contextBreakdown!.contextWindow) * 100) : 0;
                        return (
                          <div key={seg.id} className="flex items-center justify-between py-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: getSegmentColor(seg.id) }} />
                              <span className="text-[11px] text-base-content/50 truncate">{seg.label}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                              <span className="text-[11px] font-mono tabular-nums text-base-content/70">
                                {seg.estimated ? "~" : ""}{formatTokens(seg.tokens)}
                              </span>
                              <span className="text-[10px] font-mono tabular-nums text-base-content/30 w-9 text-right">{pct < 1 ? "<1" : Math.round(pct)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(function () {
                      var totalUsed = contextBreakdown!.segments.reduce(function (sum, seg) { return sum + seg.tokens; }, 0);
                      var available = contextBreakdown!.contextWindow - totalUsed;
                      if (available > 0) {
                        return (
                          <div className="border-t border-base-content/10 pt-2 flex items-center justify-between">
                            <span className="text-[11px] text-base-content/30">Available</span>
                            <span className="text-[11px] font-mono tabular-nums text-base-content/40">{formatTokens(available)}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                ) : (
                  <>
                    <div className="w-full h-3 rounded bg-base-200 overflow-hidden">
                      <div
                        className={"h-full transition-all duration-300 " + (isCritical ? "bg-error" : isApproachingCompact ? "bg-warning" : "bg-primary/60")}
                        style={{ width: contextPercent + "%" }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] font-mono tabular-nums text-base-content/50">
                      <span>{formatTokens(contextFilled)} used</span>
                      <span>{formatTokens(contextUsage?.contextWindow || 0)} total</span>
                    </div>

                    <div className="text-[11px] text-base-content/30 text-center py-1">
                      Computing breakdown...
                    </div>
                  </>
                )}

                {isCritical && (
                  <div className="text-[10px] font-mono px-2 py-1.5 rounded bg-error/10 text-error">
                    Context nearly full — session will auto-compact soon
                  </div>
                )}
                {isApproachingCompact && !isCritical && (
                  <div className="text-[10px] font-mono px-2 py-1.5 rounded bg-warning/10 text-warning">
                    Approaching auto-compact threshold
                  </div>
                )}
              </div>
            </div>
          )}

          {showInfo && activeSessionId && (
            <div
              ref={infoPanelRef}
              className="absolute top-full right-0 mt-1 z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-xl p-3 min-w-[340px]"
            >
              <div className="flex flex-col gap-2.5">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-base-content/40 mb-1 font-mono font-bold">Session ID</div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[12px] font-mono text-base-content/70 bg-base-200 px-2 py-1 rounded flex-1 truncate select-all">
                      {activeSessionId}
                    </code>
                    <button
                      onClick={function () { handleCopy(activeSessionId!, "sessionId"); }}
                      aria-label="Copy session ID"
                      className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content/70 flex-shrink-0"
                    >
                      {copiedField === "sessionId" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-base-content/40 mb-1 font-mono font-bold">Resume Command</div>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[12px] font-mono text-base-content/70 bg-base-200 px-2 py-1 rounded flex-1 truncate select-all">
                      {resumeCommand}
                    </code>
                    <button
                      onClick={function () { handleCopy(resumeCommand, "resume"); }}
                      aria-label="Copy resume command"
                      className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content/70 flex-shrink-0"
                    >
                      {copiedField === "resume" ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollParentRef}
        className="flex-1 overflow-y-auto min-h-0 bg-lattice-grid"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center p-10 h-full">
            <div className="text-center max-w-[360px]">
              <div className="text-primary mb-4 flex justify-center">
                <LatticeLogomark size={48} />
              </div>
              <p className="text-[17px] font-mono font-bold text-base-content mb-2 tracking-tight">
                {activeSessionId
                  ? "Start the conversation"
                  : activeProject
                  ? "Create or select a session"
                  : "Select a project"}
              </p>
              <p className="text-[13px] text-base-content/40 leading-relaxed">
                {activeSessionId
                  ? "Type a message below to begin chatting with Claude."
                  : activeProject
                  ? "Click the + button in the sidebar to start a new session."
                  : "Choose a project from the rail to get started."}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() + "px" }}
          >
            <div
              className="absolute top-0 left-0 w-full"
              style={{
                transform: "translateY(" + (virtualItems.length > 0 ? virtualItems[0].start : 0) + "px)",
              }}
            >
              {virtualItems.map(function (virtualItem) {
                var msg = messages[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className={virtualItem.index === 0 ? "pt-4" : ""}
                  >
                    <Message message={msg} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex px-5 py-3 gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-primary" />
            </div>
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(function (i) {
                return (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-base-content/30"
                    style={{
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: i * 0.2 + "s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && !isNearBottom && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={scrollToBottom}
            className="btn btn-sm btn-circle bg-base-300 border border-base-content/15 shadow-lg hover:bg-base-200 text-base-content/60 hover:text-base-content transition-all duration-150"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      )}

      <StatusBar status={currentStatus} />

      <div className="flex-shrink-0 border-t border-base-300 bg-base-200">
        <ChatInput onSend={function (text) { sendMessage(text, selectedModel, selectedEffort); }} disabled={isProcessing || !activeSessionId} />
        <div className="flex items-center justify-between px-5 pb-2.5 -mt-1">
          <div className="text-[11px] text-base-content/25">
            Enter to send &bull; Shift+Enter for newline
          </div>
          <div className="flex items-center gap-1 text-[11px] text-base-content/60">
            <PermissionModeSelector />
            <span className="text-base-content/20">|</span>
            <ModelSelector onChange={function (state) { setSelectedModel(state.model); setSelectedEffort(state.effort); }} />
          </div>
        </div>
      </div>
    </div>
  );
}
