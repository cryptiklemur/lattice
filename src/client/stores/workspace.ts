import { Store } from "@tanstack/react-store";
import type { DecodedWorkspace } from "../lib/workspace-url";

export type TabType = "chat" | "files" | "terminal" | "notes" | "tasks" | "bookmarks" | "analytics" | "brainstorm" | "specs" | "context";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
  pinned: boolean;
  sessionId?: string;
  projectSlug?: string;
  sessionType?: string;
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

const CHAT_TAB: Tab = { id: "chat", type: "chat", label: "Chat", closeable: true, pinned: true };

const DEFAULT_PANE: Pane = { id: "pane-1", tabIds: ["chat"], activeTabId: "chat" };

const workspaceStore = new Store<WorkspaceState>({
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
    const existing = state.tabs.find(function (t) { return t.type === type && !t.sessionId; });
    if (existing) {
      const paneWithTab = state.panes.find(function (p) {
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
    const labels: Record<TabType, string> = {
      chat: "Chat",
      files: "Files",
      terminal: "Terminal",
      notes: "Notes",
      tasks: "Tasks",
      bookmarks: "Bookmarks",
      analytics: "Analytics",
      brainstorm: "Brainstorm",
      specs: "Specs",
      context: "Context",
    };
    const tab: Tab = {
      id: type,
      type: type,
      label: labels[type],
      closeable: true,
      pinned: true,
    };

    const defaultChat = state.tabs.find(function (t) { return t.id === "chat" && !t.sessionId; });
    const shouldReplace = defaultChat && state.tabs.length === 1 && type !== "brainstorm";

    const newTabs = shouldReplace
      ? [tab]
      : [...state.tabs, tab];

    const newPanes = state.panes.map(function (p) {
      if (p.id === state.activePaneId) {
        const updatedTabIds = shouldReplace
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

let pendingSpecId: string | null = null;

export function getPendingSpecId(): string | null {
  return pendingSpecId;
}

export function clearPendingSpecId(): void {
  pendingSpecId = null;
}

export function openSpecById(specId: string): void {
  pendingSpecId = specId;
  openTab("specs");
}

export function openSessionTab(sessionId: string, projectSlug: string, title: string, sessionType?: string): void {
  workspaceStore.setState(function (state) {
    const tabId = "chat-" + sessionId;
    const existing = state.tabs.find(function (t) { return t.id === tabId; });
    if (existing) {
      const paneWithTab = state.panes.find(function (p) {
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

    const tab: Tab = {
      id: tabId,
      type: "chat",
      label: title || "Session",
      closeable: true,
      pinned: false,
      sessionId: sessionId,
      projectSlug: projectSlug,
      sessionType: sessionType,
    };

    const previewTab = state.tabs.find(function (t) { return t.type === "chat" && t.sessionId && !t.pinned; });
    const hadDefaultChat = state.tabs.some(function (t) { return t.id === "chat"; });

    let newTabs: Tab[];
    let newPanes: Pane[];

    if (previewTab) {
      const oldId = previewTab.id;
      newTabs = state.tabs.map(function (t) { return t.id === oldId ? tab : t; });
      newPanes = state.panes.map(function (p) {
        const updatedTabIds = p.tabIds.map(function (id) { return id === oldId ? tabId : id; });
        const shouldActivate = p.activeTabId === oldId || p.id === state.activePaneId;
        return {
          ...p,
          tabIds: updatedTabIds,
          activeTabId: shouldActivate ? tabId : p.activeTabId,
        };
      });
    } else if (hadDefaultChat) {
      newTabs = state.tabs.filter(function (t) { return t.id !== "chat"; }).concat([tab]);
      newPanes = state.panes.map(function (p) {
        const updatedTabIds = p.tabIds.map(function (id) { return id === "chat" ? tabId : id; });
        const needsActiveUpdate = p.activeTabId === "chat" || p.id === state.activePaneId;
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
    const tabId = "chat-" + sessionId;
    let found = false;
    const newTabs = state.tabs.map(function (t) {
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

type TabCloseListener = (tab: Tab) => void;
let tabCloseListeners: TabCloseListener[] = [];

export function onTabClose(listener: TabCloseListener): () => void {
  tabCloseListeners.push(listener);
  return function () {
    tabCloseListeners = tabCloseListeners.filter(function (l) { return l !== listener; });
  };
}

export function closeTab(tabId: string): void {
  const closingTab = workspaceStore.state.tabs.find(function (t) { return t.id === tabId; });
  workspaceStore.setState(function (state) {
    const tab = state.tabs.find(function (t) { return t.id === tabId; });
    if (!tab || !tab.closeable) return state;

    const filteredTabs = state.tabs.filter(function (t) { return t.id !== tabId; });
    const newPanes = state.panes.map(function (p) {
      const idx = p.tabIds.indexOf(tabId);
      if (idx === -1) return p;
      const newTabIds = p.tabIds.filter(function (id) { return id !== tabId; });
      const newActiveTabId = p.activeTabId === tabId
        ? (newTabIds.length > 0 ? newTabIds[Math.max(0, idx - 1)] : "")
        : p.activeTabId;
      return { ...p, tabIds: newTabIds, activeTabId: newActiveTabId };
    });

    const emptyPane = newPanes.find(function (p) { return p.tabIds.length === 0; });
    if (emptyPane && newPanes.length > 1) {
      const remainingPanes = newPanes.filter(function (p) { return p.tabIds.length > 0; });
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
      splitDirection: newPanes.length < 2 ? null : state.splitDirection,
      splitRatio: newPanes.length < 2 ? 0.5 : state.splitRatio,
    };
  });
  if (closingTab && closingTab.closeable) {
    for (let i = 0; i < tabCloseListeners.length; i++) {
      tabCloseListeners[i](closingTab);
    }
  }
}

export function setActiveTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    const paneWithTab = state.panes.find(function (p) {
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

export function splitPane(tabId: string, direction: "horizontal" | "vertical", position?: "before" | "after"): void {
  workspaceStore.setState(function (state) {
    if (state.panes.length >= 2) return state;

    const sourcePane = state.panes.find(function (p) {
      return p.tabIds.indexOf(tabId) !== -1;
    });
    if (!sourcePane) return state;
    if (sourcePane.tabIds.length < 2) return state;

    const newPaneId = "pane-" + Date.now();
    const newSourceTabIds = sourcePane.tabIds.filter(function (id) { return id !== tabId; });
    const newSourceActiveTabId = sourcePane.activeTabId === tabId
      ? newSourceTabIds[newSourceTabIds.length - 1]
      : sourcePane.activeTabId;

    const updatedSourcePane: Pane = {
      ...sourcePane,
      tabIds: newSourceTabIds,
      activeTabId: newSourceActiveTabId,
    };

    const newPane: Pane = {
      id: newPaneId,
      tabIds: [tabId],
      activeTabId: tabId,
    };

    const newPanes = state.panes.map(function (p) {
      if (p.id === sourcePane!.id) return updatedSourcePane;
      return p;
    });
    if (position === "before") {
      const sourceIndex = newPanes.findIndex(function (p) { return p.id === sourcePane!.id; });
      newPanes.splice(sourceIndex, 0, newPane);
    } else {
      newPanes.push(newPane);
    }

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

    const closingPane = state.panes.find(function (p) { return p.id === paneId; });
    const remainingPane = state.panes.find(function (p) { return p.id !== paneId; });
    if (!closingPane || !remainingPane) return state;

    const mergedTabIds: string[] = [];
    const mergedSeen = new Set<string>();
    const allIds = [...remainingPane.tabIds, ...closingPane.tabIds];
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
  const clamped = Math.min(0.8, Math.max(0.2, ratio));
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
    const pane = state.panes.find(function (p) { return p.id === paneId; });
    if (!pane) return state;
    if (fromIndex < 0 || fromIndex >= pane.tabIds.length) return state;
    if (toIndex < 0 || toIndex >= pane.tabIds.length) return state;
    const newTabIds = [...pane.tabIds];
    const [moved] = newTabIds.splice(fromIndex, 1);
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
    const sourcePane = state.panes.find(function (p) { return p.id === sourcePaneId; });
    const targetPane = state.panes.find(function (p) { return p.id === targetPaneId; });
    if (!sourcePane || !targetPane) return state;
    if (sourcePane.tabIds.indexOf(tabId) === -1) return state;
    if (targetPane.tabIds.indexOf(tabId) !== -1) return state;

    const newSourceTabIds = sourcePane.tabIds.filter(function (id) { return id !== tabId; });
    const newTargetTabIds = [...targetPane.tabIds, tabId];

    const newSourceActiveTabId = sourcePane.activeTabId === tabId
      ? (newSourceTabIds.length > 0 ? newSourceTabIds[Math.max(0, sourcePane.tabIds.indexOf(tabId) - 1)] : "")
      : sourcePane.activeTabId;

    const newPanes = state.panes.map(function (p) {
      if (p.id === sourcePaneId) {
        return { ...p, tabIds: newSourceTabIds, activeTabId: newSourceActiveTabId };
      }
      if (p.id === targetPaneId) {
        return { ...p, tabIds: newTargetTabIds, activeTabId: tabId };
      }
      return p;
    });

    const emptyPane = newPanes.find(function (p) { return p.tabIds.length === 0; });
    if (emptyPane && newPanes.length > 1) {
      const remainingPanes = newPanes.filter(function (p) { return p.tabIds.length > 0; });
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
  const state = workspaceStore.state;
  const activePane = state.panes.find(function (p) { return p.id === state.activePaneId; });
  if (!activePane) return null;
  const activeTab = state.tabs.find(function (t) { return t.id === activePane!.activeTabId; });
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

let currentProjectKey: string = "__global__";

export function setCurrentProjectKey(slug: string | null): void {
  currentProjectKey = slug || "__global__";
}

function storageKey(projectSlug: string | null): string {
  return "lattice:workspace:" + (projectSlug || "__global__");
}

export function saveWorkspaceForProject(projectSlug: string | null): void {
  let key = storageKey(projectSlug);
  let state = workspaceStore.state;
  let persistedTabs = state.tabs.filter(function (t) { return t.type !== "brainstorm"; });
  let persistedPanes = state.panes.map(function (p) {
    let filteredIds = p.tabIds.filter(function (id) {
      return !state.tabs.some(function (t) { return t.id === id && t.type === "brainstorm"; });
    });
    if (filteredIds.length === 0) return null;
    let activeStillExists = filteredIds.indexOf(p.activeTabId) !== -1;
    return { ...p, tabIds: filteredIds, activeTabId: activeStillExists ? p.activeTabId : filteredIds[0] };
  }).filter(function (p) { return p !== null; }) as Pane[];
  if (persistedPanes.length === 0) {
    persistedTabs = [];
    persistedPanes = [{ id: "pane-1", tabIds: [], activeTabId: "" }];
  }
  try {
    localStorage.setItem(key, JSON.stringify({
      tabs: persistedTabs,
      panes: persistedPanes,
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
      if (saved.tabs && saved.panes && saved.panes.length > 0) {
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
      tabs: [],
      panes: [{ id: "pane-1", tabIds: [], activeTabId: "" }],
      activePaneId: "pane-1",
      splitDirection: null,
      splitRatio: 0.5,
    };
  });
  urlSyncSuppressed = false;
}

let saveSuppressed = false;

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
