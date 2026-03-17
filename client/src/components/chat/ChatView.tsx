import { useEffect, useRef } from "react";
import { Sparkles, Terminal, Info } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSession } from "../../hooks/useSession";
import { Message } from "./Message";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./ModelSelector";

export function ChatView() {
  var { messages, isProcessing, sendMessage, activeSessionId } = useSession();
  var scrollParentRef = useRef<HTMLDivElement>(null);
  var bottomRef = useRef<HTMLDivElement>(null);
  var prevLengthRef = useRef<number>(0);

  var virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: function () {
      return scrollParentRef.current;
    },
    estimateSize: function () {
      return 80;
    },
    overscan: 10,
  });

  useEffect(
    function () {
      if (messages.length > prevLengthRef.current) {
        prevLengthRef.current = messages.length;
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    },
    [messages.length]
  );

  useEffect(
    function () {
      if (isProcessing && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    },
    [isProcessing]
  );

  var virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col h-full w-full bg-base-100 overflow-hidden">
      <div className="navbar bg-base-100 border-b border-base-300 min-h-12 px-4 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-base-content truncate">
            {activeSessionId ? "Session" : "New Session"}
          </span>
        </div>
        <div className="flex gap-1 items-center">
          <button
            aria-label="Session info"
            className="btn btn-ghost btn-sm btn-square text-base-content/30 hover:text-base-content transition-colors duration-200"
          >
            <Info size={15} />
          </button>
          <button
            aria-label="Open terminal"
            className="btn btn-ghost btn-sm btn-square text-base-content/30 hover:text-base-content transition-colors duration-200"
          >
            <Terminal size={15} />
          </button>
        </div>
      </div>

      <div
        ref={scrollParentRef}
        className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-lattice-grid"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center mx-auto mb-5">
                <Sparkles size={24} strokeWidth={1.5} className="text-primary/60" />
              </div>
              <p className="text-base font-semibold text-base-content mb-2 font-mono">
                {activeSessionId ? "Start the conversation" : "Select a project to start"}
              </p>
              <p className="text-sm text-base-content/40 leading-relaxed">
                {activeSessionId
                  ? "Type a message below to begin chatting with Claude."
                  : "Choose a project from the sidebar, then create or select a session to begin chatting with Claude."}
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

        <div ref={bottomRef} className="h-4 flex-shrink-0" />
      </div>

      <div className="flex-shrink-0 border-t border-base-300 bg-base-200">
        <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
          <div className="ml-auto">
            <ModelSelector />
          </div>
        </div>
        <ChatInput onSend={sendMessage} disabled={isProcessing || !activeSessionId} />
      </div>
    </div>
  );
}
