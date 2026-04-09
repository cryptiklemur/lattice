import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "#shared";

const DEFAULT_VERBS = ["Thinking", "Analyzing", "Processing", "Computing", "Evaluating"];

export function useSpinnerVerb(active: boolean): string {
  const [verbs, setVerbs] = useState<string[]>(DEFAULT_VERBS);
  const [currentVerb, setCurrentVerb] = useState(DEFAULT_VERBS[0]);
  const ws = useWebSocket();

  useEffect(function () {
    function handleSettings(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      const data = msg as SettingsDataMessage;
      if (data.spinnerVerbs && data.spinnerVerbs.length > 0) {
        setVerbs(data.spinnerVerbs);
      }
    }
    ws.subscribe("settings:data", handleSettings);
    return function () { ws.unsubscribe("settings:data", handleSettings); };
  }, [ws]);

  useEffect(function () {
    if (!active) return;
    function pickRandom() {
      const idx = Math.floor(Math.random() * verbs.length);
      setCurrentVerb(verbs[idx]);
    }
    pickRandom();
    const timer = setInterval(pickRandom, 3000);
    return function () { clearInterval(timer); };
  }, [active, verbs]);

  return currentVerb;
}
