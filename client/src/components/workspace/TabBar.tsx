import { useState, useEffect, useRef } from "react";
import { X, Columns2, Rows2, MessageSquare, FolderOpen, TerminalSquare, StickyNote, Calendar, Bookmark } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useSession } from "../../hooks/useSession";
import type { Tab, TabType } from "../../stores/workspace";
import { formatSessionTitle } from "../../utils/formatSessionTitle";

interface TabBarProps {
  paneId?: string;
  isActivePane?: boolean;
}

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

var TAB_ICONS: Record<TabType, typeof MessageSquare> = {
  chat: MessageSquare,
  files: FolderOpen,
  terminal: TerminalSquare,
  notes: StickyNote,
  tasks: Calendar,
  bookmarks: Bookmark,
};

export function TabBar({ paneId, isActivePane }: TabBarProps) {
  var workspace = useWorkspace();
  var session = useSession();
  var [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  var menuRef = useRef<HTMLDivElement>(null);

  useEffect(function () {
    if (!contextMenu) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return function () {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  var paneTabs: Tab[];
  var activeTabId: string;

  if (paneId) {
    var pane = workspace.panes.find(function (p) { return p.id === paneId; });
    if (!pane) return null;
    paneTabs = pane.tabIds.map(function (id) {
      return workspace.tabs.find(function (t) { return t.id === id; });
    }).filter(function (t): t is Tab { return t != null; });
    activeTabId = pane.activeTabId;
  } else {
    paneTabs = workspace.tabs;
    activeTabId = workspace.activeTabId;
  }

  var shouldShow = paneTabs.length > 1 || paneTabs.some(function (t) { return t.closeable; });

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
    e.preventDefault();
    if (workspace.panes.length >= 2) return;
    var contextPane = paneId
      ? workspace.panes.find(function (p) { return p.id === paneId; })
      : workspace.panes[0];
    if (!contextPane || contextPane.tabIds.length < 2) return;
    var menuWidth = 160;
    var menuHeight = 80;
    var x = e.clientX;
    var y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
    setContextMenu({ tabId, x, y });
  }

  function handleSplit(direction: "horizontal" | "vertical") {
    if (!contextMenu) return;
    workspace.splitPane(contextMenu.tabId, direction);
    setContextMenu(null);
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
              <span className="truncate text-[12px]">{label}</span>
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
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-base-300 border border-base-content/15 rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={function () { handleSplit("horizontal"); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] font-mono text-base-content/80 hover:bg-base-content/15 hover:text-base-content transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Columns2 size={14} />
            Split Right
          </button>
          <button
            onClick={function () { handleSplit("vertical"); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] font-mono text-base-content/80 hover:bg-base-content/15 hover:text-base-content transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Rows2 size={14} />
            Split Down
          </button>
        </div>
      )}
    </>
  );
}
