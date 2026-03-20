import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "@lattice/shared";
import type { LatticeConfig } from "@lattice/shared";

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-2.5 border-b border-base-content/15 last:border-b-0 gap-1 sm:gap-4">
      <div className="sm:w-[120px] text-[12px] text-base-content/40 uppercase tracking-[0.06em] font-semibold flex-shrink-0">
        {label}
      </div>
      <div className={"text-[13px] font-mono break-words " + (valueClass || "text-base-content")}>
        {value}
      </div>
    </div>
  );
}

export function Status() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [config, setConfig] = useState<LatticeConfig | null>(null);

  useEffect(function () {
    function handleMessage(msg: ServerMessage) {
      if (msg.type !== "settings:data") {
        return;
      }
      var data = msg as SettingsDataMessage;
      setConfig(data.config);
    }

    subscribe("settings:data", handleMessage);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleMessage);
    };
  }, []);

  return (
    <div className="py-2">
      {config ? (
        <div>
          <Row label="Status" value="Online" valueClass="text-success" />
          <Row label="Node Name" value={config.name} />
          <Row label="Port" value={String(config.port)} />
          <Row label="Debug" value={config.debug ? "enabled" : "disabled"} />
          <Row label="TLS" value={config.tls ? "enabled" : "disabled"} />
          <Row label="Projects" value={String(config.projects.length)} />
        </div>
      ) : (
        <div className="text-[13px] text-base-content/40 py-4">
          Loading...
        </div>
      )}
    </div>
  );
}
