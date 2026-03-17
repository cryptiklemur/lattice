import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "@lattice/shared";
import type { LatticeConfig } from "@lattice/shared";

interface NodeStatus {
  config: LatticeConfig | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center py-2.5 border-b border-base-300 gap-4">
      <div className="w-[120px] text-[12px] text-base-content/40 uppercase tracking-[0.06em] font-semibold flex-shrink-0">
        {label}
      </div>
      <div className="text-[13px] text-base-content font-mono">
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
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
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
        <div className="text-[13px] text-base-content/40 py-4">
          Loading node status...
        </div>
      )}

      <div className="mt-6 p-3 px-3.5 bg-base-300 rounded-md border border-base-300 flex gap-6">
        <div>
          <div className="text-[11px] text-base-content/40 mb-1">Status</div>
          <div className="flex items-center gap-1.5 text-[13px] text-success">
            <div className="w-[7px] h-[7px] rounded-full bg-success" />
            Online
          </div>
        </div>

        <div>
          <div className="text-[11px] text-base-content/40 mb-1">Runtime</div>
          <div className="text-[13px] text-base-content font-mono">Bun</div>
        </div>
      </div>
    </div>
  );
}
