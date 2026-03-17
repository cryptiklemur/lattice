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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "2px 0",
        }}
      >
        {props.projects.length === 0 ? (
          <div
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            No projects yet
          </div>
        ) : (
          props.projects.map(function (project) {
            var isActive = props.activeProject?.slug === project.slug;
            return (
              <button
                key={project.slug}
                onClick={function () { props.onSelect(project); }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  margin: "1px 4px",
                  width: "calc(100% - 8px)",
                  background: isActive ? "var(--bg-overlay)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background var(--transition-fast)",
                }}
                onMouseEnter={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tertiary)";
                  }
                }}
                onMouseLeave={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.title}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project.slug}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div style={{ padding: "4px 6px 6px" }}>
        <button
          onClick={props.onAddProject}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            width: "100%",
            padding: "5px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--text-muted)",
            transition: "color var(--transition-fast), background var(--transition-fast)",
          }}
          onMouseEnter={function (e) {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
          }}
          onMouseLeave={function (e) {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <Plus size={12} />
          Add Project
        </button>
      </div>
    </div>
  );
}
