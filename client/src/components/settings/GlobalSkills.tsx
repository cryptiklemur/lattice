import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { SkillMarketplace } from "./SkillMarketplace";
import type { ServerMessage, SkillInfo, SettingsDataMessage } from "@lattice/shared";

function SkillItem({ skill }: { skill: SkillInfo }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-base-content truncate">{skill.name}</div>
        {skill.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5">{skill.description}</div>
        )}
        <div className="text-[11px] font-mono text-base-content/30 mt-0.5 truncate">{skill.path}</div>
      </div>
    </div>
  );
}

export function GlobalSkills() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [skills, setSkills] = useState<SkillInfo[]>([]);
  var [loaded, setLoaded] = useState(false);

  useEffect(function () {
    function handleData(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      setSkills(data.globalSkills ?? []);
      setLoaded(true);
    }

    subscribe("settings:data", handleData);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleData);
    };
  }, []);

  if (!loaded) {
    return <div className="text-[13px] text-base-content/40 py-4">Loading...</div>;
  }

  return (
    <div className="py-2 space-y-6">
      <div>
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Installed Skills</div>
        {skills.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-base-content/30">
            No global skills installed.
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map(function (skill) {
              return <SkillItem key={skill.path} skill={skill} />;
            })}
          </div>
        )}
      </div>

      <SkillMarketplace defaultScope="global" />
    </div>
  );
}
