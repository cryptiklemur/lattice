import { useStore } from "@tanstack/react-store";
import {
  getWorkspaceStore,
  openTab,
  closeTab,
  setActiveTab,
  resetWorkspace,
} from "../stores/workspace";
import type { WorkspaceState, TabType } from "../stores/workspace";

export interface UseWorkspaceReturn extends WorkspaceState {
  openTab: (type: TabType) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  resetWorkspace: () => void;
}

export function useWorkspace(): UseWorkspaceReturn {
  var state = useStore(getWorkspaceStore(), function (s) { return s; });
  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openTab: openTab,
    closeTab: closeTab,
    setActiveTab: setActiveTab,
    resetWorkspace: resetWorkspace,
  };
}
