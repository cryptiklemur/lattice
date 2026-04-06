import { useState, useEffect } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { SkillMarketplace } from "../settings/SkillMarketplace";
import { SkillItem, SkillViewModal } from "../settings/skill-shared";
import type { ProjectSettings, ServerMessage } from "#shared";

interface ProjectSkillsProps {
  settings: ProjectSettings;
  projectSlug?: string;
}

export function ProjectSkills({ settings, projectSlug }: ProjectSkillsProps) {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var globalSkills = settings.global.skills;
  var projectSkills = settings.skills;
  var hasAny = globalSkills.length > 0 || projectSkills.length > 0;
  var [viewContent, setViewContent] = useState<{ path: string; content: string } | null>(null);

  useEffect(function () {
    function handleViewResult(msg: ServerMessage) {
      if (msg.type !== "skills:view_result") return;
      var data = msg as { type: "skills:view_result"; path: string; content: string };
      setViewContent({ path: data.path, content: data.content });
    }

    subscribe("skills:view_result", handleViewResult);

    return function () {
      unsubscribe("skills:view_result", handleViewResult);
    };
  }, []);

  function handleView(path: string) {
    send({ type: "skills:view", path: path } as any);
  }

  return (
    <div className="py-2 space-y-6">
      {!hasAny && (
        <div className="py-12 text-center text-[13px] text-base-content/40">
          No skills found.
        </div>
      )}

      {globalSkills.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Global Skills</div>
          <div className="space-y-2">
            {globalSkills.map(function (skill: typeof globalSkills[number]) {
              return (
                <SkillItem
                  key={skill.path}
                  skill={skill}
                  badge="global"
                  onClick={function () { handleView(skill.path); }}
                />
              );
            })}
          </div>
        </div>
      )}

      {projectSkills.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Project Skills</div>
          <div className="space-y-2">
            {projectSkills.map(function (skill: typeof projectSkills[number]) {
              return (
                <SkillItem
                  key={skill.path}
                  skill={skill}
                  onClick={function () { handleView(skill.path); }}
                />
              );
            })}
          </div>
        </div>
      )}

      <SkillMarketplace defaultScope="project" defaultProjectSlug={projectSlug} />

      {viewContent && (
        <SkillViewModal
          path={viewContent.path}
          content={viewContent.content}
          onClose={function () { setViewContent(null); }}
        />
      )}
    </div>
  );
}
