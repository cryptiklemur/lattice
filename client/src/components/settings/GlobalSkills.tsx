import { useState, useEffect } from "react";
import { Eye, Trash2, RefreshCw, X, Loader2 } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { SkillMarketplace } from "./SkillMarketplace";
import type { ServerMessage, SkillInfo, SettingsDataMessage } from "@lattice/shared";

function SkillItem({
  skill,
  onView,
  onDelete,
  onUpdate,
  isDeleting,
  isUpdating,
}: {
  skill: SkillInfo;
  onView: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  var [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-base-300 border border-base-content/15 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-base-content truncate">{skill.name}</div>
        {skill.description && (
          <div className="text-[12px] text-base-content/40 mt-0.5 line-clamp-2">{skill.description}</div>
        )}
        <div className="text-[11px] font-mono text-base-content/30 mt-0.5 truncate">{skill.path}</div>
      </div>
      <div className="flex gap-1 flex-shrink-0 mt-0.5">
        <button
          onClick={onView}
          aria-label={"View " + skill.name}
          className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Eye size={12} />
        </button>
        {isUpdating ? (
          <Loader2 size={12} className="text-primary animate-spin mt-1 mx-1" />
        ) : (
          <button
            onClick={onUpdate}
            aria-label={"Update " + skill.name}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-info focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCw size={12} />
          </button>
        )}
        {confirmDelete ? (
          <div className="flex gap-1">
            <button
              onClick={function () { onDelete(); setConfirmDelete(false); }}
              className="btn btn-error btn-xs"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 size={10} className="animate-spin" /> : "Confirm"}
            </button>
            <button
              onClick={function () { setConfirmDelete(false); }}
              className="btn btn-ghost btn-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={function () { setConfirmDelete(true); }}
            aria-label={"Delete " + skill.name}
            className="btn btn-ghost btn-xs btn-square text-base-content/30 hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function SkillViewModal({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  var filename = path.split("/").pop() || path;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-content/15 flex-shrink-0">
          <h2 className="text-[15px] font-mono font-bold text-base-content truncate">{filename}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost btn-xs btn-square text-base-content/40 hover:text-base-content"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <pre className="text-[12px] font-mono text-base-content/70 whitespace-pre-wrap leading-relaxed">{content}</pre>
        </div>
        <div className="px-5 py-3 border-t border-base-content/15 flex-shrink-0">
          <div className="text-[11px] font-mono text-base-content/30 truncate">{path}</div>
        </div>
      </div>
    </div>
  );
}

export function GlobalSkills() {
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [skills, setSkills] = useState<SkillInfo[]>([]);
  var [loaded, setLoaded] = useState(false);
  var [viewContent, setViewContent] = useState<{ path: string; content: string } | null>(null);
  var [deletingPath, setDeletingPath] = useState<string | null>(null);
  var [updatingName, setUpdatingName] = useState<string | null>(null);

  useEffect(function () {
    function handleData(msg: ServerMessage) {
      if (msg.type !== "settings:data") return;
      var data = msg as SettingsDataMessage;
      setSkills(data.globalSkills ?? []);
      setLoaded(true);
    }

    function handleViewResult(msg: ServerMessage) {
      if (msg.type !== "skills:view_result") return;
      var data = msg as { type: "skills:view_result"; path: string; content: string };
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
    var source = guessSource(skill);
    if (!source) return;
    setUpdatingName(skill.name);
    send({ type: "skills:update", source: source } as any);
  }

  function guessSource(skill: SkillInfo): string | null {
    var pathParts = skill.path.split("/");
    var skillsIdx = pathParts.lastIndexOf("skills");
    if (skillsIdx >= 0 && skillsIdx + 1 < pathParts.length) {
      return pathParts[skillsIdx + 1];
    }
    return skill.name;
  }

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
              return (
                <SkillItem
                  key={skill.path}
                  skill={skill}
                  onView={function () { handleView(skill); }}
                  onDelete={function () { handleDelete(skill); }}
                  onUpdate={function () { handleUpdate(skill); }}
                  isDeleting={deletingPath === skill.path}
                  isUpdating={updatingName === skill.name}
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
