import React from "react";
import { Settings, Plug, Sparkles, Terminal } from "lucide-react";
import { PopupMenu, PopupMenuItem } from "../ui/PopupMenu";
import { useSidebar } from "../../hooks/useSidebar";

interface ProjectDropdownProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function ProjectDropdown(props: ProjectDropdownProps) {
  var sidebar = useSidebar();

  var items: PopupMenuItem[] = [
    { id: "project-settings", label: "Project Settings", icon: <Settings size={14} /> },
    { id: "mcp", label: "MCP Servers", icon: <Plug size={14} /> },
    { id: "skills", label: "Skills", icon: <Sparkles size={14} /> },
    { id: "environment", label: "Environment", icon: <Terminal size={14} /> },
  ];

  function handleSelect(id: string) {
    if (id === "project-settings") {
      sidebar.openProjectSettings("general");
    } else if (id === "mcp") {
      sidebar.openProjectSettings("mcp");
    } else if (id === "skills") {
      sidebar.openProjectSettings("skills");
    } else if (id === "environment") {
      sidebar.openProjectSettings("environment");
    }
    props.onClose();
  }

  return (
    <PopupMenu
      items={items}
      onSelect={handleSelect}
      onClose={props.onClose}
      anchorRef={props.anchorRef}
      position="below"
    />
  );
}
