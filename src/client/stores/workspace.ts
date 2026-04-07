import { Store } from "@tanstack/react-store";
import type { DecodedWorkspace } from "../lib/workspace-url";

export type TabType = "chat" | "files" | "terminal" | "notes" | "tasks" | "bookmarks" | "analytics" | "brainstorm" | "specs";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
  pinned: boolean;
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

var CHAT_TAB: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false, pinned: true };

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
      brainstorm: "Brainstorm",
      specs: "Specs",
    };
    var tab: Tab = {
      id: type,
      type: type,
      label: labels[type],
      closeable: type !== "chat",
      pinned: true,
    };

    var defaultChat = state.tabs.find(function (t) { return t.id === "chat" && !t.sessionId; });
    var shouldReplace = defaultChat && state.tabs.length === 1 && type !== "brainstorm";

    var newTabs = shouldReplace
      ? [tab]
      : [...state.tabs, tab];

    var newPanes = state.panes.map(function (p) {
      if (p.id === state.activePaneId) {
        var updatedTabIds = shouldReplace
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
      pinned: false,
      sessionId: sessionId,
      projectSlug: projectSlug,
    };

    var previewTab = state.tabs.find(function (t) { return t.type === "chat" && t.sessionId && !t.pinned; });
    var hadDefaultChat = state.tabs.some(function (t) { return t.id === "chat"; });

    var newTabs: Tab[];
    var newPanes: Pane[];

    if (previewTab) {
      var oldId = previewTab.id;
      newTabs = state.tabs.map(function (t) { return t.id === oldId ? tab : t; });
      newPanes = state.panes.map(function (p) {
        var updatedTabIds = p.tabIds.map(function (id) { return id === oldId ? tabId : id; });
        return {
          ...p,
          tabIds: updatedTabIds,
          activeTabId: p.activeTabId === oldId ? tabId : p.activeTabId,
        };
      });
    } else if (hadDefaultChat) {
      newTabs = state.tabs.filter(function (t) { return t.id !== "chat"; }).concat([tab]);
      newPanes = state.panes.map(function (p) {
        var updatedTabIds = p.tabIds.map(function (id) { return id === "chat" ? tabId : id; });
        var needsActiveUpdate = p.activeTabId === "chat" || p.id === state.activePaneId;
        return { ...p, tabIds: updatedTabIds, activeTabId: needsActiveUpdate ? tabId : p.activeTabId };
      });
    } else {
      newTabs = [...state.tabs, tab];
      newPanes = state.panes.map(function (p) {
        return p.id === state.activePaneId
          ? { ...p, tabIds: [...p.tabIds, tabId], activeTabId: tabId }
          : p;
      });
    }

    return { ...state, tabs: newTabs, panes: newPanes };
  });
}

export function pinTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    return {
      ...state,
      tabs: state.tabs.map(function (t) {
        return t.id === tabId ? { ...t, pinned: true } : t;
      }),
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
      var replacementTab: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false, pinned: true };
      var replacedTabs = state.tabs.map(function (t) {
        if (t.id === tabId) return replacementTab;
        return t;
      });
      var replacedPanes = state.panes.map(function (p) {
        var newTabIds = p.tabIds.map(function (id) { return id === tabId ? "chat" : id; });
        var seen = new Set<string>();
        newTabIds = newTabIds.filter(function (id) {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
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
      var defaultTab: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false, pinned: true };
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

    var mergedTabIds: string[] = [];
    var mergedSeen = new Set<string>();
    var allIds = [...remainingPane.tabIds, ...closingPane.tabIds];
    for (let i = 0; i < allIds.length; i++) {
      if (!mergedSeen.has(allIds[i])) {
        mergedSeen.add(allIds[i]);
        mergedTabIds.push(allIds[i]);
      }
    }

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

export function reorderTab(paneId: string, fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  workspaceStore.setState(function (state) {
    var pane = state.panes.find(function (p) { return p.id === paneId; });
    if (!pane) return state;
    if (fromIndex < 0 || fromIndex >= pane.tabIds.length) return state;
    if (toIndex < 0 || toIndex >= pane.tabIds.length) return state;
    var newTabIds = [...pane.tabIds];
    var [moved] = newTabIds.splice(fromIndex, 1);
    newTabIds.splice(toIndex, 0, moved);
    return {
      ...state,
      panes: state.panes.map(function (p) {
        if (p.id === paneId) return { ...p, tabIds: newTabIds };
        return p;
      }),
    };
  });
}

export function moveTabToPane(tabId: string, sourcePaneId: string, targetPaneId: string): void {
  if (sourcePaneId === targetPaneId) return;
  workspaceStore.setState(function (state) {
    var sourcePane = state.panes.find(function (p) { return p.id === sourcePaneId; });
    var targetPane = state.panes.find(function (p) { return p.id === targetPaneId; });
    if (!sourcePane || !targetPane) return state;
    if (sourcePane.tabIds.indexOf(tabId) === -1) return state;
    if (targetPane.tabIds.indexOf(tabId) !== -1) return state;

    var newSourceTabIds = sourcePane.tabIds.filter(function (id) { return id !== tabId; });
    var newTargetTabIds = [...targetPane.tabIds, tabId];

    var newSourceActiveTabId = sourcePane.activeTabId === tabId
      ? (newSourceTabIds.length > 0 ? newSourceTabIds[Math.max(0, sourcePane.tabIds.indexOf(tabId) - 1)] : "")
      : sourcePane.activeTabId;

    var newPanes = state.panes.map(function (p) {
      if (p.id === sourcePaneId) {
        return { ...p, tabIds: newSourceTabIds, activeTabId: newSourceActiveTabId };
      }
      if (p.id === targetPaneId) {
        return { ...p, tabIds: newTargetTabIds, activeTabId: tabId };
      }
      return p;
    });

    var emptyPane = newPanes.find(function (p) { return p.tabIds.length === 0; });
    if (emptyPane && newPanes.length > 1) {
      var remainingPanes = newPanes.filter(function (p) { return p.tabIds.length > 0; });
      return {
        tabs: state.tabs,
        panes: remainingPanes,
        activePaneId: targetPaneId,
        splitDirection: null,
        splitRatio: 0.5,
      };
    }

    return {
      ...state,
      panes: newPanes,
      activePaneId: targetPaneId,
    };
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

var currentProjectKey: string = "__global__";

export function setCurrentProjectKey(slug: string | null): void {
  currentProjectKey = slug || "__global__";
}

function storageKey(projectSlug: string | null): string {
  return "lattice:workspace:" + (projectSlug || "__global__");
}

export function saveWorkspaceForProject(projectSlug: string | null): void {
  let key = storageKey(projectSlug);
  let state = workspaceStore.state;
  try {
    localStorage.setItem(key, JSON.stringify({
      tabs: state.tabs,
      panes: state.panes,
      activePaneId: state.activePaneId,
      splitDirection: state.splitDirection,
      splitRatio: state.splitRatio,
    }));
  } catch {}
}

export function loadWorkspaceForProject(projectSlug: string | null): void {
  let key = storageKey(projectSlug);
  currentProjectKey = projectSlug || "__global__";

  try {
    let raw = localStorage.getItem(key);
    if (raw) {
      let saved = JSON.parse(raw) as WorkspaceState;
      if (saved.tabs && saved.panes && saved.tabs.length > 0 && saved.panes.length > 0) {
        let sanitizedPanes = saved.panes.map(function (p: Pane) {
          let seen = new Set<string>();
          let deduped = p.tabIds.filter(function (id: string) {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return deduped.length !== p.tabIds.length ? { ...p, tabIds: deduped } : p;
        });
        urlSyncSuppressed = true;
        workspaceStore.setState(function () {
          return {
            tabs: saved.tabs,
            panes: sanitizedPanes,
            activePaneId: saved.activePaneId || sanitizedPanes[0].id,
            splitDirection: saved.splitDirection || null,
            splitRatio: saved.splitRatio || 0.5,
          };
        });
        urlSyncSuppressed = false;
        return;
      }
    }
  } catch {}

  urlSyncSuppressed = true;
  workspaceStore.setState(function () {
    return {
      tabs: [{ id: "chat", type: "chat" as TabType, label: "Chat", closeable: false, pinned: true }],
      panes: [{ id: "pane-1", tabIds: ["chat"], activeTabId: "chat" }],
      activePaneId: "pane-1",
      splitDirection: null,
      splitRatio: 0.5,
    };
  });
  urlSyncSuppressed = false;
}

var saveSuppressed = false;

export function switchProjectWorkspace(fromSlug: string | null, toSlug: string | null): void {
  saveSuppressed = true;
  saveWorkspaceForProject(fromSlug);
  loadWorkspaceForProject(toSlug);
  saveSuppressed = false;
}

workspaceStore.subscribe(function () {
  notifyUrlSync();
  if (!saveSuppressed) {
    try {
      saveWorkspaceForProject(currentProjectKey === "__global__" ? null : currentProjectKey);
    } catch {}
  }
});
