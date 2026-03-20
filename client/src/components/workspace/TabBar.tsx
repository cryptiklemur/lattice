import { useState, useEffect, useRef } from "react";
import { X, Columns2, Rows2 } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Tab } from "../../stores/workspace";

interface TabBarProps {
  paneId?: string;
}

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

export function TabBar({ paneId }: TabBarProps) {
  var workspace = useWorkspace();
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

  if (paneTabs.length <= 1 && workspace.panes.length <= 1) return null;

  function handleTabClick(tabId: string) {
    if (paneId) {
      workspace.setPaneActiveTab(paneId, tabId);
    } else {
      workspace.setActiveTab(tabId);
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

  return (
    <>
      <div className="flex items-center h-9 bg-base-200 border-b border-base-content/15 overflow-x-auto flex-shrink-0">
        {paneTabs.map(function (tab) {
          var isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={function () { handleTabClick(tab.id); }}
              onContextMenu={function (e) { handleContextMenu(e, tab.id); }}
              className={
                "flex items-center gap-1.5 px-3 h-full text-[12px] font-mono border-r border-base-content/15 transition-colors whitespace-nowrap flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200 " +
                (isActive
                  ? "bg-base-100 text-base-content border-b-2 border-b-primary"
                  : "text-base-content/50 hover:text-base-content/80 hover:bg-base-300/30")
              }
            >
              <span>{tab.label}</span>
              {tab.closeable && (
                <button
                  aria-label={"Close " + tab.label + " tab"}
                  onClick={function (e) {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-base-content/15 text-base-content/30 hover:text-base-content/60 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
                >
                  <X size={11} />
                </button>
              )}
            </button>
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
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] font-mono text-base-content/80 hover:bg-base-content/15 hover:text-base-content transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
          >
            <Columns2 size={14} />
            Split Right
          </button>
          <button
            onClick={function () { handleSplit("vertical"); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] font-mono text-base-content/80 hover:bg-base-content/15 hover:text-base-content transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-base-200"
          >
            <Rows2 size={14} />
            Split Down
          </button>
        </div>
      )}
    </>
  );
}
