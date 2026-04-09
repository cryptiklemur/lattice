import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "#shared";

export function useEditorConfig() {
  const ws = useWebSocket();
  const [editorType, setEditorType] = useState("vscode");
  const [wslDistro, setWslDistro] = useState<string | undefined>(undefined);

  useEffect(function () {
    function handleSettings(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      const data = msg as SettingsDataMessage;
      const cfg = data.config as any;
      if (cfg.editor?.type) {
        setEditorType(cfg.editor.type);
      }
      if (data.wslDistro) {
        setWslDistro(data.wslDistro);
      }
    }
    ws.subscribe("settings:data", handleSettings);
    ws.send({ type: "settings:get" });
    return function () { ws.unsubscribe("settings:data", handleSettings); };
  }, []);

  return { editorType: editorType, wslDistro: wslDistro };
}
