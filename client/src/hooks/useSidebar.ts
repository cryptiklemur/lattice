import { useStore } from "@tanstack/react-store";
import {
  getSidebarStore,
  setActiveProjectSlug,
  setActiveSessionId,
  openSettings,
  setSettingsSection,
  exitSettings,
  toggleUserMenu,
  toggleProjectDropdown,
  closeMenus,
  goToDashboard,
  toggleDrawer,
  closeDrawer,
} from "../stores/sidebar";
import type { SidebarState, SettingsSection } from "../stores/sidebar";

export function useSidebar(): SidebarState & {
  setActiveProjectSlug: (slug: string | null) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  openSettings: (section: SettingsSection) => void;
  setSettingsSection: (section: SettingsSection) => void;
  exitSettings: () => void;
  toggleUserMenu: () => void;
  toggleProjectDropdown: () => void;
  closeMenus: () => void;
  goToDashboard: () => void;
  toggleDrawer: () => void;
  closeDrawer: () => void;
} {
  var store = getSidebarStore();
  var state = useStore(store, function (s) { return s; });

  return {
    activeProjectSlug: state.activeProjectSlug,
    activeSessionId: state.activeSessionId,
    sidebarMode: state.sidebarMode,
    activeView: state.activeView,
    previousView: state.previousView,
    userMenuOpen: state.userMenuOpen,
    projectDropdownOpen: state.projectDropdownOpen,
    drawerOpen: state.drawerOpen,
    setActiveProjectSlug: setActiveProjectSlug,
    setActiveSessionId: setActiveSessionId,
    openSettings: openSettings,
    setSettingsSection: setSettingsSection,
    exitSettings: exitSettings,
    toggleUserMenu: toggleUserMenu,
    toggleProjectDropdown: toggleProjectDropdown,
    closeMenus: closeMenus,
    goToDashboard: goToDashboard,
    toggleDrawer: toggleDrawer,
    closeDrawer: closeDrawer,
  };
}
