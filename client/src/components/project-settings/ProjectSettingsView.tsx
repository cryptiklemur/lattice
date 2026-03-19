import { useSidebar } from "../../hooks/useSidebar";
import { useProjectSettings } from "../../hooks/useProjectSettings";
import { Menu } from "lucide-react";
import type { ProjectSettingsSection } from "../../stores/sidebar";
import type { ProjectSettings } from "@lattice/shared";
import { ProjectGeneral } from "./ProjectGeneral";
import { ProjectClaude } from "./ProjectClaude";
import { ProjectEnvironment } from "./ProjectEnvironment";
import { ProjectPermissions } from "./ProjectPermissions";

var SECTION_CONFIG: Record<string, { title: string }> = {
  general: { title: "General" },
  claude: { title: "Claude" },
  environment: { title: "Environment" },
  mcp: { title: "MCP Servers" },
  skills: { title: "Skills" },
  rules: { title: "Rules" },
  permissions: { title: "Permissions" },
};

function renderSection(
  section: ProjectSettingsSection,
  settings: ProjectSettings,
  updateSection: (section: string, data: Record<string, unknown>) => void,
) {
  if (section === "general") {
    return <ProjectGeneral settings={settings} updateSection={updateSection} />;
  }

  if (section === "claude") {
    return <ProjectClaude settings={settings} updateSection={updateSection} />;
  }

  if (section === "environment") {
    return <ProjectEnvironment settings={settings} updateSection={updateSection} />;
  }

  if (section === "permissions") {
    return <ProjectPermissions settings={settings} updateSection={updateSection} />;
  }

  return (
    <div className="py-2 text-[13px] text-base-content/40">
      {section} section coming soon.
    </div>
  );
}

export function ProjectSettingsView() {
  var { activeView, activeProjectSlug, toggleDrawer } = useSidebar();

  if (activeView.type !== "project-settings") {
    return null;
  }

  var section = activeView.section;
  var config = SECTION_CONFIG[section];
  var { settings, loading, error, updateSection } = useProjectSettings(activeProjectSlug);

  return (
    <div className="flex-1 overflow-auto px-4 sm:px-8 py-4 sm:py-6 max-w-3xl">
      {config && (
        <div className="mb-6 flex items-center gap-3">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden"
            aria-label="Toggle sidebar"
            onClick={toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-mono font-bold text-base-content">{config.title}</h1>
        </div>
      )}
      {loading && (
        <div className="text-[13px] text-base-content/40 py-4">Loading...</div>
      )}
      {error && (
        <div className="text-[13px] text-error py-4">{error}</div>
      )}
      {!loading && !error && settings && renderSection(section, settings, updateSection)}
    </div>
  );
}
