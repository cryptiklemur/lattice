import { useRef } from "react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput(props: ChatInputProps) {
  var textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    var el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function submit() {
    var el = textareaRef.current;
    if (!el) {
      return;
    }
    var text = el.value.trim();
    if (!text || props.disabled) {
      return;
    }
    props.onSend(text);
    el.value = "";
    el.style.height = "auto";
  }

  return (
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
          alignItems: "flex-end",
          gap: "8px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "10px 12px",
          transition: "border-color var(--transition-fast)",
          opacity: props.disabled ? 0.7 : 1,
        }}
        onFocusCapture={function (e) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent-primary)";
        }}
        onBlurCapture={function (e) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)";
        }}
      >
        <textarea
          ref={textareaRef}
          placeholder={props.disabled ? "Claude is responding..." : "Message Claude..."}
          disabled={props.disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
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
            cursor: props.disabled ? "not-allowed" : "text",
          }}
        />
        <button
          aria-label="Send message"
          disabled={props.disabled}
          onClick={submit}
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "var(--radius-sm)",
            background: props.disabled ? "var(--bg-overlay)" : "var(--accent-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: props.disabled ? "var(--text-muted)" : "#fff",
            flexShrink: 0,
            transition: "background var(--transition-fast)",
            cursor: props.disabled ? "not-allowed" : "pointer",
            border: "none",
          }}
          onMouseEnter={function (e) {
            if (!props.disabled) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-secondary)";
            }
          }}
          onMouseLeave={function (e) {
            if (!props.disabled) {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-primary)";
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 8L2.5 2l3 6-3 6 11-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
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
  );
}
