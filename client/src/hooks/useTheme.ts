import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import { getThemeStore, toggleMode, setThemeForMode } from "../stores/theme";
import { themes, type ThemeEntry } from "../themes/index";

function applyTheme(entry: ThemeEntry): void {
  var root = document.documentElement;
  var t = entry.theme;
  root.style.setProperty("--base00", "#" + t.base00);
  root.style.setProperty("--base01", "#" + t.base01);
  root.style.setProperty("--base02", "#" + t.base02);
  root.style.setProperty("--base03", "#" + t.base03);
  root.style.setProperty("--base04", "#" + t.base04);
  root.style.setProperty("--base05", "#" + t.base05);
  root.style.setProperty("--base06", "#" + t.base06);
  root.style.setProperty("--base07", "#" + t.base07);
  root.style.setProperty("--base08", "#" + t.base08);
  root.style.setProperty("--base09", "#" + t.base09);
  root.style.setProperty("--base0A", "#" + t.base0A);
  root.style.setProperty("--base0B", "#" + t.base0B);
  root.style.setProperty("--base0C", "#" + t.base0C);
  root.style.setProperty("--base0D", "#" + t.base0D);
  root.style.setProperty("--base0E", "#" + t.base0E);
  root.style.setProperty("--base0F", "#" + t.base0F);
}

export function useTheme() {
  var store = getThemeStore();
  var state = useStore(store, function (s) { return s; });

  var currentThemeId = state.mode === "dark" ? state.darkThemeId : state.lightThemeId;
  var currentEntry = themes.find(function (e) { return e.id === currentThemeId; }) ?? themes[0];

  useEffect(function () {
    applyTheme(currentEntry);
  }, [currentEntry]);

  function setTheme(themeId: string): void {
    setThemeForMode(themeId);
  }

  return {
    mode: state.mode,
    currentThemeId,
    toggleMode,
    setTheme,
    themes,
  };
}
