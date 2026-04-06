import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import { getThemeStore, toggleMode, setThemeForMode } from "../stores/theme";
import { themes, type ThemeEntry } from "../themes/index";

function hexToOklch(hex: string): string {
  var r = parseInt(hex.slice(0, 2), 16) / 255;
  var g = parseInt(hex.slice(2, 4), 16) / 255;
  var b = parseInt(hex.slice(4, 6), 16) / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  var x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  var y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  var z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;

  var l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  var m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  var s_ = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  var l3 = Math.cbrt(l_);
  var m3 = Math.cbrt(m_);
  var s3 = Math.cbrt(s_);

  var L = 0.2104542553 * l3 + 0.7936177850 * m3 - 0.0040720468 * s3;
  var a = 1.9779984951 * l3 - 2.4285922050 * m3 + 0.4505937099 * s3;
  var bOk = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.8086757660 * s3;

  var C = Math.sqrt(a * a + bOk * bOk);
  var h = Math.atan2(bOk, a) * 180 / Math.PI;
  if (h < 0) h += 360;

  return (L * 100).toFixed(1) + "% " + C.toFixed(3) + " " + h.toFixed(0);
}

function contrastContent(hex: string): string {
  var r = parseInt(hex.slice(0, 2), 16);
  var g = parseInt(hex.slice(2, 4), 16);
  var b = parseInt(hex.slice(4, 6), 16);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? "15% 0.01 0" : "98% 0.01 0";
}

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

  root.style.setProperty("--color-base-100", "oklch(" + hexToOklch(t.base00) + ")");
  root.style.setProperty("--color-base-200", "oklch(" + hexToOklch(t.base01) + ")");
  root.style.setProperty("--color-base-300", "oklch(" + hexToOklch(t.base02) + ")");
  root.style.setProperty("--color-base-content", "oklch(" + hexToOklch(t.base05) + ")");
  root.style.setProperty("--color-primary", "oklch(" + hexToOklch(t.base0D) + ")");
  root.style.setProperty("--color-primary-content", "oklch(" + contrastContent(t.base0D) + ")");
  root.style.setProperty("--color-secondary", "oklch(" + hexToOklch(t.base0E) + ")");
  root.style.setProperty("--color-secondary-content", "oklch(" + contrastContent(t.base0E) + ")");
  root.style.setProperty("--color-accent", "oklch(" + hexToOklch(t.base0C) + ")");
  root.style.setProperty("--color-accent-content", "oklch(" + contrastContent(t.base0C) + ")");
  root.style.setProperty("--color-neutral", "oklch(" + hexToOklch(t.base02) + ")");
  root.style.setProperty("--color-neutral-content", "oklch(" + hexToOklch(t.base04) + ")");
  root.style.setProperty("--color-info", "oklch(" + hexToOklch(t.base0C) + ")");
  root.style.setProperty("--color-info-content", "oklch(" + contrastContent(t.base0C) + ")");
  root.style.setProperty("--color-success", "oklch(" + hexToOklch(t.base0B) + ")");
  root.style.setProperty("--color-success-content", "oklch(" + contrastContent(t.base0B) + ")");
  root.style.setProperty("--color-warning", "oklch(" + hexToOklch(t.base0A) + ")");
  root.style.setProperty("--color-warning-content", "oklch(" + contrastContent(t.base0A) + ")");
  root.style.setProperty("--color-error", "oklch(" + hexToOklch(t.base08) + ")");
  root.style.setProperty("--color-error-content", "oklch(" + contrastContent(t.base08) + ")");

  root.dataset.theme = entry.theme.variant === "dark" ? "lattice-dark" : "lattice-light";
  root.style.colorScheme = entry.theme.variant === "dark" ? "dark" : "light";
}

export function useTheme() {
  var store = getThemeStore();
  var state = useStore(store, function (s) { return s; });

  var allThemes = state.customThemes.length > 0
    ? themes.concat(state.customThemes)
    : themes;

  var currentThemeId = state.mode === "dark" ? state.darkThemeId : state.lightThemeId;
  var currentEntry = allThemes.find(function (e) { return e.id === currentThemeId; }) ?? themes[0];

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
    allThemes,
  };
}
