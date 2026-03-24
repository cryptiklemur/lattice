import { Store } from "@tanstack/react-store";
import type { DecodedWorkspace } from "../lib/workspace-url";

export type TabType = "chat" | "files" | "terminal" | "notes" | "tasks" | "bookmarks" | "analytics";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
  sessionId?: string;
  projectSlug?: string;
}

export interface Pane {
  id: string;
  tabIds: string[];
  activeTabId: string;
}

export interface WorkspaceState {
  tabs: Tab[];
  panes: Pane[];
  activePaneId: string;
  splitDirection: "horizontal" | "vertical" | null;
  splitRatio: number;
}

var CHAT_TAB: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false };

var DEFAULT_PANE: Pane = { id: "pane-1", tabIds: ["chat"], activeTabId: "chat" };

var workspaceStore = new Store<WorkspaceState>({
  tabs: [CHAT_TAB],
  panes: [DEFAULT_PANE],
  activePaneId: "pane-1",
  splitDirection: null,
  splitRatio: 0.5,
});

export function getWorkspaceStore(): Store<WorkspaceState> {
  return workspaceStore;
}

export function openTab(type: TabType): void {
  workspaceStore.setState(function (state) {
    var existing = state.tabs.find(function (t) { return t.type === type && !t.sessionId; });
    if (existing) {
      var paneWithTab = state.panes.find(function (p) {
        return p.tabIds.indexOf(existing!.id) !== -1;
      });
      if (paneWithTab) {
        return {
          ...state,
          activePaneId: paneWithTab.id,
          panes: state.panes.map(function (p) {
            if (p.id === paneWithTab!.id) {
              return { ...p, activeTabId: existing!.id };
            }
            return p;
          }),
        };
      }
      return state;
    }
    var labels: Record<TabType, string> = {
      chat: "Chat",
      files: "Files",
      terminal: "Terminal",
      notes: "Notes",
      tasks: "Tasks",
      bookmarks: "Bookmarks",
      analytics: "Analytics",
    };
    var tab: Tab = {
      id: type,
      type: type,
      label: labels[type],
      closeable: type !== "chat",
    };

    var defaultChat = state.tabs.find(function (t) { return t.id === "chat" && !t.sessionId; });
    var hasOnlyDefaultChat = defaultChat && state.tabs.length === 1;

    var newTabs = hasOnlyDefaultChat
      ? [tab]
      : [...state.tabs, tab];

    var newPanes = state.panes.map(function (p) {
      if (p.id === state.activePaneId) {
        var updatedTabIds = hasOnlyDefaultChat
          ? p.tabIds.map(function (id) { return id === "chat" ? tab.id : id; })
          : [...p.tabIds, tab.id];
        return {
          ...p,
          tabIds: updatedTabIds,
          activeTabId: tab.id,
        };
      }
      return p;
    });
    return {
      ...state,
      tabs: newTabs,
      panes: newPanes,
    };
  });
}

export function openSessionTab(sessionId: string, projectSlug: string, title: string): void {
  workspaceStore.setState(function (state) {
    var tabId = "chat-" + sessionId;
    var existing = state.tabs.find(function (t) { return t.id === tabId; });
    if (existing) {
      var paneWithTab = state.panes.find(function (p) {
        return p.tabIds.indexOf(tabId) !== -1;
      });
      if (paneWithTab) {
        return {
          ...state,
          activePaneId: paneWithTab.id,
          panes: state.panes.map(function (p) {
            if (p.id === paneWithTab!.id) {
              return { ...p, activeTabId: tabId };
            }
            return p;
          }),
        };
      }
      return state;
    }

    var tab: Tab = {
      id: tabId,
      type: "chat",
      label: title || "Session",
      closeable: true,
      sessionId: sessionId,
      projectSlug: projectSlug,
    };

    var hadDefaultChat = state.tabs.some(function (t) { return t.id === "chat"; });

    var newTabs = hadDefaultChat
      ? state.tabs.filter(function (t) { return t.id !== "chat"; }).concat([tab])
      : [...state.tabs, tab];

    var newPanes = state.panes.map(function (p) {
      var updatedTabIds = hadDefaultChat
        ? p.tabIds.map(function (id) { return id === "chat" ? tabId : id; })
        : (p.id === state.activePaneId ? [...p.tabIds, tabId] : p.tabIds);

      var needsActiveUpdate = hadDefaultChat
        ? (p.activeTabId === "chat" || p.id === state.activePaneId)
        : p.id === state.activePaneId;

      return {
        ...p,
        tabIds: updatedTabIds,
        activeTabId: needsActiveUpdate ? tabId : p.activeTabId,
      };
    });

    return {
      ...state,
      tabs: newTabs,
      panes: newPanes,
    };
  });
}

export function updateSessionTabTitle(sessionId: string, title: string): void {
  workspaceStore.setState(function (state) {
    var tabId = "chat-" + sessionId;
    var found = false;
    var newTabs = state.tabs.map(function (t) {
      if (t.id === tabId) {
        found = true;
        return { ...t, label: title };
      }
      return t;
    });
    if (!found) return state;
    return { ...state, tabs: newTabs };
  });
}

export function closeTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    var tab = state.tabs.find(function (t) { return t.id === tabId; });
    if (!tab || !tab.closeable) return state;

    var chatTabCount = 0;
    for (var i = 0; i < state.tabs.length; i++) {
      if (state.tabs[i].type === "chat") chatTabCount++;
    }

    var isLastChatTab = tab.type === "chat" && chatTabCount <= 1;

    if (isLastChatTab) {
      var replacementTab: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false };
      var replacedTabs = state.tabs.map(function (t) {
        if (t.id === tabId) return replacementTab;
        return t;
      });
      var replacedPanes = state.panes.map(function (p) {
        var newTabIds = p.tabIds.map(function (id) { return id === tabId ? "chat" : id; });
        var newActiveTabId = p.activeTabId === tabId ? "chat" : p.activeTabId;
        return { ...p, tabIds: newTabIds, activeTabId: newActiveTabId };
      });
      return { ...state, tabs: replacedTabs, panes: replacedPanes };
    }

    var filteredTabs = state.tabs.filter(function (t) { return t.id !== tabId; });
    var newPanes = state.panes.map(function (p) {
      var idx = p.tabIds.indexOf(tabId);
      if (idx === -1) return p;
      var newTabIds = p.tabIds.filter(function (id) { return id !== tabId; });
      var newActiveTabId = p.activeTabId === tabId
        ? (newTabIds.length > 0 ? newTabIds[Math.max(0, idx - 1)] : "")
        : p.activeTabId;
      return { ...p, tabIds: newTabIds, activeTabId: newActiveTabId };
    });

    var emptyPane = newPanes.find(function (p) { return p.tabIds.length === 0; });
    if (emptyPane && newPanes.length > 1) {
      var remainingPanes = newPanes.filter(function (p) { return p.tabIds.length > 0; });
      return {
        tabs: filteredTabs,
        panes: remainingPanes,
        activePaneId: remainingPanes[0].id,
        splitDirection: null,
        splitRatio: 0.5,
      };
    }

    var hasEmptySinglePane = newPanes.length === 1 && newPanes[0].tabIds.length === 0;
    if (hasEmptySinglePane) {
      var defaultTab: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false };
      return {
        tabs: [defaultTab],
        panes: [{ ...newPanes[0], tabIds: ["chat"], activeTabId: "chat" }],
        activePaneId: newPanes[0].id,
        splitDirection: null,
        splitRatio: 0.5,
      };
    }

    return {
      ...state,
      tabs: filteredTabs,
      panes: newPanes,
    };
  });
}

export function setActiveTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    var paneWithTab = state.panes.find(function (p) {
      return p.tabIds.indexOf(tabId) !== -1;
    });
    if (!paneWithTab) return state;
    return {
      ...state,
      activePaneId: paneWithTab.id,
      panes: state.panes.map(function (p) {
        if (p.id === paneWithTab!.id) {
          return { ...p, activeTabId: tabId };
        }
        return p;
      }),
    };
  });
}

export function resetWorkspace(): void {
  workspaceStore.setState(function () {
    return {
      tabs: [CHAT_TAB],
      panes: [{ id: "pane-1", tabIds: ["chat"], activeTabId: "chat" }],
      activePaneId: "pane-1",
      splitDirection: null,
      splitRatio: 0.5,
    };
  });
}

export function splitPane(tabId: string, direction: "horizontal" | "vertical"): void {
  workspaceStore.setState(function (state) {
    if (state.panes.length >= 2) return state;

    var sourcePane = state.panes.find(function (p) {
      return p.tabIds.indexOf(tabId) !== -1;
    });
    if (!sourcePane) return state;
    if (sourcePane.tabIds.length < 2) return state;

    var newPaneId = "pane-" + Date.now();
    var newSourceTabIds = sourcePane.tabIds.filter(function (id) { return id !== tabId; });
    var newSourceActiveTabId = sourcePane.activeTabId === tabId
      ? newSourceTabIds[newSourceTabIds.length - 1]
      : sourcePane.activeTabId;

    var updatedSourcePane: Pane = {
      ...sourcePane,
      tabIds: newSourceTabIds,
      activeTabId: newSourceActiveTabId,
    };

    var newPane: Pane = {
      id: newPaneId,
      tabIds: [tabId],
      activeTabId: tabId,
    };

    var newPanes = state.panes.map(function (p) {
      if (p.id === sourcePane!.id) return updatedSourcePane;
      return p;
    });
    newPanes.push(newPane);

    return {
      ...state,
      panes: newPanes,
      activePaneId: newPaneId,
      splitDirection: direction,
      splitRatio: 0.5,
    };
  });
}

export function closePane(paneId: string): void {
  workspaceStore.setState(function (state) {
    if (state.panes.length <= 1) return state;

    var closingPane = state.panes.find(function (p) { return p.id === paneId; });
    var remainingPane = state.panes.find(function (p) { return p.id !== paneId; });
    if (!closingPane || !remainingPane) return state;

    var mergedTabIds = [...remainingPane.tabIds, ...closingPane.tabIds];

    return {
      ...state,
      panes: [{
        ...remainingPane,
        tabIds: mergedTabIds,
      }],
      activePaneId: remainingPane.id,
      splitDirection: null,
      splitRatio: 0.5,
    };
  });
}

export function setPaneActiveTab(paneId: string, tabId: string): void {
  workspaceStore.setState(function (state) {
    return {
      ...state,
      activePaneId: paneId,
      panes: state.panes.map(function (p) {
        if (p.id === paneId) {
          return { ...p, activeTabId: tabId };
        }
        return p;
      }),
    };
  });
}

export function setSplitRatio(ratio: number): void {
  var clamped = Math.min(0.8, Math.max(0.2, ratio));
  workspaceStore.setState(function (state) {
    return { ...state, splitRatio: clamped };
  });
}

export function setActivePaneId(paneId: string): void {
  workspaceStore.setState(function (state) {
    return { ...state, activePaneId: paneId };
  });
}

export function getActiveSessionTab(): Tab | null {
  var state = workspaceStore.state;
  var activePane = state.panes.find(function (p) { return p.id === state.activePaneId; });
  if (!activePane) return null;
  var activeTab = state.tabs.find(function (t) { return t.id === activePane!.activeTabId; });
  if (!activeTab || activeTab.type !== "chat") return null;
  return activeTab;
}

let urlSyncCallback: (() => void) | null = null;
let urlSyncSuppressed = false;

export function setUrlSyncCallback(cb: () => void): void {
  urlSyncCallback = cb;
}

function notifyUrlSync(): void {
  if (!urlSyncSuppressed && urlSyncCallback) {
    urlSyncCallback();
  }
}

export function restoreWorkspace(data: DecodedWorkspace): void {
  urlSyncSuppressed = true;
  workspaceStore.setState(function (state) {
    return {
      ...state,
      tabs: data.tabs,
      panes: data.panes,
      activePaneId: data.activePaneId,
      splitDirection: data.splitDirection,
    };
  });
  urlSyncSuppressed = false;
}

workspaceStore.subscribe(function () {
  notifyUrlSync();
});
