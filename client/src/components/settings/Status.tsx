import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "@lattice/shared";
import type { LatticeConfig } from "@lattice/shared";

interface NodeStatus {
  config: LatticeConfig | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-subtle)",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "120px",
          fontSize: "12px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function Status() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [status, setStatus] = useState<NodeStatus>({ config: null });

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      var data = msg as SettingsDataMessage;
      setStatus(function (prev) {
        return {
          ...prev,
          config: data.config,
        };
      });
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  var config = status.config;

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Node Status
      </div>

      {config ? (
        <div>
          <Row label="Node Name" value={config.name} />
          <Row label="Version" value="v0.0.1" />
          <Row label="Port" value={String(config.port)} />
          <Row label="Debug" value={config.debug ? "enabled" : "disabled"} />
          <Row label="TLS" value={config.tls ? "enabled" : "disabled"} />
          <Row label="Projects" value={String(config.projects.length)} />
        </div>
      ) : (
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            padding: "16px 0",
          }}
        >
          Loading node status...
        </div>
      )}

      <div
        style={{
          marginTop: "24px",
          padding: "12px 14px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          gap: "24px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Status
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "var(--green)",
            }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "var(--green)",
              }}
            />
            Online
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
            Runtime
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            Bun
          </div>
        </div>
      </div>
    </div>
  );
}
