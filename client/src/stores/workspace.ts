import { Store } from "@tanstack/react-store";

export type TabType = "chat" | "files" | "terminal" | "notes" | "tasks";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closeable: boolean;
}

export interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string;
}

var CHAT_TAB: Tab = { id: "chat", type: "chat", label: "Chat", closeable: false };

var workspaceStore = new Store<WorkspaceState>({
  tabs: [CHAT_TAB],
  activeTabId: "chat",
});

export function getWorkspaceStore(): Store<WorkspaceState> {
  return workspaceStore;
}

export function openTab(type: TabType): void {
  workspaceStore.setState(function (state) {
    var existing = state.tabs.find(function (t) { return t.type === type; });
    if (existing) {
      return { ...state, activeTabId: existing.id };
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
    return {
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    };
  });
}

export function closeTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    var tab = state.tabs.find(function (t) { return t.id === tabId; });
    if (!tab || !tab.closeable) return state;
    var filtered = state.tabs.filter(function (t) { return t.id !== tabId; });
    var newActiveId = state.activeTabId === tabId
      ? (filtered.length > 0 ? filtered[filtered.length - 1].id : "chat")
      : state.activeTabId;
    return { tabs: filtered, activeTabId: newActiveId };
  });
}

export function setActiveTab(tabId: string): void {
  workspaceStore.setState(function (state) {
    return { ...state, activeTabId: tabId };
  });
}

export function resetWorkspace(): void {
  workspaceStore.setState(function () {
    return { tabs: [CHAT_TAB], activeTabId: "chat" };
  });
}
