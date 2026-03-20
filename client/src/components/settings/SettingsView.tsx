import { useSidebar } from "../../hooks/useSidebar";
import { Menu } from "lucide-react";
import { Appearance } from "./Appearance";
import { ClaudeSettings } from "./ClaudeSettings";
import { Environment } from "./Environment";
import { MeshStatus } from "./MeshStatus";
import { GlobalMcp } from "./GlobalMcp";
import type { SettingsSection } from "../../stores/sidebar";

var SECTION_CONFIG: Record<string, { title: string }> = {
  appearance: { title: "Appearance" },
  claude: { title: "Claude Settings" },
  environment: { title: "Environment" },
  mcp: { title: "MCP Servers" },
  skills: { title: "Skills" },
  nodes: { title: "Mesh Nodes" },
};

function SkillsPlaceholder() {
  return (
    <div className="text-[13px] text-base-content/40 py-2">
      Skills management coming soon.
    </div>
  );
}

function renderSection(section: SettingsSection) {
  if (section === "appearance") return <Appearance />;
  if (section === "claude") return <ClaudeSettings />;
  if (section === "environment") return <Environment />;
  if (section === "mcp") return <GlobalMcp />;
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
      {renderSection(section)}
    </div>
  );
}
