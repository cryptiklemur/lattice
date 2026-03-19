import { Store } from "@tanstack/react-store";

export type SettingsSection =
  | "status" | "appearance" | "claude" | "environment"
  | "mcp" | "skills" | "nodes";

export type SidebarMode = "project" | "settings";

export type ActiveView =
  | { type: "dashboard" }
  | { type: "chat" }
  | { type: "settings"; section: SettingsSection };

export interface SidebarState {
  activeProjectSlug: string | null;
  activeSessionId: string | null;
  sidebarMode: SidebarMode;
  activeView: ActiveView;
  previousView: ActiveView | null;
  userMenuOpen: boolean;
  projectDropdownOpen: boolean;
  drawerOpen: boolean;
}

var SETTINGS_SECTIONS: SettingsSection[] = ["status", "appearance", "claude", "environment", "mcp", "skills", "nodes"];

function parseInitialUrl(): { projectSlug: string | null; sessionId: string | null; settingsSection: SettingsSection | null } {
  var path = window.location.pathname;
  var parts = path.split("/").filter(function (p) { return p.length > 0; });
  if (parts[0] === "settings") {
    var section = parts[1] as SettingsSection;
    if (section && SETTINGS_SECTIONS.indexOf(section) !== -1) {
      return { projectSlug: null, sessionId: null, settingsSection: section };
    }
    return { projectSlug: null, sessionId: null, settingsSection: "status" };
  }
  if (parts.length >= 2) {
    return { projectSlug: parts[0], sessionId: parts[1], settingsSection: null };
  }
  if (parts.length === 1) {
    return { projectSlug: parts[0], sessionId: null, settingsSection: null };
  }
  return { projectSlug: null, sessionId: null, settingsSection: null };
}

var initialUrl = parseInitialUrl();

var sidebarStore = new Store<SidebarState>({
  activeProjectSlug: initialUrl.settingsSection ? null : initialUrl.projectSlug,
  activeSessionId: initialUrl.settingsSection ? null : initialUrl.sessionId,
  sidebarMode: initialUrl.settingsSection ? "settings" : "project",
  activeView: initialUrl.settingsSection
    ? { type: "settings", section: initialUrl.settingsSection }
    : initialUrl.projectSlug
    ? { type: "chat" }
    : { type: "dashboard" },
  previousView: null,
  userMenuOpen: false,
  projectDropdownOpen: false,
  drawerOpen: false,
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
      activeView: slug ? { type: "chat" } : { type: "dashboard" },
      userMenuOpen: false,
      projectDropdownOpen: false,
    };
  });
  pushUrl(slug, null);
}

export function setActiveSessionId(sessionId: string | null): void {
  var state = sidebarStore.state;
  sidebarStore.setState(function (s) {
    return { ...s, activeSessionId: sessionId };
  });
  pushUrl(state.activeProjectSlug, sessionId);
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
  pushUrl(state.activeProjectSlug, state.activeSessionId);
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
  } else {
    sidebarStore.setState(function (state) {
      return {
        ...state,
        activeProjectSlug: url.projectSlug,
        activeSessionId: url.sessionId,
        sidebarMode: "project",
        activeView: url.projectSlug ? { type: "chat" } : { type: "dashboard" },
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
