import { Store } from "@tanstack/react-store";
import type { ProjectSettingsSection } from "@lattice/shared";

export type { ProjectSettingsSection };

export type SettingsSection =
  | "appearance" | "claude" | "environment"
  | "mcp" | "skills" | "nodes" | "editor"
  | "rules" | "memory" | "notifications";

export type SidebarMode = "project" | "settings";

export type ActiveView =
  | { type: "dashboard" }
  | { type: "project-dashboard" }
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

var SETTINGS_SECTIONS: SettingsSection[] = ["appearance", "claude", "environment", "mcp", "skills", "nodes", "editor", "rules", "memory", "notifications"];

function parseInitialUrl(): { projectSlug: string | null; sessionId: string | null; settingsSection: SettingsSection | null; projectSettingsSection: ProjectSettingsSection | null } {
  var path = window.location.pathname;
  var parts = path.split("/").filter(function (p) { return p.length > 0; });
  if (parts[0] === "settings") {
    var section = parts[1] as SettingsSection;
    if (section && SETTINGS_SECTIONS.indexOf(section) !== -1) {
      return { projectSlug: null, sessionId: null, settingsSection: section, projectSettingsSection: null };
    }
    return { projectSlug: null, sessionId: null, settingsSection: "appearance", projectSettingsSection: null };
  }
  if (parts.length >= 2 && parts[1] === "settings") {
    return { projectSlug: parts[0], sessionId: null, settingsSection: null, projectSettingsSection: (parts[2] || "general") as ProjectSettingsSection };
  }
  if (parts.length >= 2) {
    return { projectSlug: parts[0], sessionId: parts[1], settingsSection: null, projectSettingsSection: null };
  }
  if (parts.length === 1) {
    return { projectSlug: parts[0], sessionId: null, settingsSection: null, projectSettingsSection: null };
  }
  return { projectSlug: null, sessionId: null, settingsSection: null, projectSettingsSection: null };
}

var initialUrl = parseInitialUrl();

var sidebarStore = new Store<SidebarState>({
  activeProjectSlug: initialUrl.settingsSection ? null : initialUrl.projectSlug,
  activeSessionId: initialUrl.settingsSection ? null : initialUrl.sessionId,
  sidebarMode: (initialUrl.settingsSection || initialUrl.projectSettingsSection) ? "settings" : "project",
  activeView: initialUrl.settingsSection
    ? { type: "settings", section: initialUrl.settingsSection }
    : initialUrl.projectSettingsSection
    ? { type: "project-settings", section: initialUrl.projectSettingsSection }
    : initialUrl.projectSlug
    ? (initialUrl.sessionId ? { type: "chat" } : { type: "project-dashboard" })
    : { type: "dashboard" },
  previousView: null,
  userMenuOpen: false,
  projectDropdownOpen: false,
  drawerOpen: false,
  nodeSettingsOpen: false,
  addProjectOpen: false,
  confirmRemoveSlug: null,
});

function pushUrl(projectSlug: string | null, sessionId: string | null): void {
  var path = "/";
  if (projectSlug) {
    path = "/" + projectSlug;
    if (sessionId) {
      path = path + "/" + sessionId;
    }
  }
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
}

export function getSidebarStore(): Store<SidebarState> {
  return sidebarStore;
}

export function setActiveProjectSlug(slug: string | null): void {
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
  pushUrl(slug, null);
}

export function setActiveSessionId(sessionId: string | null): void {
  var state = sidebarStore.state;
  sidebarStore.setState(function (s) {
    return {
      ...s,
      activeSessionId: sessionId,
      activeView: sessionId ? { type: "chat" } : s.activeView,
    };
  });
  pushUrl(state.activeProjectSlug, sessionId);
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
  pushUrl(projectSlug, sessionId);
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
  var path = "/settings/" + section;
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
  var path = "/settings/" + section;
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
  var state = sidebarStore.state;
  var path = "/" + state.activeProjectSlug + "/settings/" + section;
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
  var state = sidebarStore.state;
  var path = "/" + state.activeProjectSlug + "/settings/" + section;
  if (window.location.pathname !== path) {
    window.history.replaceState(null, "", path);
  }
}

export function exitSettings(): void {
  var state = sidebarStore.state;
  var restored = state.previousView ?? { type: "chat" } as ActiveView;
  sidebarStore.setState(function (s) {
    return {
      ...s,
      sidebarMode: "project",
      activeView: restored,
      previousView: null,
    };
  });
  if (state.activeView.type === "project-settings") {
    pushUrl(state.activeProjectSlug, null);
  } else {
    pushUrl(state.activeProjectSlug, state.activeSessionId);
  }
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
  var state = sidebarStore.state;
  pushUrl(state.activeProjectSlug, null);
}

export function goToDashboard(): void {
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
  pushUrl(null, null);
}

export function handlePopState(): void {
  var url = parseInitialUrl();
  if (url.settingsSection) {
    sidebarStore.setState(function (state) {
      return {
        ...state,
        sidebarMode: "settings",
        activeView: { type: "settings", section: url.settingsSection! },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
  } else if (url.projectSettingsSection) {
    sidebarStore.setState(function (state) {
      return {
        ...state,
        activeProjectSlug: url.projectSlug,
        sidebarMode: "settings",
        activeView: { type: "project-settings", section: url.projectSettingsSection! },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
  } else {
    sidebarStore.setState(function (state) {
      return {
        ...state,
        activeProjectSlug: url.projectSlug,
        activeSessionId: url.sessionId,
        sidebarMode: "project",
        activeView: url.projectSlug
          ? (url.sessionId ? { type: "chat" } : { type: "project-dashboard" })
          : { type: "dashboard" },
        userMenuOpen: false,
        projectDropdownOpen: false,
      };
    });
  }
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
