import { Store } from "@tanstack/react-store";
import type { ThemeEntry, Theme } from "../themes/index";

export interface ThemeState {
  mode: "dark" | "light";
  darkThemeId: string;
  lightThemeId: string;
  customThemes: ThemeEntry[];
}

function loadInjectedCustomThemes(): ThemeEntry[] {
  try {
    var raw = (window as any).__LATTICE_CUSTOM_THEMES__;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map(function (ct: any): ThemeEntry {
      return {
        id: "custom:" + ct.filename,
        theme: {
          name: ct.name,
          author: ct.author,
          variant: ct.variant as "dark" | "light",
          ...ct.colors,
        } as Theme,
      };
    });
  } catch {
    return [];
  }
}

function loadInitialState(): ThemeState {
  var mode = localStorage.getItem("lattice-theme-mode");
  var darkThemeId = localStorage.getItem("lattice-theme-dark");
  var lightThemeId = localStorage.getItem("lattice-theme-light");

  return {
    mode: mode === "light" ? "light" : "dark",
    darkThemeId: darkThemeId ?? "dracula",
    lightThemeId: lightThemeId ?? "ayu-light",
    customThemes: loadInjectedCustomThemes(),
  };
}

var themeStore = new Store<ThemeState>(loadInitialState());

export function getThemeStore(): Store<ThemeState> {
  return themeStore;
}

export function toggleMode(): void {
  themeStore.setState(function (state) {
    var next: ThemeState["mode"] = state.mode === "dark" ? "light" : "dark";
    localStorage.setItem("lattice-theme-mode", next);
    return { ...state, mode: next };
  });
}

export function setThemeForMode(themeId: string): void {
  themeStore.setState(function (state) {
    if (state.mode === "dark") {
      localStorage.setItem("lattice-theme-dark", themeId);
      return { ...state, darkThemeId: themeId };
    }
    localStorage.setItem("lattice-theme-light", themeId);
    return { ...state, lightThemeId: themeId };
  });
}

export function setCustomThemes(entries: ThemeEntry[]): void {
  themeStore.setState(function (state) {
    return { ...state, customThemes: entries };
  });
}
