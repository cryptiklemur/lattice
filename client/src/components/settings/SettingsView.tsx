import { useSidebar } from "../../hooks/useSidebar";
import { Menu } from "lucide-react";
import { Appearance } from "./Appearance";
import { ClaudeSettings } from "./ClaudeSettings";
import { Environment } from "./Environment";
import { MeshStatus } from "./MeshStatus";
import { GlobalMcp } from "./GlobalMcp";
import { GlobalSkills } from "./GlobalSkills";
import { Editor } from "./Editor";
import { GlobalRules } from "./GlobalRules";
import { GlobalMemory } from "./GlobalMemory";
import { GlobalPlugins } from "./GlobalPlugins";
import { Notifications } from "./Notifications";
import { BudgetSettings } from "./BudgetSettings";
import type { SettingsSection } from "../../stores/sidebar";

var SECTION_CONFIG: Record<string, { title: string }> = {
  appearance: { title: "Appearance" },
  notifications: { title: "Notifications" },
  claude: { title: "Claude Settings" },
  budget: { title: "Budget" },
  environment: { title: "Environment" },
  mcp: { title: "MCP Servers" },
  skills: { title: "Skills" },
  plugins: { title: "Plugins" },
  nodes: { title: "Mesh Nodes" },
  editor: { title: "Editor" },
  rules: { title: "Rules" },
  memory: { title: "Memory" },
};

function renderSection(section: SettingsSection) {
  if (section === "appearance") return <Appearance />;
  if (section === "notifications") return <Notifications />;
  if (section === "claude") return <ClaudeSettings />;
  if (section === "budget") return <BudgetSettings />;
  if (section === "environment") return <Environment />;
  if (section === "mcp") return <GlobalMcp />;
  if (section === "skills") return <GlobalSkills />;
  if (section === "plugins") return <GlobalPlugins />;
  if (section === "nodes") return <MeshStatus />;
  if (section === "editor") return <Editor />;
  if (section === "rules") return <GlobalRules />;
  if (section === "memory") return <GlobalMemory />;
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
    <section aria-label="Settings" className="flex-1 overflow-auto px-4 sm:px-8 py-4 sm:py-6 max-w-3xl">
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
    </section>
  );
}
