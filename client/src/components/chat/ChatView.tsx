import { useRef } from "react";

export function ChatView() {
  var inputRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  }

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
          New Session
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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="4.5" r="0.75" fill="currentColor" />
            </svg>
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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4.5 6l2.5 2L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.5 10h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                  fill="var(--text-muted)"
                />
              </svg>
            </div>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "8px",
              }}
            >
              Select a project to start
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                lineHeight: 1.6,
              }}
            >
              Choose a project from the sidebar, then create or select a session to begin chatting with Claude.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          padding: "12px 16px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
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
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13.5 7.5L7 14a4 4 0 01-5.66-5.66l6.5-6.5a2.5 2.5 0 013.54 3.54L5 11.84a1 1 0 01-1.41-1.41L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span>claude-sonnet-4-5</span>
            <span style={{ color: "var(--border-default)" }}>|</span>
            <span>balanced</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 12px",
            transition: "border-color var(--transition-fast)",
          }}
          onFocusCapture={function (e) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-primary)";
          }}
          onBlurCapture={function (e) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)";
          }}
        >
          <textarea
            ref={inputRef}
            placeholder="Message Claude..."
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              flex: 1,
              resize: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: "14px",
              lineHeight: "1.5",
              maxHeight: "160px",
              overflowY: "auto",
              fontFamily: "var(--font-ui)",
            }}
            onInput={function (e) {
              var el = e.currentTarget as HTMLTextAreaElement;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 160) + "px";
            }}
          />
          <button
            aria-label="Send message"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-secondary)";
            }}
            onMouseLeave={function (e) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-primary)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13.5 8L2.5 2l3 6-3 6 11-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginTop: "6px",
            paddingLeft: "2px",
          }}
        >
          Enter to send  •  Shift+Enter for newline
        </div>
      </div>
    </div>
  );
}
