import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "@lattice/shared";

export function useEditorConfig() {
  var ws = useWebSocket();
  var [editorType, setEditorType] = useState("vscode");

  useEffect(function () {
    function handleSettings(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      var cfg = data.config as any;
      if (cfg.editor?.type) {
        setEditorType(cfg.editor.type);
      }
    }
    ws.subscribe("settings:data", handleSettings);
    ws.send({ type: "settings:get" });
    return function () { ws.unsubscribe("settings:data", handleSettings); };
  }, []);

  return { editorType: editorType };
}
