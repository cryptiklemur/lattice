import { useStore } from "@tanstack/react-store";
import {
  getWorkspaceStore,
  openTab,
  closeTab,
  setActiveTab,
  resetWorkspace,
  splitPane,
  closePane,
  setPaneActiveTab,
  setSplitRatio,
  setActivePaneId,
} from "../stores/workspace";
import type { WorkspaceState, TabType } from "../stores/workspace";

export interface UseWorkspaceReturn extends WorkspaceState {
  activeTabId: string;
  openTab: (type: TabType) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  resetWorkspace: () => void;
  splitPane: (tabId: string, direction: "horizontal" | "vertical") => void;
  closePane: (paneId: string) => void;
  setPaneActiveTab: (paneId: string, tabId: string) => void;
  setSplitRatio: (ratio: number) => void;
  setActivePaneId: (paneId: string) => void;
}

export function useWorkspace(): UseWorkspaceReturn {
  var state = useStore(getWorkspaceStore(), function (s) { return s; });
  return {
    tabs: state.tabs,
    panes: state.panes,
    activePaneId: state.activePaneId,
    splitDirection: state.splitDirection,
    splitRatio: state.splitRatio,
    activeTabId: state.panes.find(function (p) { return p.id === state.activePaneId; })?.activeTabId ?? state.panes[0]?.activeTabId ?? "chat",
    openTab: openTab,
    closeTab: closeTab,
    setActiveTab: setActiveTab,
    resetWorkspace: resetWorkspace,
    splitPane: splitPane,
    closePane: closePane,
    setPaneActiveTab: setPaneActiveTab,
    setSplitRatio: setSplitRatio,
    setActivePaneId: setActivePaneId,
  };
}
