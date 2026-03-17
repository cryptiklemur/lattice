import { useEffect, useRef } from "react";
import { Info, Terminal, Paperclip } from "lucide-react";
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
      <div className="h-12 flex-shrink-0 flex items-center px-5 border-b border-base-300 bg-base-100">
        <span className="text-[14px] font-semibold text-base-content truncate flex-1">
          {activeSessionId ? "Session" : "New Session"}
        </span>
        <div className="flex gap-1 items-center">
          <button
            aria-label="Session info"
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content"
          >
            <Info size={15} />
          </button>
          <button
            aria-label="Open terminal"
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content"
          >
            <Terminal size={15} />
          </button>
        </div>
      </div>

      <div
        ref={scrollParentRef}
        className="flex-1 overflow-y-auto flex flex-col min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center max-w-[360px]">
              <div className="w-12 h-12 rounded-xl bg-base-200 border border-base-300 flex items-center justify-center mx-auto mb-4">
                <Info size={22} strokeWidth={1.5} className="text-base-content/30" />
              </div>
              <p className="text-[15px] font-semibold text-base-content mb-2">
                {activeSessionId ? "Start the conversation" : "Select a project to start"}
              </p>
              <p className="text-[13px] text-base-content/40 leading-relaxed">
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
                    className={virtualItem.index === 0 ? "pt-3" : ""}
                  >
                    <Message message={msg} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex px-5 py-2 gap-2.5 items-center">
            <div className="w-6 h-6 rounded-full bg-base-200 border border-base-300 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-primary" />
            </div>
            <div className="flex gap-1 items-center">
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

        <div ref={bottomRef} className="h-3 flex-shrink-0" />
      </div>

      <div className="flex-shrink-0 border-t border-base-300 bg-base-200 pt-2.5">
        <div className="flex items-center gap-2 px-4 pb-2">
          <button
            aria-label="Attach file"
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-base-content"
          >
            <Paperclip size={15} />
          </button>
          <div className="ml-auto">
            <ModelSelector />
          </div>
        </div>

        <ChatInput onSend={sendMessage} disabled={isProcessing || !activeSessionId} />
      </div>
    </div>
  );
}
