import { ArrowLeft, Palette, FileText, Terminal, Plug, Puzzle, Blocks, Network, Settings, ScrollText, Shield, Brain, MonitorCog, Bell, Wallet } from "lucide-react";
import { useSidebar } from "../../hooks/useSidebar";
import type { SettingsSection, ProjectSettingsSection } from "../../stores/sidebar";

interface SettingsSidebarProps {
  projectName: string;
  onBack: () => void;
}

var SETTINGS_NAV = [
  {
    group: "GENERAL",
    items: [
      { id: "appearance" as SettingsSection, label: "Appearance", icon: <Palette size={14} /> },
      { id: "notifications" as SettingsSection, label: "Notifications", icon: <Bell size={14} /> },
      { id: "claude" as SettingsSection, label: "Claude Settings", icon: <FileText size={14} /> },
      { id: "budget" as SettingsSection, label: "Budget", icon: <Wallet size={14} /> },
      { id: "environment" as SettingsSection, label: "Environment", icon: <Terminal size={14} /> },
      { id: "editor" as SettingsSection, label: "Editor", icon: <MonitorCog size={14} /> },
    ],
  },
  {
    group: "CONFIGURATION",
    items: [
      { id: "rules" as SettingsSection, label: "Rules", icon: <ScrollText size={14} /> },
      { id: "memory" as SettingsSection, label: "Memory", icon: <Brain size={14} /> },
    ],
  },
  {
    group: "INTEGRATIONS",
    items: [
      { id: "mcp" as SettingsSection, label: "MCP Servers", icon: <Plug size={14} /> },
      { id: "skills" as SettingsSection, label: "Skills", icon: <Puzzle size={14} /> },
      { id: "plugins" as SettingsSection, label: "Plugins", icon: <Blocks size={14} /> },
    ],
  },
  {
    group: "MESH",
    items: [
      { id: "nodes" as SettingsSection, label: "Nodes", icon: <Network size={14} /> },
    ],
  },
];

var PROJECT_SETTINGS_NAV = [
  {
    group: "GENERAL",
    items: [
      { id: "general" as ProjectSettingsSection, label: "General", icon: <Settings size={14} /> },
      { id: "notifications" as ProjectSettingsSection, label: "Notifications", icon: <Bell size={14} /> },
      { id: "claude" as ProjectSettingsSection, label: "Claude", icon: <FileText size={14} /> },
      { id: "environment" as ProjectSettingsSection, label: "Environment", icon: <Terminal size={14} /> },
    ],
  },
  {
    group: "INTEGRATIONS",
    items: [
      { id: "mcp" as ProjectSettingsSection, label: "MCP Servers", icon: <Plug size={14} /> },
      { id: "skills" as ProjectSettingsSection, label: "Skills", icon: <Puzzle size={14} /> },
      { id: "plugins" as ProjectSettingsSection, label: "Plugins", icon: <Blocks size={14} /> },
    ],
  },
  {
    group: "CONFIGURATION",
    items: [
      { id: "rules" as ProjectSettingsSection, label: "Rules", icon: <ScrollText size={14} /> },
      { id: "permissions" as ProjectSettingsSection, label: "Permissions", icon: <Shield size={14} /> },
      { id: "memory" as ProjectSettingsSection, label: "Memory", icon: <Brain size={14} /> },
    ],
  },
];

export function SettingsSidebar({ projectName, onBack }: SettingsSidebarProps) {
  var { activeView, setSettingsSection, setProjectSettingsSection } = useSidebar();
  var isProjectSettings = activeView.type === "project-settings";
  var activeSection = activeView.type === "settings"
    ? activeView.section
    : activeView.type === "project-settings"
    ? activeView.section
    : null;

  var nav = isProjectSettings ? PROJECT_SETTINGS_NAV : SETTINGS_NAV;
  var headerLabel = isProjectSettings ? "Project Settings" : "Settings";

  function handleItemClick(id: string) {
    if (isProjectSettings) {
      setProjectSettingsSection(id as ProjectSettingsSection);
    } else {
      setSettingsSection(id as SettingsSection);
    }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-base-200">
      <div className="px-4 h-11 border-b border-base-300 flex-shrink-0 flex items-center">
        <span className="text-[13px] font-mono font-bold text-base-content">{headerLabel}</span>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto min-h-0 py-2 pb-16">
        {nav.map(function (group) {
          return (
            <div key={group.group} className="mb-2">
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-base-content/40">
                  {group.group}
                </span>
              </div>
              {group.items.map(function (item) {
                var isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={function () { handleItemClick(item.id); }}
                    className={
                      "w-full flex items-center gap-2.5 px-4 py-2.5 sm:py-1.5 text-[13px] transition-colors duration-[100ms] text-left " +
                      (isActive
                        ? "bg-primary/20 text-base-content font-medium"
                        : "text-base-content/55 hover:bg-base-content/5 hover:text-base-content")
                    }
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-base-300 flex-shrink-0">
        <button
          onClick={onBack}
          className="w-full flex items-center gap-2 px-4 py-3.5 sm:py-3 text-[12px] text-base-content/50 hover:text-base-content transition-colors duration-[100ms]"
        >
          <ArrowLeft size={13} />
          Back to {projectName}
        </button>
      </div>
    </div>
  );
}
