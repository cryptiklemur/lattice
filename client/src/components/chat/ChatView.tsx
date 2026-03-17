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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "var(--bg-primary)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "48px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-primary)",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {activeSessionId ? "Session" : "New Session"}
        </span>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button
            aria-label="Session info"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "color var(--transition-fast), background var(--transition-fast)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Info size={15} />
          </button>
          <button
            aria-label="Open terminal"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "color var(--transition-fast), background var(--transition-fast)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <Terminal size={15} />
          </button>
        </div>
      </div>

      <div
        ref={scrollParentRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
            }}
          >
            <div style={{ textAlign: "center", maxWidth: "360px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Info size={22} strokeWidth={1.5} color="var(--text-muted)" />
              </div>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                {activeSessionId ? "Start the conversation" : "Select a project to start"}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                {activeSessionId
                  ? "Type a message below to begin chatting with Claude."
                  : "Choose a project from the sidebar, then create or select a session to begin chatting with Claude."}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              position: "relative",
              height: virtualizer.getTotalSize() + "px",
              width: "100%",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
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
                    style={{ paddingTop: virtualItem.index === 0 ? "12px" : undefined }}
                  >
                    <Message message={msg} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isProcessing && (
          <div style={{ display: "flex", padding: "8px 20px", gap: "10px", alignItems: "center" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-primary)" }} />
            </div>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {[0, 1, 2].map(function (i) {
                return (
                  <div
                    key={i}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "var(--text-muted)",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: i * 0.2 + "s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: "12px", flexShrink: 0 }} />
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          paddingTop: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0 16px 8px",
          }}
        >
          <button
            aria-label="Attach file"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              transition: "color var(--transition-fast)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <Paperclip size={15} />
          </button>
          <div style={{ marginLeft: "auto" }}>
            <ModelSelector />
          </div>
        </div>

        <ChatInput onSend={sendMessage} disabled={isProcessing || !activeSessionId} />
      </div>
    </div>
  );
}
