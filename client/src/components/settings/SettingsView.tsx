import { useSidebar } from "../../hooks/useSidebar";
import { Menu } from "lucide-react";
import { Status } from "./Status";
import { Appearance } from "./Appearance";
import { ClaudeSettings } from "./ClaudeSettings";
import { Environment } from "./Environment";
import { MeshStatus } from "./MeshStatus";
import type { SettingsSection } from "../../stores/sidebar";

var SECTION_CONFIG: Record<string, { title: string; subtitle: string }> = {
  status: { title: "Status", subtitle: "System health and connection status" },
  appearance: { title: "Appearance", subtitle: "Theme and visual preferences" },
  claude: { title: "Claude Settings", subtitle: "API configuration and model preferences" },
  environment: { title: "Environment", subtitle: "Environment variables and configuration" },
  mcp: { title: "MCP Servers", subtitle: "Manage Model Context Protocol server connections" },
  skills: { title: "Skills", subtitle: "Manage Claude skills and capabilities" },
  nodes: { title: "Mesh Nodes", subtitle: "Connected machines and network status" },
};

function McpPlaceholder() {
  return (
    <div className="text-base-content/40 text-sm">
      MCP server management coming soon.
    </div>
  );
}

function SkillsPlaceholder() {
  return (
    <div className="text-base-content/40 text-sm">
      Skills management coming soon.
    </div>
  );
}

function renderSection(section: SettingsSection) {
  if (section === "status") return <Status />;
  if (section === "appearance") return <Appearance />;
  if (section === "claude") return <ClaudeSettings />;
  if (section === "environment") return <Environment />;
  if (section === "mcp") return <McpPlaceholder />;
  if (section === "skills") return <SkillsPlaceholder />;
  if (section === "nodes") return <MeshStatus />;
  return null;
}

export function SettingsView() {
  var { activeView, toggleDrawer } = useSidebar();

  if (activeView.type !== "settings") {
    return null;
  }

  var section = activeView.section;
  var config = SECTION_CONFIG[section];

  return (
    <div className="flex-1 overflow-auto px-4 sm:px-8 py-4 sm:py-6">
      {config && (
        <div className="mb-6 flex items-start gap-3">
          <button
            className="btn btn-ghost btn-sm btn-square lg:hidden mt-0.5"
            aria-label="Toggle sidebar"
            onClick={toggleDrawer}
          >
            <Menu size={18} />
          </button>
          <div>
          <div className="text-lg font-mono font-bold text-base-content">{config.title}</div>
          <div className="text-xs text-base-content/40 mt-1">{config.subtitle}</div>
          </div>
        </div>
      )}
      {renderSection(section)}
    </div>
  );
}
