import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Terminal, Info, ArrowDown, Pencil, Copy, Check, Menu, AlertTriangle, Zap, Square, X, Bookmark, RefreshCw, Loader2, Activity } from "lucide-react";
import { LatticeLogomark } from "../ui/LatticeLogomark";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSession } from "../../hooks/useSession";
import { useProjects } from "../../hooks/useProjects";
import { useWebSocket } from "../../hooks/useWebSocket";
import { setSessionTitle, setIsProcessing, setCurrentStatus, setWasInterrupted, setPendingPrefill, setPendingAutoSend, getSessionStore, invalidateSessionMessageCache } from "../../stores/session";
import { openSettings, openProjectSettings } from "../../stores/sidebar";
import { openTab, updateSessionTabTitle } from "../../stores/workspace";
import { builtinCommands } from "../../commands";
import { Message } from "./Message";
import { ToolGroup } from "./ToolGroup";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";
import { PermissionModeSelector } from "./PermissionModeSelector";
import { StatusBar } from "./StatusBar";
import { useSidebar } from "../../hooks/useSidebar";
import { useOnline } from "../../hooks/useOnline";
import { useSpinnerVerb } from "../../hooks/useSpinnerVerb";
import { useBookmarks } from "../../hooks/useBookmarks";
import { formatSessionTitle } from "../../utils/formatSessionTitle";
import { useStore } from "@tanstack/react-store";
import { getContextAnalyzerStore, dismissAnomaly } from "../../stores/context-analyzer";

function SessionLoadingState({ fileSize }: { fileSize: number | null }) {
  const [progress, setProgress] = useState(0);

  useEffect(function () {
    const start = Date.now();
    let raf = 0;
    // Scale the time constant based on file size:
    // ~50KB → 800ms, ~500KB → 2s, ~5MB → 8s, unknown → 3s
    const timeConstant = fileSize != null
      ? Math.max(800, Math.min(fileSize / 60, 8000))
      : 3000;

    function tick() {
      const elapsed = Date.now() - start;
      const raw = 1 - Math.exp(-elapsed / timeConstant);
      setProgress(Math.min(raw * 90, 90));
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return function () { cancelAnimationFrame(raf); };
  }, [fileSize]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
      <div className="flex flex-col items-center gap-3 w-full max-w-[260px]">
        <p className="text-[11px] font-mono text-base-content/40 tracking-wide">Loading session…</p>
        <div className="w-full h-[3px] rounded-full bg-base-content/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary/60 transition-all duration-300 ease-out"
            style={{ width: progress + "%" }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChatView({ sessionId: tabSessionId, projectSlug: tabProjectSlug }: { sessionId?: string; projectSlug?: string } = {}) {
  const { messages, isProcessing, sendMessage, activeSessionId, activeSessionTitle, currentStatus, contextUsage, contextBreakdown, lastResponseCost, lastResponseDuration, historyLoading, historyLoadingFileSize, historyHasMore, loadMoreHistory, wasInterrupted, promptSuggestion, failedInput, clearFailedInput, messageQueue, enqueueMessage, removeQueuedMessage, updateQueuedMessage, isPlanMode, pendingPrefill, activateSession, budgetStatus, budgetExceeded, sendBudgetOverride, dismissBudgetExceeded } = useSession();
  const { activeProject } = useProjects();
  const { toggleDrawer } = useSidebar();
  const activeAnomalies = useStore(getContextAnalyzerStore(), function (s) {
    return s.activeSession.anomalies.filter(function (a) { return !a.dismissed; });
  });

  useEffect(function () {
    if (!tabSessionId || !tabProjectSlug) return;
    activateSession(tabProjectSlug, tabSessionId);
  }, [tabSessionId, tabProjectSlug]);
  const online = useOnline();
  const ws = useWebSocket();
  const spinnerVerb = useSpinnerVerb(isProcessing);
  const { bookmarks, requestSessionBookmarks } = useBookmarks();
  const [showBookmarkDropdown, setShowBookmarkDropdown] = useState<boolean>(false);
  const bookmarkDropdownRef = useRef<HTMLDivElement>(null);
  const bookmarkBtnRef = useRef<HTMLButtonElement>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef<number>(0);
  const isLiveChatRef = useRef<boolean>(false);
  const [isNearBottom, setIsNearBottom] = useState<boolean>(true);
  const isNearBottomRef = useRef<boolean>(true);
  const [isMobile, setIsMobile] = useState<boolean>(function () { return typeof window !== "undefined" && window.innerWidth < 640; });
  const [selectedModel, setSelectedModel] = useState<string>("default");
  const [selectedEffort, setSelectedEffort] = useState<string>("medium");
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [prefillText, setPrefillText] = useState<string | null>(null);

  useEffect(function () {
    if (pendingPrefill && !historyLoading) {
      setPrefillText(pendingPrefill);
      setPendingPrefill(null);
    }
  }, [pendingPrefill, historyLoading]);

  const { pendingAutoSend, specContext } = useSession();

  useEffect(function () {
    if (pendingAutoSend && activeSessionId && !historyLoading && !isProcessing) {
      const text = pendingAutoSend;
      sendMessage(text);
      setPendingAutoSend(null);
    }
  }, [pendingAutoSend, activeSessionId, historyLoading, isProcessing]);

  useEffect(function () {
    if (activeSessionId && !historyLoading) {
      requestSessionBookmarks();
    }
  }, [activeSessionId, historyLoading]);

  useEffect(function () {
    if (!showBookmarkDropdown) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (bookmarkDropdownRef.current && bookmarkDropdownRef.current.contains(target)) return;
      if (bookmarkBtnRef.current && bookmarkBtnRef.current.contains(target)) return;
      setShowBookmarkDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return function () { document.removeEventListener("mousedown", handleClick); };
  }, [showBookmarkDropdown]);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameValue, setRenameValue] = useState<string>("");
  const [showContext, setShowContext] = useState<boolean>(false);
  const infoRef = useRef<HTMLButtonElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const contextBarRef = useRef<HTMLButtonElement>(null);
  const contextBarMobileRef = useRef<HTMLButtonElement>(null);
  const contextPanelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(function () {
    const el = scrollParentRef.current;
    if (!el) return;
    const scrollEl = el;
    function handleScroll() {
      const near = (scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight) < 200;
      if (near !== isNearBottomRef.current) {
        isNearBottomRef.current = near;
        setIsNearBottom(near);
      }
    }
    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return function () { scrollEl.removeEventListener("scroll", handleScroll); };
  }, []);

  useEffect(function () {
    function handleResize() {
      setIsMobile(window.innerWidth < 640);
    }
    window.addEventListener("resize", handleResize);
    return function () { window.removeEventListener("resize", handleResize); };
  }, []);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: function () {
      return scrollParentRef.current;
    },
    estimateSize: function (index) {
      const msg = messages[index];
      if (!msg) return 120;
      if (msg.type === "tool_start") return 52;
      if (msg.type === "user") return 100;
      return 200;
    },
    overscan: isMobile ? 10 : 20,
  });

  const scrollToBottom = useCallback(function () {
    if (messages.length === 0) return;
    if (isMobile) {
      const el = scrollParentRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    } else {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [messages.length, virtualizer, isMobile]);

  useEffect(
    function () {
      if (messages.length === 0) {
        prevLengthRef.current = 0;
        isLiveChatRef.current = false;
        return;
      }
      const prevLen = prevLengthRef.current;
      const delta = messages.length - prevLen;
      prevLengthRef.current = messages.length;

      if (prevLen === 0 && delta > 1) {
        isLiveChatRef.current = false;
        if (isMobile) {
          requestAnimationFrame(function () {
            const el = scrollParentRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        } else {
          const count = messages.length;
          const virt = virtualizer;
          requestAnimationFrame(function () {
            virt.scrollToIndex(count - 1, { align: "end" });
          });
        }
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
      const target = e.target as Node;
      if (contextPanelRef.current && contextPanelRef.current.contains(target)) return;
      if (contextBarRef.current && contextBarRef.current.contains(target)) return;
      if (contextBarMobileRef.current && contextBarMobileRef.current.contains(target)) return;
      setShowContext(false);
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
        updateSessionTabTitle(activeSessionId, renameValue.trim());
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

  const SEGMENT_COLORS: Record<string, string> = {
    system: "var(--color-neutral)",
    builtin_tools: "var(--color-info)",
    instructions: "var(--color-success)",
    memory: "var(--color-warning)",
    user: "var(--color-primary)",
    assistant: "var(--color-secondary)",
    tool_results: "var(--color-accent)",
  };
  const MCP_HUES = [180, 160, 140, 200, 220];
  function getSegmentColor(id: string): string {
    if (SEGMENT_COLORS[id]) return SEGMENT_COLORS[id];
    if (id.startsWith("mcp_")) {
      let idx = 0;
      for (let c = 0; c < id.length; c++) idx += id.charCodeAt(c);
      return "oklch(0.65 0.15 " + MCP_HUES[idx % MCP_HUES.length] + ")";
    }
    return "oklch(0.5 0.1 250)";
  }

  const contextInfo = useMemo(function () {
    let percent = 0;
    let filled = 0;
    if (contextUsage && contextUsage.contextWindow > 0) {
      filled = contextUsage.inputTokens + contextUsage.outputTokens + contextUsage.cacheReadTokens + contextUsage.cacheCreationTokens;
      percent = Math.min(100, Math.round((filled / contextUsage.contextWindow) * 100));
    }
    const autocompact = contextBreakdown && contextBreakdown.contextWindow > 0 ? Math.round((contextBreakdown.autocompactAt / contextBreakdown.contextWindow) * 100) : 90;
    return {
      contextPercent: percent,
      contextFilled: filled,
      autocompactPercent: autocompact,
      isApproachingCompact: percent >= autocompact - 10,
      isCritical: percent >= autocompact,
    };
  }, [contextUsage, contextBreakdown]);

  const contextPercent = contextInfo.contextPercent;
  const contextFilled = contextInfo.contextFilled;
  const autocompactPercent = contextInfo.autocompactPercent;
  const isApproachingCompact = contextInfo.isApproachingCompact;
  const isCritical = contextInfo.isCritical;

  const resumeCommand = activeSessionId && activeProject
    ? "cd " + activeProject.path + " && claude --resume " + activeSessionId
    : activeSessionId
    ? "claude --resume " + activeSessionId
    : "";

  function handleClientCommand(name: string, args: string): boolean {
    switch (name) {
      case "clear":
      case "reset":
      case "new":
        if (activeProject?.slug) {
          ws.send({ type: "session:create", projectSlug: activeProject.slug });
        }
        return true;
      case "copy": {
        let lastAssistant: typeof messages[0] | undefined;
        for (let ci = messages.length - 1; ci >= 0; ci--) {
          if (messages[ci].type === "assistant") { lastAssistant = messages[ci]; break; }
        }
        if (lastAssistant?.text) {
          navigator.clipboard.writeText(lastAssistant.text);
        }
        return true;
      }
      case "export": {
        const lines = messages.map(function (m) {
          const role = m.type === "user" ? "User" : m.type === "assistant" ? "Assistant" : m.type;
          return role + ": " + (m.text || m.content || "");
        });
        const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (activeSessionTitle || "conversation") + ".txt";
        a.click();
        URL.revokeObjectURL(url);
        return true;
      }
      case "rename": {
        if (args && activeSessionId) {
          ws.send({ type: "session:rename", sessionId: activeSessionId, title: args });
          setSessionTitle(args);
          updateSessionTabTitle(activeSessionId, args);
        } else {
          handleRenameStart();
        }
        return true;
      }
      case "theme":
        openSettings("appearance");
        return true;
      case "config":
      case "settings":
        openSettings("appearance");
        return true;
      case "permissions":
      case "allowed-tools":
        if (activeProject?.slug) openProjectSettings("permissions");
        return true;
      case "memory":
        if (activeProject?.slug) openProjectSettings("memory");
        return true;
      case "skills":
        if (activeProject?.slug) openProjectSettings("skills");
        return true;
      case "plan":
        ws.send({ type: "chat:set_permission_mode", mode: "plan" });
        return true;
      case "cost":
      case "context":
        setShowInfo(true);
        return true;
      default:
        return false;
    }
  }

  function handleCancel() {
    ws.send({ type: "chat:cancel" });
    setIsProcessing(false);
    setCurrentStatus(null);
    setWasInterrupted(true);
  }

  function handleSend(text: string, attachmentIds: string[]) {
    if (text.startsWith("/")) {
      const parts = text.split(/\s+/);
      const cmdName = parts[0].slice(1).toLowerCase();
      const cmdArgs = parts.slice(1).join(" ");

      let isBuiltin = false;
      for (let i = 0; i < builtinCommands.length; i++) {
        const cmd = builtinCommands[i];
        if (cmd.name === cmdName || (cmd.aliases && cmd.aliases.indexOf(cmdName) !== -1)) {
          isBuiltin = true;
          break;
        }
      }

      if (isBuiltin && handleClientCommand(cmdName, cmdArgs)) return;
    }

    if (isProcessing) {
      enqueueMessage(text);
      return;
    }
    sendMessage(text, attachmentIds, selectedModel, selectedEffort);
  }

  const virtualItems = virtualizer.getVirtualItems();

  const lastAssistantIndex = useMemo(function () {
    if (isProcessing || lastResponseCost == null) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "assistant") return i;
    }
    return -1;
  }, [messages, isProcessing, lastResponseCost]);

  const cumulativeCost = useMemo(function () {
    return messages.reduce(function (sum, m) {
      return sum + (m.costEstimate || 0);
    }, 0);
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden relative">
      <div className="bg-base-100 border-b border-base-300 flex-shrink-0 px-2 sm:px-4">
        <div className="flex items-center h-11 gap-1.5">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden"
            aria-label="Toggle sidebar"
            onClick={toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
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
                  {formatSessionTitle(activeSessionTitle) || (activeSessionId ? "Session" : "New Session")}
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
                {activeSessionId && bookmarks.length > 0 && (
                  <div className="relative">
                    <button
                      ref={bookmarkBtnRef}
                      onClick={function () { setShowBookmarkDropdown(!showBookmarkDropdown); }}
                      aria-label="View bookmarks"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-warning/70 hover:text-warning hover:bg-warning/10 transition-colors"
                    >
                      <Bookmark size={11} />
                      <span>{bookmarks.length}</span>
                    </button>
                    {showBookmarkDropdown && (
                      <div
                        ref={bookmarkDropdownRef}
                        className="absolute top-full left-0 mt-1 z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-xl py-1 w-[280px] max-h-[300px] overflow-y-auto"
                      >
                        <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-base-content/40 font-mono font-bold">
                          Bookmarks
                        </div>
                        {bookmarks.map(function (bm) {
                          return (
                            <button
                              key={bm.id}
                              type="button"
                              onClick={function () {
                                setShowBookmarkDropdown(false);
                                const el = document.getElementById("msg-" + bm.messageUuid);
                                if (el) {
                                  el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
                                  el.classList.add("ring-2", "ring-warning/40");
                                  setTimeout(function () { el!.classList.remove("ring-2", "ring-warning/40"); }, 2000);
                                }
                              }}
                              className="flex items-start gap-2 w-full px-2.5 py-1.5 hover:bg-base-content/5 transition-colors text-left"
                            >
                              <Bookmark size={10} className="text-warning/60 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] text-base-content/60 truncate">{bm.messageText}</div>
                                <div className="text-[9px] text-base-content/30 font-mono">{bm.messageType}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            </div>
            {specContext && (
              <span className="text-[10px] text-base-content/40 truncate pl-0.5">
                {"Spec: " + specContext.specTitle}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 items-center relative">
            {activeSessionId && cumulativeCost > 0 && (
              <span className="hidden sm:flex items-center text-[10px] font-mono tabular-nums text-base-content/35">
                ${cumulativeCost.toFixed(4)}
              </span>
            )}
            {activeSessionId && (
              <button
                ref={contextBarRef}
                onClick={function () { setShowContext(!showContext); }}
                aria-label="Context usage"
                className={"hidden sm:flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors " + (showContext ? "bg-base-300" : "hover:bg-base-300/50")}
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
                onClick={function () {
                  const state = getSessionStore().state;
                  if (state.activeProjectSlug && state.activeSessionId) {
                    invalidateSessionMessageCache(state.activeSessionId);
                    getSessionStore().setState(function (s) { return { ...s, historyLoading: true, messages: [] }; });
                    ws.send({ type: "session:activate", projectSlug: state.activeProjectSlug, sessionId: state.activeSessionId, refresh: true } as any);
                  }
                }}
                aria-label="Refresh conversation"
                className={"btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content/70 transition-colors" + (historyLoading ? " animate-spin" : "")}
              >
                {historyLoading ? <Loader2 size={14} /> : <RefreshCw size={14} />}
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
              onClick={function () { openTab("terminal"); }}
              className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content/70"
            >
              <Terminal size={15} />
            </button>

          {showContext && activeSessionId && (
            <div
              ref={contextPanelRef}
              className="absolute top-full right-0 mt-1 z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-xl p-3 w-[calc(100vw-24px)] sm:min-w-[300px] sm:w-auto max-w-[340px]"
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
                          const pct = (seg.tokens / contextBreakdown!.contextWindow) * 100;
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
                        const pct = contextBreakdown!.contextWindow > 0 ? ((seg.tokens / contextBreakdown!.contextWindow) * 100) : 0;
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
                      const totalUsed = contextBreakdown!.segments.reduce(function (sum, seg) { return sum + seg.tokens; }, 0);
                      const available = contextBreakdown!.contextWindow - totalUsed;
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
                <button
                  type="button"
                  onClick={function () { openTab("context"); setShowContext(false); }}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-primary/70 hover:text-primary transition-colors pt-1"
                >
                  <Activity size={10} />
                  Open Context Analyzer
                </button>
              </div>
            </div>
          )}

          {showInfo && activeSessionId && (
            <div
              ref={infoPanelRef}
              className="absolute top-full right-0 mt-1 z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-xl p-3 w-[calc(100vw-24px)] sm:min-w-[340px] sm:w-auto max-w-[380px]"
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
                {selectedModel && selectedModel !== "default" && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-base-content/40 mb-1 font-mono font-bold">Model</div>
                    <code className="text-[12px] font-mono text-base-content/70 bg-base-200 px-2 py-1 rounded block truncate">
                      {selectedModel}
                    </code>
                  </div>
                )}
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
        {activeSessionId && (
          <button
            ref={contextBarMobileRef}
            onClick={function () { setShowContext(!showContext); }}
            aria-label="Context usage"
            className={"sm:hidden flex items-center gap-1.5 px-1.5 pb-1 rounded transition-colors w-full " + (showContext ? "bg-base-300" : "hover:bg-base-300/50")}
          >
            <div className="flex-1 h-1.5 rounded-full bg-base-300 overflow-hidden relative">
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
      </div>
      {isPlanMode && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/8 border-b border-primary/15">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-mono font-medium text-primary/60 uppercase tracking-wider">Plan Mode</span>
        </div>
      )}
      <div
        ref={scrollParentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-lattice-grid"
        aria-live="polite"
        aria-relevant="additions"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {historyHasMore && messages.length > 0 && (
          <div className="flex justify-center py-3">
            <button
              onClick={loadMoreHistory}
              className="text-[11px] text-base-content/30 hover:text-base-content/50 font-mono transition-colors"
            >
              Load older messages
            </button>
          </div>
        )}
        {messages.length === 0 && historyLoading ? (
          <SessionLoadingState fileSize={historyLoadingFileSize} />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center p-10 h-full">
            <div className="text-center max-w-[360px]">
              <div className="text-base-content/10 mb-4 flex justify-center">
                <LatticeLogomark size={40} />
              </div>
              <p className="text-[15px] font-mono font-semibold text-base-content/60 mb-1.5">
                {activeSessionId
                  ? "What are you working on?"
                  : activeProject
                  ? "Ready when you are"
                  : "Select a project"}
              </p>
              <p className="text-[12px] text-base-content/30 leading-relaxed">
                {activeSessionId
                  ? "Type a message below or press / for commands."
                  : activeProject
                  ? "Start a new session from the sidebar to chat with Claude."
                  : "Choose a project from the rail to get started."}
              </p>
            </div>
          </div>
        ) : isMobile ? (
          <div className="pt-4">
            {messages.map(function (msg, idx) {
              if (msg.type === "tool_start") {
                let groupStart = idx;
                while (groupStart > 0 && messages[groupStart - 1].type === "tool_start") {
                  groupStart--;
                }
                let groupEnd = idx;
                while (groupEnd < messages.length - 1 && messages[groupEnd + 1].type === "tool_start") {
                  groupEnd++;
                }
                const groupSize = groupEnd - groupStart + 1;
                if (groupSize >= 2) {
                  if (idx === groupStart) {
                    const groupTools = messages.slice(groupStart, groupEnd + 1);
                    return <ToolGroup key={"tg-" + (groupTools[0].uuid || idx)} tools={groupTools} />;
                  }
                  return null;
                }
              }
              const isLastAssistant = idx === lastAssistantIndex;
              return (
                <Message
                  key={msg.uuid || ("msg-" + idx)}
                  message={msg}
                  responseCost={isLastAssistant ? lastResponseCost : undefined}
                  responseDuration={isLastAssistant ? lastResponseDuration : undefined}
                />
              );
            })}
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() + "px", paddingBottom: "24px" }}
          >
            <div
              className="absolute top-0 left-0 w-full will-change-transform"
              style={{
                transform: "translateY(" + (virtualItems.length > 0 ? virtualItems[0].start : 0) + "px)",
              }}
            >
              {virtualItems.map(function (virtualItem) {
                const msg = messages[virtualItem.index];
                const idx = virtualItem.index;

                if (msg.type === "tool_start") {
                  let groupStart = idx;
                  while (groupStart > 0 && messages[groupStart - 1].type === "tool_start") {
                    groupStart--;
                  }
                  let groupEnd = idx;
                  while (groupEnd < messages.length - 1 && messages[groupEnd + 1].type === "tool_start") {
                    groupEnd++;
                  }
                  const groupSize = groupEnd - groupStart + 1;

                  if (groupSize >= 2) {
                    if (idx === groupStart) {
                      const groupTools = messages.slice(groupStart, groupEnd + 1);
                      return (
                        <div
                          key={virtualItem.key}
                          data-index={virtualItem.index}
                          ref={virtualizer.measureElement}
                          className={virtualItem.index === 0 ? "pt-4" : ""}
                        >
                          <ToolGroup tools={groupTools} />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                      />
                    );
                  }
                }

                const isLastAssistant = virtualItem.index === lastAssistantIndex;
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className={virtualItem.index === 0 ? "pt-4" : ""}
                  >
                    <Message
                      message={msg}
                      responseCost={isLastAssistant ? lastResponseCost : undefined}
                      responseDuration={isLastAssistant ? lastResponseDuration : undefined}
                    />
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
      {isProcessing && (
        <div className="flex-shrink-0 flex items-center justify-center gap-4 my-4 pointer-events-none relative z-10">
          <div className="flex items-center gap-4 pointer-events-auto bg-base-200/90 border border-base-content/10 rounded-full px-5 py-2 shadow-lg">
            <span className="text-[14px] text-base-content/40 font-mono animate-pulse">{spinnerVerb}...</span>
            <button
              onClick={handleCancel}
              className="btn btn-ghost btn-sm text-error/70 hover:text-error gap-1.5"
            >
              <Square size={12} className="fill-current" />
              Stop
            </button>
          </div>
        </div>
      )}
      {messageQueue.length > 0 && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-2 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-base-content/30">Queued</div>
          {messageQueue.map(function (msg, i) {
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base-300/50 border border-base-content/10">
                <input
                  type="text"
                  value={msg}
                  onChange={function (e) { updateQueuedMessage(i, e.target.value); }}
                  className="flex-1 bg-transparent text-[12px] text-base-content outline-none"
                />
                <button
                  onClick={function () { removeQueuedMessage(i); }}
                  className="text-base-content/30 hover:text-base-content/60"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {wasInterrupted && !isProcessing && (
        <div className="flex items-center gap-2 px-3 sm:px-5 py-2 bg-warning/10 border-t border-warning/20">
          <AlertTriangle size={13} className="text-warning flex-shrink-0" />
          <span className="text-[12px] text-warning">Session was interrupted — send a message to continue</span>
        </div>
      )}
      {promptSuggestion && !isProcessing && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-2">
          <div className="flex items-center gap-1.5 max-w-full">
            <button
              onClick={function () { if (promptSuggestion) handleSend(promptSuggestion, []); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-[12px] text-primary/80 hover:bg-primary/15 hover:text-primary transition-colors min-w-0"
            >
              <Zap size={12} className="flex-shrink-0" />
              <span className="truncate">{promptSuggestion}</span>
            </button>
            <button
              onClick={function () { if (promptSuggestion) setPrefillText(promptSuggestion); }}
              aria-label="Edit suggestion"
              className="btn btn-ghost btn-xs btn-square text-primary/40 hover:text-primary/80 flex-shrink-0"
            >
              <Pencil size={12} />
            </button>
          </div>
        </div>
      )}
      {budgetExceeded && budgetStatus && (
        <div className="flex-shrink-0 border-t border-base-300 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-warning flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-base-content font-medium">
              Daily budget exceeded (${budgetStatus.dailySpend.toFixed(2)} / ${budgetStatus.dailyLimit.toFixed(2)})
            </div>
            <div className="text-[11px] text-base-content/50">Send anyway?</div>
          </div>
          <button
            onClick={sendBudgetOverride}
            className="px-3 py-1.5 rounded-lg bg-warning text-warning-content text-[12px] font-semibold hover:bg-warning/80 transition-colors"
          >
            Continue
          </button>
          <button
            onClick={dismissBudgetExceeded}
            className="px-3 py-1.5 rounded-lg border border-base-content/15 text-base-content/60 text-[12px] hover:bg-base-content/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      {activeAnomalies.length > 0 && (
        <div className="flex-shrink-0 px-2 sm:px-4 pb-1">
          {activeAnomalies.slice(-2).map(function (a, i) {
            return (
              <div key={a.toolId + "-" + a.timestamp + "-" + i} className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg bg-warning/10 border border-warning/15 text-xs font-mono">
                <AlertTriangle size={11} className="text-warning flex-shrink-0" />
                <span className="text-base-content/60 flex-1 min-w-0 truncate">
                  <span className="text-warning font-semibold">{a.toolName}</span> used {formatTokens(a.observed)} tokens (expected ~{formatTokens(a.expected)})
                </span>
                <button type="button" onClick={function () { dismissAnomaly(a.toolId, a.timestamp); }} className="text-base-content/25 hover:text-base-content/50 flex-shrink-0">
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex-shrink-0 border-t border-base-300 bg-base-200 px-2 sm:px-4 pb-3 pt-2">
        <ChatInput
          sessionId={activeSessionId}
          onSend={handleSend}
          disabled={!activeSessionId || !online || (budgetStatus !== null && budgetStatus.enforcement === "hard-block" && budgetStatus.dailySpend >= budgetStatus.dailyLimit)}
          disabledPlaceholder={
            (budgetStatus !== null && budgetStatus.enforcement === "hard-block" && budgetStatus.dailySpend >= budgetStatus.dailyLimit)
              ? "Daily budget exceeded ($" + budgetStatus.dailySpend.toFixed(2) + " / $" + budgetStatus.dailyLimit.toFixed(2) + ")"
              : undefined
          }
          failedInput={failedInput}
          onFailedInputConsumed={clearFailedInput}
          prefillText={prefillText}
          onPrefillConsumed={function () { setPrefillText(null); }}
          toolbarContent={
            <>
              <PermissionModeSelector />
              <span className="text-base-content/15 hidden sm:inline">·</span>
              <ModelSelector onChange={function (state) { setSelectedModel(state.model); setSelectedEffort(state.effort); }} />
            </>
          }
        />
      </div>
    </div>
  );
}
