import React from "react";
import { WifiOff } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useOnline } from "../../hooks/useOnline";
import { TabBar } from "./TabBar";
import { SplitPane } from "./SplitPane";
import { ChatView } from "../chat/ChatView";
import { TerminalView } from "./TerminalView";
import { FileBrowser } from "./FileBrowser";
import { NotesView } from "./NotesView";
import { ScheduledTasksView } from "./ScheduledTasksView";
import { BookmarksView } from "./BookmarksView";
import { BrainstormView } from "./BrainstormView";
import { AnalyticsView } from "../analytics/AnalyticsView";
import type { Pane, Tab } from "../../stores/workspace";

var NON_CHAT_COMPONENTS: Record<string, () => React.JSX.Element> = {
  files: FileBrowser,
  terminal: TerminalView,
  notes: NotesView,
  tasks: ScheduledTasksView,
  bookmarks: BookmarksView,
  brainstorm: BrainstormView,
  analytics: AnalyticsView,
};

function PaneContent({ pane, tabs, isActive, onFocus }: {
  pane: Pane;
  tabs: Tab[];
  isActive: boolean;
  onFocus: () => void;
}) {
  var online = useOnline();
  var paneTabs = pane.tabIds.map(function (id) {
    return tabs.find(function (t) { return t.id === id; });
  }).filter(function (t): t is Tab { return t != null; });

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      onClick={onFocus}
    >
      <TabBar paneId={pane.id} isActivePane={isActive} />
      {!online && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border-b border-warning/20 flex-shrink-0">
          <WifiOff size={13} className="text-warning flex-shrink-0" />
          <span className="text-[12px] text-warning">Disconnected — viewing only</span>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        {paneTabs.map(function (tab) {
          var isTabActive = tab.id === pane.activeTabId;
          if (tab.type === "chat") {
            return (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{ display: isTabActive ? "flex" : "none", flexDirection: "column" }}
              >
                <ChatView sessionId={tab.sessionId} projectSlug={tab.projectSlug} />
              </div>
            );
          }
          var Component = NON_CHAT_COMPONENTS[tab.type];
          if (!Component) return null;
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
  var online = useOnline();

  if (!splitDirection || panes.length < 2) {
    var singlePane = panes[0];
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <TabBar paneId={singlePane?.id} />
        {!online && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border-b border-warning/20 flex-shrink-0 order-0 sm:order-none">
            <WifiOff size={13} className="text-warning flex-shrink-0" />
            <span className="text-[12px] text-warning">Disconnected — viewing only</span>
          </div>
        )}
        <div className="flex-1 min-h-0 relative order-0 sm:order-none">
          {tabs.map(function (tab) {
            var isActive = singlePane ? tab.id === singlePane.activeTabId : tab.id === "chat";
            if (tab.type === "chat") {
              return (
                <div
                  key={tab.id}
                  className="absolute inset-0"
                  style={{ display: isActive ? "flex" : "none", flexDirection: "column" }}
                >
                  <ChatView sessionId={tab.sessionId} projectSlug={tab.projectSlug} />
                </div>
              );
            }
            var Component = NON_CHAT_COMPONENTS[tab.type];
            if (!Component) return null;
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
