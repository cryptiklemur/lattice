import { X, Columns2, Rows2, MessageSquare, FolderOpen, TerminalSquare, StickyNote, Calendar, Bookmark, BarChart3, Lightbulb } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useSession } from "../../hooks/useSession";
import type { Tab, TabType } from "../../stores/workspace";
import { pinTab } from "../../stores/workspace";
import { formatSessionTitle } from "../../utils/formatSessionTitle";
import { ContextMenu, useContextMenu } from "../ui/ContextMenu";

interface TabBarProps {
  paneId?: string;
  isActivePane?: boolean;
}

var TAB_ICONS: Record<TabType, typeof MessageSquare> = {
  chat: MessageSquare,
  files: FolderOpen,
  terminal: TerminalSquare,
  notes: StickyNote,
  tasks: Calendar,
  bookmarks: Bookmark,
  analytics: BarChart3,
  brainstorm: Lightbulb,
};

export function TabBar({ paneId, isActivePane }: TabBarProps) {
  var workspace = useWorkspace();
  var session = useSession();
  var ctxMenu = useContextMenu<string>();

  var paneTabs: Tab[];
  var activeTabId: string;

  if (paneId) {
    var pane = workspace.panes.find(function (p) { return p.id === paneId; });
    if (!pane) return null;
    var seenIds = new Set<string>();
    paneTabs = pane.tabIds.map(function (id) {
      if (seenIds.has(id)) return null;
      seenIds.add(id);
      return workspace.tabs.find(function (t) { return t.id === id; });
    }).filter(function (t): t is Tab { return t != null; });
    activeTabId = pane.activeTabId;
  } else {
    paneTabs = workspace.tabs;
    activeTabId = workspace.activeTabId;
  }

  var shouldShow = paneTabs.length > 1 || workspace.panes.length > 1;

  function getTabLabel(tab: Tab): string {
    if (tab.type === "chat" && tab.sessionId) {
      if (tab.sessionId === session.activeSessionId && session.activeSessionTitle) {
        return formatSessionTitle(session.activeSessionTitle) || tab.label;
      }
      return formatSessionTitle(tab.label) || "Session";
    }
    return tab.label;
  }

  function handleTabClick(tabId: string) {
    if (paneId) {
      workspace.setPaneActiveTab(paneId, tabId);
    } else {
      workspace.setActiveTab(tabId);
    }
    var tab = workspace.tabs.find(function (t) { return t.id === tabId; });
    if (tab && tab.type === "chat" && tab.sessionId && tab.projectSlug) {
      if (session.activeSessionId !== tab.sessionId) {
        session.activateSession(tab.projectSlug, tab.sessionId);
      }
    }
  }

  function handleCloseTab(tabId: string) {
    workspace.closeTab(tabId);
  }

  function handleContextMenu(e: React.MouseEvent, tabId: string) {
    if (workspace.panes.length >= 2) return;
    var contextPane = paneId
      ? workspace.panes.find(function (p) { return p.id === paneId; })
      : workspace.panes[0];
    if (!contextPane || contextPane.tabIds.length < 2) return;
    ctxMenu.open(e, tabId);
  }

  function handleSplit(direction: "horizontal" | "vertical") {
    if (!ctxMenu.state) return;
    workspace.splitPane(ctxMenu.state.data, direction);
    ctxMenu.close();
  }

  function handleMiddleClick(e: React.MouseEvent, tab: Tab) {
    if (e.button === 1 && tab.closeable) {
      e.preventDefault();
      handleCloseTab(tab.id);
    }
  }

  return (
    <>
      <div
        className={
          "flex items-stretch bg-base-200 overflow-x-auto flex-shrink-0 order-1 sm:order-none" +
          (shouldShow ? " border-b border-t sm:border-t-0 border-base-content/15" : "") +
          (isActivePane && shouldShow ? " sm:border-t-2 sm:border-t-primary/40" : "")
        }
        style={{
          maxHeight: shouldShow ? "3rem" : "0",
          opacity: shouldShow ? 1 : 0,
          overflow: shouldShow ? undefined : "hidden",
          transition: "max-height 0.2s ease, opacity 0.15s ease",
        }}
      >
        {paneTabs.map(function (tab) {
          var isActive = tab.id === activeTabId;
          var Icon = TAB_ICONS[tab.type] || MessageSquare;
          var label = getTabLabel(tab);
          return (
            <div
              key={tab.id}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={function () { handleTabClick(tab.id); }}
              onDoubleClick={function () { if (!tab.pinned) pinTab(tab.id); }}
              onMouseDown={function (e) { handleMiddleClick(e, tab); }}
              onKeyDown={function (e) {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleTabClick(tab.id);
                }
              }}
              onContextMenu={function (e) { handleContextMenu(e, tab.id); }}
              className={
                "flex items-center gap-2 px-4 py-2.5 text-[13px] font-mono border-r border-base-content/10 transition-colors whitespace-nowrap flex-shrink-0 outline-none cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset max-w-[200px] " +
                (isActive
                  ? "bg-base-100 text-base-content border-b-2 border-b-primary"
                  : "text-base-content/40 hover:text-base-content/70 hover:bg-base-300/30")
              }
            >
              <Icon size={14} className={isActive ? "text-primary" : ""} />
              <span className={"truncate text-[12px]" + (tab.pinned ? "" : " italic")}>{label}</span>
              {tab.closeable && (
                <button
                  aria-label={"Close " + label + " tab"}
                  onClick={function (e) {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="ml-0.5 p-1 rounded hover:bg-base-content/15 text-base-content/30 hover:text-base-content/60 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {ctxMenu.state !== null && (
        <ContextMenu
          x={ctxMenu.state.x}
          y={ctxMenu.state.y}
          items={[
            { label: "Split Right", icon: <Columns2 size={14} />, onClick: function () { handleSplit("horizontal"); } },
            { label: "Split Down", icon: <Rows2 size={14} />, onClick: function () { handleSplit("vertical"); } },
          ]}
          onClose={ctxMenu.close}
          label="Tab actions"
        />
      )}
    </>
  );
}
