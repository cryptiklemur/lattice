import type { ProjectInfo } from "@lattice/shared";
import { Plus } from "lucide-react";

interface ProjectListProps {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  onSelect: (project: ProjectInfo) => void;
  onAddProject: () => void;
}

export function ProjectList(props: ProjectListProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto py-0.5">
        {props.projects.length === 0 ? (
          <div className="px-3 py-1.5 text-[13px] text-base-content/40 italic">
            No projects yet
          </div>
        ) : (
          <ul className="menu menu-sm gap-0 p-0">
            {props.projects.map(function (project) {
              var isActive = props.activeProject?.slug === project.slug;
              return (
                <li key={project.slug}>
                  <button
                    onClick={function () { props.onSelect(project); }}
                    className={
                      "flex flex-col items-start gap-0 rounded mx-1 px-3 py-1.5 text-left w-[calc(100%-8px)] " +
                      (isActive
                        ? "bg-base-300 text-base-content font-semibold"
                        : "text-base-content/70 hover:bg-base-300/50")
                    }
                  >
                    <span className="text-[13px] truncate w-full leading-snug">
                      {project.title}
                    </span>
                    <span className="text-[11px] text-base-content/40 truncate w-full">
                      {project.slug}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-1.5">
        <button
          onClick={props.onAddProject}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-[12px] text-base-content/40 hover:text-base-content hover:bg-base-300 transition-colors duration-[120ms] cursor-pointer"
        >
          <Plus size={12} />
          Add Project
        </button>
      </div>
    </div>
  );
}
