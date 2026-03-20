import React from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { TabBar } from "./TabBar";
import { SplitPane } from "./SplitPane";
import { ChatView } from "../chat/ChatView";
import { TerminalView } from "./TerminalView";
import { FileBrowser } from "./FileBrowser";
import { NotesView } from "./NotesView";
import { ScheduledTasksView } from "./ScheduledTasksView";
import type { Pane, Tab } from "../../stores/workspace";

var TAB_COMPONENTS: Record<string, () => React.JSX.Element> = {
  chat: ChatView,
  files: FileBrowser,
  terminal: TerminalView,
  notes: NotesView,
  tasks: ScheduledTasksView,
};

function PaneContent({ pane, tabs, isActive, onFocus }: {
  pane: Pane;
  tabs: Tab[];
  isActive: boolean;
  onFocus: () => void;
}) {
  var paneTabs = pane.tabIds.map(function (id) {
    return tabs.find(function (t) { return t.id === id; });
  }).filter(function (t): t is Tab { return t != null; });

  return (
    <div
      className={"flex flex-col h-full w-full overflow-hidden " + (isActive ? "ring-1 ring-primary/20" : "")}
      onClick={onFocus}
    >
      <TabBar paneId={pane.id} />
      <div className="flex-1 min-h-0 relative">
        {paneTabs.map(function (tab) {
          var Component = TAB_COMPONENTS[tab.type];
          if (!Component) return null;
          var isTabActive = tab.id === pane.activeTabId;
          return (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: isTabActive ? "flex" : "none", flexDirection: "column" }}
            >
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WorkspaceView() {
  var { tabs, panes, activePaneId, splitDirection, splitRatio, setSplitRatio, setActivePaneId } = useWorkspace();

  if (!splitDirection || panes.length < 2) {
    var singlePane = panes[0];
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <TabBar paneId={singlePane?.id} />
        <div className="flex-1 min-h-0 relative">
          {tabs.map(function (tab) {
            var Component = TAB_COMPONENTS[tab.type];
            if (!Component) return null;
            var isActive = singlePane ? tab.id === singlePane.activeTabId : tab.id === "chat";
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

  return (
    <SplitPane direction={splitDirection} ratio={splitRatio} onRatioChange={setSplitRatio}>
      <PaneContent
        pane={panes[0]}
        tabs={tabs}
        isActive={activePaneId === panes[0].id}
        onFocus={function () { setActivePaneId(panes[0].id); }}
      />
      <PaneContent
        pane={panes[1]}
        tabs={tabs}
        isActive={activePaneId === panes[1].id}
        onFocus={function () { setActivePaneId(panes[1].id); }}
      />
    </SplitPane>
  );
}
