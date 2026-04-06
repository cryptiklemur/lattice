import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerMessage, SettingsDataMessage } from "#shared";

var DEFAULT_VERBS = ["Thinking", "Analyzing", "Processing", "Computing", "Evaluating"];

export function useSpinnerVerb(active: boolean): string {
  var [verbs, setVerbs] = useState<string[]>(DEFAULT_VERBS);
  var [currentVerb, setCurrentVerb] = useState(DEFAULT_VERBS[0]);
  var ws = useWebSocket();

  useEffect(function () {
    function handleSettings(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
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
      var idx = Math.floor(Math.random() * verbs.length);
      setCurrentVerb(verbs[idx]);
    }
    pickRandom();
    var timer = setInterval(pickRandom, 3000);
    return function () { clearInterval(timer); };
  }, [active, verbs]);

  return currentVerb;
}
