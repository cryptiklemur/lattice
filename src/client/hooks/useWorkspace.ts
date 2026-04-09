import { useStore } from "@tanstack/react-store";
import {
  getWorkspaceStore,
  openTab,
  openSessionTab,
  updateSessionTabTitle,
  closeTab,
  setActiveTab,
  resetWorkspace,
  splitPane,
  closePane,
  setPaneActiveTab,
  setSplitRatio,
  setActivePaneId,
  getActiveSessionTab,
  reorderTab,
  moveTabToPane,
} from "../stores/workspace";
import type { WorkspaceState, TabType, Tab } from "../stores/workspace";

export interface UseWorkspaceReturn extends WorkspaceState {
  activeTabId: string;
  openTab: (type: TabType) => void;
  openSessionTab: (sessionId: string, projectSlug: string, title: string) => void;
  updateSessionTabTitle: (sessionId: string, title: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  resetWorkspace: () => void;
  splitPane: (tabId: string, direction: "horizontal" | "vertical", position?: "before" | "after") => void;
  closePane: (paneId: string) => void;
  setPaneActiveTab: (paneId: string, tabId: string) => void;
  setSplitRatio: (ratio: number) => void;
  setActivePaneId: (paneId: string) => void;
  getActiveSessionTab: () => Tab | null;
  reorderTab: (paneId: string, fromIndex: number, toIndex: number) => void;
  moveTabToPane: (tabId: string, sourcePaneId: string, targetPaneId: string) => void;
}

export function useWorkspace(): UseWorkspaceReturn {
  const state = useStore(getWorkspaceStore(), function (s) { return s; });
  return {
    tabs: state.tabs,
    panes: state.panes,
    activePaneId: state.activePaneId,
    splitDirection: state.splitDirection,
    splitRatio: state.splitRatio,
    activeTabId: state.panes.find(function (p) { return p.id === state.activePaneId; })?.activeTabId ?? state.panes[0]?.activeTabId ?? "chat",
    openTab: openTab,
    openSessionTab: openSessionTab,
    updateSessionTabTitle: updateSessionTabTitle,
    closeTab: closeTab,
    setActiveTab: setActiveTab,
    resetWorkspace: resetWorkspace,
    splitPane: splitPane,
    closePane: closePane,
    setPaneActiveTab: setPaneActiveTab,
    setSplitRatio: setSplitRatio,
    setActivePaneId: setActivePaneId,
    getActiveSessionTab: getActiveSessionTab,
    reorderTab: reorderTab,
    moveTabToPane: moveTabToPane,
  };
}
