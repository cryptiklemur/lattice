import type { ProjectInfo } from "@lattice/shared";

interface ProjectListProps {
  projects: ProjectInfo[];
  activeProject: ProjectInfo | null;
  onSelect: (project: ProjectInfo) => void;
  filter?: string;
}

export function ProjectList(props: ProjectListProps) {
  var displayed = props.filter
    ? props.projects.filter(function (p) {
        var q = props.filter!.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
      })
    : props.projects;

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto py-0.5">
        {displayed.length === 0 ? (
          <div className="px-3 py-1.5 text-[13px] text-base-content/40 italic">
            No projects yet
          </div>
        ) : (
          <ul className="menu menu-sm gap-0 p-0">
            {displayed.map(function (project) {
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
    </div>
  );
}
