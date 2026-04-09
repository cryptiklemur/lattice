import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { SkillMarketplace } from "./SkillMarketplace";
import { SkillItem, SkillActions, SkillViewModal } from "./skill-shared";
import type { ServerMessage, SkillInfo, SettingsDataMessage } from "#shared";

export function GlobalSkills() {
  const { send, subscribe, unsubscribe } = useWebSocket();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewContent, setViewContent] = useState<{ path: string; content: string } | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [updatingName, setUpdatingName] = useState<string | null>(null);

  useEffect(function () {
    function handleData(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      const data = msg as SettingsDataMessage;
      setSkills(data.globalSkills ?? []);
      setLoaded(true);
    }

    function handleViewResult(msg: ServerMessage) {
      if (msg.type !== "skills:view_result") return;
      const data = msg as { type: "skills:view_result"; path: string; content: string };
      setViewContent({ path: data.path, content: data.content });
    }

    function handleDeleteResult(msg: ServerMessage) {
      if (msg.type !== "skills:delete_result") return;
      setDeletingPath(null);
    }

    function handleInstallResult(msg: ServerMessage) {
      if (msg.type !== "skills:install_result") return;
      setUpdatingName(null);
    }

    subscribe("settings:data", handleData);
    subscribe("skills:view_result", handleViewResult);
    subscribe("skills:delete_result", handleDeleteResult);
    subscribe("skills:install_result", handleInstallResult);
    send({ type: "settings:get" });

    return function () {
      unsubscribe("settings:data", handleData);
      unsubscribe("skills:view_result", handleViewResult);
      unsubscribe("skills:delete_result", handleDeleteResult);
      unsubscribe("skills:install_result", handleInstallResult);
    };
  }, []);

  function handleView(skill: SkillInfo) {
    send({ type: "skills:view", path: skill.path } as any);
  }

  function handleDelete(skill: SkillInfo) {
    setDeletingPath(skill.path);
    send({ type: "skills:delete", path: skill.path } as any);
  }

  function handleUpdate(skill: SkillInfo) {
    const source = guessSource(skill);
    if (!source) return;
    setUpdatingName(skill.name);
    send({ type: "skills:update", source: source } as any);
  }

  function guessSource(skill: SkillInfo): string | null {
    const pathParts = skill.path.split("/");
    const skillsIdx = pathParts.lastIndexOf("skills");
    if (skillsIdx >= 0 && skillsIdx + 1 < pathParts.length) {
      return pathParts[skillsIdx + 1];
    }
    return skill.name;
  }

  if (!loaded) {
    return (
      <div className="py-4 space-y-3 animate-pulse">
        {[0, 1, 2].map(function (i) { return <div key={i} className="bg-base-content/[0.03] rounded-xl h-16" />; })}
      </div>
    );
  }

  return (
    <div className="py-2 space-y-6">
      <a
        href="https://docs.anthropic.com/en/docs/claude-code/slash-commands"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-base-content/30 hover:text-primary/70 flex items-center gap-1 mb-4 transition-colors"
      >
        <ExternalLink size={11} />
        Claude Code docs
      </a>
      <div>
        <div className="text-[12px] font-semibold text-base-content/40 mb-2">Installed Skills</div>
        {skills.length === 0 ? (
          <div className="py-4 text-center">
            <div className="text-[12px] text-base-content/30 mb-0.5">No skills installed</div>
            <div className="text-[11px] text-base-content/20">Search the marketplace below to add skills.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map(function (skill) {
              return (
                <SkillItem
                  key={skill.path}
                  skill={skill}
                  onClick={function () { handleView(skill); }}
                  actions={
                    <SkillActions
                      skill={skill}
                      onDelete={function () { handleDelete(skill); }}
                      onUpdate={function () { handleUpdate(skill); }}
                      isDeleting={deletingPath === skill.path}
                      isUpdating={updatingName === skill.name}
                    />
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <SkillMarketplace defaultScope="global" />

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
