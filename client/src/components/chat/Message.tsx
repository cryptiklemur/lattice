import { useState } from "react";
import { ChevronRight, Lock, TriangleAlert } from "lucide-react";
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
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "4px 20px",
      }}
    >
      <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
        <div
          style={{
            background: "var(--accent-primary)",
            color: "#fff",
            borderRadius: "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)",
            padding: "10px 14px",
            fontSize: "14px",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.text}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTime(msg.timestamp)}</span>
      </div>
    </div>
  );
}

function AssistantMessage(props: { message: HistoryMessage }) {
  var msg = props.message;
  return (
    <div style={{ display: "flex", padding: "4px 20px", gap: "10px" }}>
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
          marginTop: "2px",
        }}
      >
        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-primary)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: "14px",
            lineHeight: "1.6",
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {msg.text || ""}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTime(msg.timestamp)}</span>
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
    <div style={{ padding: "4px 20px" }}>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          fontSize: "12px",
        }}
      >
        <button
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            textAlign: "left",
            color: "var(--text-secondary)",
            cursor: "pointer",
            background: "transparent",
            border: "none",
          }}
          onClick={function () {
            setExpanded(function (v) {
              return !v;
            });
          }}
        >
          <ChevronRight
            size={12}
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              flexShrink: 0,
            }}
          />
          <Lock size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
            {msg.name}
          </span>
          {hasResult ? (
            <span style={{ fontSize: "10px", color: "var(--text-muted)", background: "var(--bg-overlay)", padding: "2px 6px", borderRadius: "4px" }}>
              done
            </span>
          ) : (
            <span style={{ fontSize: "10px", color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", padding: "2px 6px", borderRadius: "4px" }}>
              running
            </span>
          )}
        </button>

        {expanded && (
          <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {parsedArgs && (
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Arguments
                </div>
                <pre
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    lineHeight: "1.5",
                  }}
                >
                  {parsedArgs}
                </pre>
              </div>
            )}
            {hasResult && (
              <div style={{ padding: "10px 12px", borderTop: parsedArgs ? "1px solid var(--border-subtle)" : undefined }}>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Result
                </div>
                <pre
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    margin: 0,
                    lineHeight: "1.5",
                    maxHeight: "300px",
                    overflowY: "auto",
                  }}
                >
                  {msg.content}
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
    <div style={{ padding: "4px 20px" }}>
      <div
        style={{
          background: "color-mix(in srgb, var(--accent-warning, #f59e0b) 8%, var(--bg-surface))",
          border: "1px solid color-mix(in srgb, var(--accent-warning, #f59e0b) 30%, transparent)",
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
          fontSize: "13px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <TriangleAlert size={15} color="#f59e0b" />
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Permission required</span>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              background: "var(--bg-overlay)",
              padding: "2px 6px",
              borderRadius: "4px",
              color: "var(--text-secondary)",
            }}
          >
            {msg.name}
          </code>
        </div>

        {parsedArgs && (
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              margin: "0 0 12px",
              lineHeight: "1.5",
              background: "var(--bg-overlay)",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {parsedArgs}
          </pre>
        )}

        {!responded ? (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent-primary)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
              }}
              onClick={function () {
                respond(true);
              }}
            >
              Allow
            </button>
            <button
              style={{
                padding: "6px 16px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-overlay)",
                color: "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--border-default)",
              }}
              onClick={function () {
                respond(false);
              }}
            >
              Deny
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Response sent</span>
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
