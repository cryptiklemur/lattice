import { Store } from "@tanstack/react-store";
import type { ProjectSettingsSection } from "#shared";
import { encodeWorkspaceUrl, decodeWorkspaceUrl, isLegacySessionUrl, shortSessionId } from "../lib/workspace-url";
import type { DecodedWorkspace } from "../lib/workspace-url";
import { getWorkspaceStore, restoreWorkspace, setUrlSyncCallback, switchProjectWorkspace, setCurrentProjectKey } from "./workspace";
import { setAnalyticsScope } from "./analytics";

export type { ProjectSettingsSection };

export type SettingsSection =
  | "appearance" | "claude" | "environment"
  | "mcp" | "skills" | "plugins" | "nodes" | "editor"
  | "rules" | "memory" | "notifications" | "budget";

export type SidebarMode = "project" | "settings";

export type ActiveView =
  | { type: "dashboard" }
  | { type: "project-dashboard" }
  | { type: "analytics" }
  | { type: "context" }
  | { type: "chat" }
  | { type: "settings"; section: SettingsSection }
  | { type: "project-settings"; section: ProjectSettingsSection };

export interface SidebarState {
  activeProjectSlug: string | null;
  activeSessionId: string | null;
  sidebarMode: SidebarMode;
  activeView: ActiveView;
  previousView: ActiveView | null;
  userMenuOpen: boolean;
  projectDropdownOpen: boolean;
  drawerOpen: boolean;
  nodeSettingsOpen: boolean;
  addProjectOpen: boolean;
  confirmRemoveSlug: string | null;
}

const SETTINGS_SECTIONS: SettingsSection[] = ["appearance", "claude", "environment", "mcp", "skills", "plugins", "nodes", "editor", "rules", "memory", "notifications", "budget"];

interface ParsedUrl {
  projectSlug: string | null;
  sessionId: string | null;
  settingsSection: SettingsSection | null;
  projectSettingsSection: ProjectSettingsSection | null;
  tParam: string | null;
  decodedWorkspace: DecodedWorkspace | null;
}

function resolveFullIdFromNothing(_shortId: string, _projectSlug: string): string | null {
  return null;
}

function parseInitialUrl(): ParsedUrl {
  const path = window.location.pathname;
  const parts = path.split("/").filter(function (p) { return p.length > 0; });
  const searchParams = new URLSearchParams(window.location.search);
  const tParam = searchParams.get("t");

  if (parts[0] === "settings") {
    const section = parts[1] as SettingsSection;
    if (section && SETTINGS_SECTIONS.indexOf(section) !== -1) {
      return { projectSlug: null, sessionId: null, settingsSection: section, projectSettingsSection: null, tParam: null, decodedWorkspace: null };
    }
    return { projectSlug: null, sessionId: null, settingsSection: "appearance", projectSettingsSection: null, tParam: null, decodedWorkspace: null };
  }

  if (parts.length >= 2 && parts[1] === "settings") {
    return { projectSlug: parts[0], sessionId: null, settingsSection: null, projectSettingsSection: (parts[2] || "general") as ProjectSettingsSection, tParam: null, decodedWorkspace: null };
  }

  const legacy = isLegacySessionUrl(path);
  if (legacy && !tParam) {
    const shortId = shortSessionId(legacy.sessionId);
    const newUrl = "/" + legacy.projectSlug + "?t=chat:" + shortId + "*";
    window.history.replaceState(null, "", newUrl);
    const decoded = decodeWorkspaceUrl("chat:" + shortId + "*", legacy.projectSlug, resolveFullIdFromNothing);
    return {
      projectSlug: legacy.projectSlug,
      sessionId: legacy.sessionId,
      settingsSection: null,
      projectSettingsSection: null,
      tParam: "chat:" + shortId + "*",
      decodedWorkspace: decoded,
    };
  }

  if (parts.length >= 1 && parts[0] !== "settings") {
    const projectSlug = parts[0];
    if (tParam != null) {
      const decoded = decodeWorkspaceUrl(tParam, projectSlug, resolveFullIdFromNothing);
      let sessionId: string | null = null;
      const activePane = decoded.panes.find(function (p) { return p.id === decoded.activePaneId; });
      if (activePane) {
        const activeTab = decoded.tabs.find(function (t) { return t.id === activePane.activeTabId; });
        if (activeTab && activeTab.type === "chat" && activeTab.sessionId) {
          sessionId = activeTab.sessionId;
        }
      }
      return { projectSlug, sessionId, settingsSection: null, projectSettingsSection: null, tParam, decodedWorkspace: decoded };
    }
    return { projectSlug, sessionId: null, settingsSection: null, projectSettingsSection: null, tParam: null, decodedWorkspace: null };
  }

  return { projectSlug: null, sessionId: null, settingsSection: null, projectSettingsSection: null, tParam: null, decodedWorkspace: null };
}

const initialUrl = parseInitialUrl();

setCurrentProjectKey(initialUrl.settingsSection ? null : initialUrl.projectSlug);
if (initialUrl.decodedWorkspace) {
  restoreWorkspace(initialUrl.decodedWorkspace);
}

const sidebarStore = new Store<SidebarState>({
  activeProjectSlug: initialUrl.settingsSection ? null : initialUrl.projectSlug,
  activeSessionId: initialUrl.settingsSection ? null : initialUrl.sessionId,
  sidebarMode: (initialUrl.settingsSection || initialUrl.projectSettingsSection) ? "settings" : "project",
  activeView: initialUrl.settingsSection
    ? { type: "settings", section: initialUrl.settingsSection }
    : initialUrl.projectSettingsSection
    ? { type: "project-settings", section: initialUrl.projectSettingsSection }
    : initialUrl.projectSlug
    ? (initialUrl.sessionId || initialUrl.tParam != null ? { type: "chat" } : { type: "project-dashboard" })
    : { type: "dashboard" },
  previousView: null,
  userMenuOpen: false,
  projectDropdownOpen: false,
  drawerOpen: false,
  nodeSettingsOpen: false,
  addProjectOpen: false,
  confirmRemoveSlug: null,
});

let lastEncodedUrl = "";

function pushUrl(projectSlug: string | null, replace: boolean = false): void {
  const wsState = getWorkspaceStore().state;
  const encoded = encodeWorkspaceUrl(wsState, wsState.tabs, projectSlug);
  let path = "/";
  if (projectSlug) {
    path = "/" + projectSlug + "?t=" + encoded;
  }
  const hash = window.location.hash;
  const fullUrl = path + hash;
  if (window.location.pathname + window.location.search !== path) {
    if (replace) {
      window.history.replaceState(null, "", fullUrl);
    } else {
      window.history.pushState(null, "", fullUrl);
    }
  }
  lastEncodedUrl = encoded;
}

export function syncUrlFromWorkspace(): void {
  const state = sidebarStore.state;
  if (state.sidebarMode === "settings") return;
  if (!state.activeProjectSlug) return;

  const wsState = getWorkspaceStore().state;
  const encoded = encodeWorkspaceUrl(wsState, wsState.tabs, state.activeProjectSlug);

  if (encoded === lastEncodedUrl) return;

  const isActiveTabChangeOnly = detectActiveTabChangeOnly(lastEncodedUrl, encoded);
  lastEncodedUrl = encoded;

  let path = "/" + state.activeProjectSlug + "?t=" + encoded;
  const hash = window.location.hash;
  const fullUrl = path + hash;

  if (window.location.pathname + window.location.search !== path) {
    if (isActiveTabChangeOnly) {
      window.history.replaceState(null, "", fullUrl);
    } else {
      window.history.pushState(null, "", fullUrl);
    }
  }
}

function detectActiveTabChangeOnly(oldEncoded: string, newEncoded: string): boolean {
  const oldStripped = oldEncoded.replace(/\*/g, "");
  const newStripped = newEncoded.replace(/\*/g, "");
  return oldStripped === newStripped;
}

setUrlSyncCallback(syncUrlFromWorkspace);

export function getSidebarStore(): Store<SidebarState> {
  return sidebarStore;
}

export function setActiveProjectSlug(slug: string | null): void {
  let prevSlug = sidebarStore.state.activeProjectSlug;
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeProjectSlug: slug,
      activeSessionId: null,
      sidebarMode: "project",
      activeView: slug ? { type: "project-dashboard" } : { type: "dashboard" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  let path = "/";
  if (slug) {
    path = "/" + slug;
  }
  if (window.location.pathname + window.location.search !== path) {
    window.history.pushState(null, "", path);
  }
  lastEncodedUrl = "";
  // Switch workspace AFTER sidebar state is set so React sees both in same render
  switchProjectWorkspace(prevSlug, slug);
}

export function setActiveSessionId(sessionId: string | null): void {
  sidebarStore.setState(function (s) {
    return {
      ...s,
      activeSessionId: sessionId,
      activeView: sessionId ? { type: "chat" } : s.activeView,
    };
  });
}

export function navigateToSession(projectSlug: string, sessionId: string): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeProjectSlug: projectSlug,
      activeSessionId: sessionId,
      sidebarMode: "project",
      activeView: { type: "chat" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
}

export function openSettings(section: SettingsSection): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      sidebarMode: "settings",
      previousView: state.activeView.type !== "settings" ? state.activeView : state.previousView,
      activeView: { type: "settings", section: section },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  const path = "/settings/" + section;
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
}

export function setSettingsSection(section: SettingsSection): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeView: { type: "settings", section: section },
    };
  });
  const path = "/settings/" + section;
  if (window.location.pathname !== path) {
    window.history.replaceState(null, "", path);
  }
}

export function openProjectSettings(section: ProjectSettingsSection): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      sidebarMode: "settings",
      previousView: state.activeView.type !== "settings" && state.activeView.type !== "project-settings" ? state.activeView : state.previousView,
      activeView: { type: "project-settings", section: section },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  const state = sidebarStore.state;
  const path = "/" + state.activeProjectSlug + "/settings/" + section;
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
}

export function setProjectSettingsSection(section: ProjectSettingsSection): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeView: { type: "project-settings", section: section },
    };
  });
  const state = sidebarStore.state;
  const path = "/" + state.activeProjectSlug + "/settings/" + section;
  if (window.location.pathname !== path) {
    window.history.replaceState(null, "", path);
  }
}

export function exitSettings(): void {
  const state = sidebarStore.state;
  const restored = state.previousView ?? { type: "chat" } as ActiveView;
  sidebarStore.setState(function (s) {
    return {
      ...s,
      sidebarMode: "project",
      activeView: restored,
      previousView: null,
    };
  });
  pushUrl(state.activeProjectSlug);
}

export function goToProjectDashboard(): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeSessionId: null,
      sidebarMode: "project",
      activeView: { type: "project-dashboard" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  const state = sidebarStore.state;
  let path = "/";
  if (state.activeProjectSlug) {
    path = "/" + state.activeProjectSlug;
  }
  if (window.location.pathname + window.location.search !== path) {
    window.history.pushState(null, "", path);
  }
  lastEncodedUrl = "";
}

export function goToDashboard(): void {
  let prevSlug = sidebarStore.state.activeProjectSlug;
  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeProjectSlug: null,
      activeSessionId: null,
      sidebarMode: "project",
      activeView: { type: "dashboard" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  if (window.location.pathname + window.location.search !== "/") {
    window.history.pushState(null, "", "/");
  }
  switchProjectWorkspace(prevSlug, null);
  lastEncodedUrl = "";
}

export function goToAnalytics(): void {
  setAnalyticsScope("global");
  sidebarStore.setState(function (state) {
    return { ...state, activeView: { type: "analytics" } };
  });
  pushUrl(sidebarStore.state.activeProjectSlug);
}

export function handlePopState(): void {
  const path = window.location.pathname;
  const parts = path.split("/").filter(function (p) { return p.length > 0; });
  const searchParams = new URLSearchParams(window.location.search);
  const tParam = searchParams.get("t");

  if (parts[0] === "settings") {
    const section = (parts[1] || "appearance") as SettingsSection;
    sidebarStore.setState(function (state) {
      return {
        ...state,
        sidebarMode: "settings",
        activeView: { type: "settings", section: section },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
    return;
  }

  if (parts.length >= 2 && parts[1] === "settings") {
    const projectSettingsSection = (parts[2] || "general") as ProjectSettingsSection;
    sidebarStore.setState(function (state) {
      return {
        ...state,
        activeProjectSlug: parts[0],
        sidebarMode: "settings",
        activeView: { type: "project-settings", section: projectSettingsSection },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
    return;
  }

  const projectSlug = parts.length > 0 ? parts[0] : null;

  if (tParam != null && projectSlug) {
    const decoded = decodeWorkspaceUrl(tParam, projectSlug, resolveFullIdFromNothing);
    restoreWorkspace(decoded);
    lastEncodedUrl = tParam;

    let sessionId: string | null = null;
    const activePane = decoded.panes.find(function (p) { return p.id === decoded.activePaneId; });
    if (activePane) {
      const activeTab = decoded.tabs.find(function (t) { return t.id === activePane.activeTabId; });
      if (activeTab && activeTab.type === "chat" && activeTab.sessionId) {
        sessionId = activeTab.sessionId;
      }
    }

    sidebarStore.setState(function (state) {
      return {
        ...state,
        activeProjectSlug: projectSlug,
        activeSessionId: sessionId,
        sidebarMode: "project",
        activeView: { type: "chat" },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
    return;
  }

  sidebarStore.setState(function (state) {
    return {
      ...state,
      activeProjectSlug: projectSlug,
      activeSessionId: null,
      sidebarMode: "project",
      activeView: projectSlug ? { type: "project-dashboard" } : { type: "dashboard" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  lastEncodedUrl = "";
}

export function toggleUserMenu(): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      userMenuOpen: !state.userMenuOpen,
      projectDropdownOpen: false,
    };
  });
}

export function toggleProjectDropdown(): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      projectDropdownOpen: !state.projectDropdownOpen,
      userMenuOpen: false,
    };
  });
}

export function closeMenus(): void {
  sidebarStore.setState(function (state) {
    return {
      ...state,
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
}

export function toggleDrawer(): void {
  sidebarStore.setState(function (state) {
    return { ...state, drawerOpen: !state.drawerOpen };
  });
}

export function closeDrawer(): void {
  sidebarStore.setState(function (state) {
    return { ...state, drawerOpen: false };
  });
}

export function openNodeSettings(): void {
  sidebarStore.setState(function (state) {
    return { ...state, nodeSettingsOpen: true, userMenuOpen: false };
  });
}

export function closeNodeSettings(): void {
  sidebarStore.setState(function (state) {
    return { ...state, nodeSettingsOpen: false };
  });
}

export function openAddProject(): void {
  sidebarStore.setState(function (state) {
    return { ...state, addProjectOpen: true };
  });
}

export function closeAddProject(): void {
  sidebarStore.setState(function (state) {
    return { ...state, addProjectOpen: false };
  });
}

export function openConfirmRemove(slug: string): void {
  sidebarStore.setState(function (state) {
    return { ...state, confirmRemoveSlug: slug };
  });
}

export function closeConfirmRemove(): void {
  sidebarStore.setState(function (state) {
    return { ...state, confirmRemoveSlug: null };
  });
}
