import React from "react";
import { WifiOff, MessageSquare, FolderOpen, TerminalSquare, StickyNote, ClipboardList, BarChart3 } from "lucide-react";
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
import { SpecsView } from "./SpecsView";
import { ContextAnalyzerView } from "./ContextAnalyzerView";
import { DragProvider } from "./DragContext";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { openTab } from "../../stores/workspace";
import type { Pane, Tab, TabType } from "../../stores/workspace";

var NON_CHAT_COMPONENTS: Record<string, () => React.JSX.Element> = {
  files: FileBrowser,
  terminal: TerminalView,
  notes: NotesView,
  tasks: ScheduledTasksView,
  bookmarks: BookmarksView,
  brainstorm: BrainstormView,
  analytics: AnalyticsView,
  specs: SpecsView,
  context: ContextAnalyzerView,
};

var QUICK_ACTIONS: Array<{ type: TabType; icon: typeof MessageSquare; label: string; hint: string }> = [
  { type: "chat", icon: MessageSquare, label: "Chat", hint: "New session" },
  { type: "files", icon: FolderOpen, label: "Files", hint: "Browse project" },
  { type: "terminal", icon: TerminalSquare, label: "Terminal", hint: "Shell access" },
  { type: "notes", icon: StickyNote, label: "Notes", hint: "Project notes" },
  { type: "specs", icon: ClipboardList, label: "Specs", hint: "Design specs" },
  { type: "analytics", icon: BarChart3, label: "Analytics", hint: "Usage data" },
];

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0">
      <div className="flex flex-col items-center gap-8 max-w-md px-6">
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-base-content/30">
            No open tabs
          </span>
          <span className="text-[13px] text-base-content/40">
            Select a session from the sidebar or open a workspace tool.
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 w-full max-w-xs">
          {QUICK_ACTIONS.map(function (action) {
            return (
              <button
                key={action.type}
                onClick={function () { openTab(action.type); }}
                className="group flex flex-col items-center gap-1 px-3 py-3 rounded-lg border border-base-content/10 hover:border-base-content/20 hover:bg-base-200/50 transition-colors cursor-pointer"
              >
                <action.icon size={16} className="text-base-content/30 group-hover:text-base-content/60 transition-colors" />
                <span className="font-mono text-[11px] font-medium text-base-content/50 group-hover:text-base-content/70 transition-colors">{action.label}</span>
                <span className="text-[10px] text-base-content/25 group-hover:text-base-content/40 transition-colors">{action.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
        <DropZoneOverlay paneId={pane.id} />
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

function WorkspaceViewInner() {
  var { tabs, panes, activePaneId, splitDirection, splitRatio, setSplitRatio, setActivePaneId } = useWorkspace();
  var online = useOnline();

  if (!splitDirection || panes.length < 2) {
    var singlePane = panes[0];
    var hasTabs = tabs.length > 0 && singlePane && singlePane.tabIds.length > 0;
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        {hasTabs && <TabBar paneId={singlePane?.id} />}
        {!online && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border-b border-warning/20 flex-shrink-0 order-0 sm:order-none">
            <WifiOff size={13} className="text-warning flex-shrink-0" />
            <span className="text-[12px] text-warning">Disconnected — viewing only</span>
          </div>
        )}
        {hasTabs ? (
          <div className="flex-1 min-h-0 relative order-0 sm:order-none">
            <DropZoneOverlay paneId={singlePane?.id || "pane-1"} />
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
        ) : (
          <EmptyState />
        )}
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

export function WorkspaceView() {
  return (
    <DragProvider>
      <WorkspaceViewInner />
    </DragProvider>
  );
}
