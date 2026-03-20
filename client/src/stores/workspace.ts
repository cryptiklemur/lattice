import { Store } from "@tanstack/react-store";

export type TabType = "chat" | "files" | "terminal" | "notes" | "tasks";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
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
    var existing = state.tabs.find(function (t) { return t.type === type; });
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
    };
    var tab: Tab = {
      id: type,
      type: type,
      label: labels[type],
      closeable: type !== "chat",
    };
    var newPanes = state.panes.map(function (p) {
      if (p.id === state.activePaneId) {
        return {
          ...p,
          tabIds: [...p.tabIds, tab.id],
          activeTabId: tab.id,
        };
      }
      return p;
    });
    return {
      ...state,
      tabs: [...state.tabs, tab],
      panes: newPanes,
    };
  });
}

export function closeTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    var tab = state.tabs.find(function (t) { return t.id === tabId; });
    if (!tab || !tab.closeable) return state;

    var filteredTabs = state.tabs.filter(function (t) { return t.id !== tabId; });
    var newPanes = state.panes.map(function (p) {
      var idx = p.tabIds.indexOf(tabId);
      if (idx === -1) return p;
      var newTabIds = p.tabIds.filter(function (id) { return id !== tabId; });
      var newActiveTabId = p.activeTabId === tabId
        ? (newTabIds.length > 0 ? newTabIds[newTabIds.length - 1] : "")
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
