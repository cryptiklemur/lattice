import type { ProjectSettings } from "@lattice/shared";

interface ProjectSkillsProps {
  settings: ProjectSettings;
}

function SkillItem({ skill, badge }: { skill: { name: string; description: string; path: string }; badge?: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-base-content truncate">{skill.name}</span>
          {badge && (
            <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-base-content/8 text-base-content/40">
              {badge}
            </span>
          )}
        </div>
        {skill.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5">{skill.description}</div>
        )}
        <div className="text-[11px] font-mono text-base-content/30 mt-0.5 truncate">{skill.path}</div>
      </div>
    </div>
  );
}

export function ProjectSkills({ settings }: ProjectSkillsProps) {
  var globalSkills = settings.global.skills;
  var projectSkills = settings.skills;
  var hasAny = globalSkills.length > 0 || projectSkills.length > 0;

  if (!hasAny) {
    return (
      <div className="py-12 text-center text-[13px] text-base-content/40">
        No skills found.
      </div>
    );
  }

  return (
    <div className="py-2 space-y-6">
      {globalSkills.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Global Skills</div>
          <div className="space-y-2">
            {globalSkills.map(function (skill) {
              return <SkillItem key={skill.path} skill={skill} badge="global" />;
            })}
          </div>
        </div>
      )}
      {projectSkills.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-base-content/40 mb-2">Project Skills</div>
          <div className="space-y-2">
            {projectSkills.map(function (skill) {
              return <SkillItem key={skill.path} skill={skill} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
