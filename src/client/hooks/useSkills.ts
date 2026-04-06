import { useEffect, useState } from "react";
import type { SkillInfo } from "#shared";
import type { ServerMessage } from "#shared";
import { useWebSocket } from "./useWebSocket";

export function useSkills(): SkillInfo[] {
  var ws = useWebSocket();
  var [skills, setSkills] = useState<SkillInfo[]>([]);

  useEffect(function () {
    function handleSkillsList(msg: ServerMessage) {
      if (msg.type === "skills:list") {
        var listMsg = msg as { type: string; skills: SkillInfo[] };
        setSkills(listMsg.skills);
      }
    }
    ws.subscribe("skills:list", handleSkillsList);
    return function () {
      ws.unsubscribe("skills:list", handleSkillsList);
    };
  }, [ws]);

  useEffect(function () {
    if (ws.status === "connected") {
      ws.send({ type: "skills:list_request" });
    }
  }, [ws.status, ws]);

  return skills;
}
