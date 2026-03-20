import React from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { TabBar } from "./TabBar";
import { ChatView } from "../chat/ChatView";
import { TerminalView } from "./TerminalView";
import { FileBrowser } from "./FileBrowser";
import { NotesView } from "./NotesView";
import { ScheduledTasksView } from "./ScheduledTasksView";

var TAB_COMPONENTS: Record<string, () => React.JSX.Element> = {
  chat: ChatView,
  files: FileBrowser,
  terminal: TerminalView,
  notes: NotesView,
  tasks: ScheduledTasksView,
};

export function WorkspaceView() {
  var { tabs, activeTabId } = useWorkspace();

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <TabBar />
      <div className="flex-1 min-h-0 relative">
        {tabs.map(function (tab) {
          var Component = TAB_COMPONENTS[tab.type];
          if (!Component) return null;
          var isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: isActive ? "flex" : "none", flexDirection: "column" }}
            >
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}
