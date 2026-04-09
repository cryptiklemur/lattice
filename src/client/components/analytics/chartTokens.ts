/**
 * Theme-aware chart color tokens.
 *
 * Reads CSS custom properties set by useTheme so every chart
 * automatically adapts when the user switches Base16 themes.
 *
 * Usage:
 *   import { getChartColors } from "../chartTokens";
 *   // inside component render:
 *   var colors = getChartColors();
 */

function css(prop: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
}

function oklch(raw: string): string {
  return raw ? "oklch(" + raw + ")" : "";
}

export interface ChartColors {
  /** Primary brand color (base0D — blue) */
  primary: string;
  /** Secondary color (base0E — purple) */
  secondary: string;
  /** Accent / info color (base0C — cyan) */
  accent: string;
  /** Success / green (base0B) */
  success: string;
  /** Warning / yellow (base0A) */
  warning: string;
  /** Error / red (base08) */
  error: string;
  /** Orange (base09) */
  orange: string;
  /** Magenta (base0F) */
  magenta: string;

  /** Tick label fill — content color at 30% opacity */
  tickFill: string;
  /** Grid stroke — content color at 6% opacity */
  gridStroke: string;

  /** Model palette keyed by model family */
  model: {
    opus: string;
    sonnet: string;
    haiku: string;
    other: string;
  };

  /** Ordered palette for multi-series charts (8 colors) */
  palette: string[];

  /** Category colors for tool classification */
  category: Record<string, string>;

  /** Permission colors */
  permission: {
    allowed: string;
    denied: string;
    alwaysAllowed: string;
  };
}

let _cache: ChartColors | null = null;
let _cacheKey: string = "";

/**
 * Returns chart colors derived from the current CSS theme.
 * Results are cached per theme so repeated calls within
 * the same render cycle are cheap.
 */
export function getChartColors(): ChartColors {
  const key = css("--color-primary") + css("--color-base-content") + css("--base0D");
  if (_cache && _cacheKey === key) return _cache;

  const b08 = css("--base08");
  const b09 = css("--base09");
  const b0A = css("--base0A");
  const b0B = css("--base0B");
  const b0C = css("--base0C");
  const b0D = css("--base0D");
  const b0E = css("--base0E");
  const b0F = css("--base0F");

  const primary = b0D || oklch(css("--color-primary"));
  const secondary = b0E || oklch(css("--color-secondary"));
  const accent = b0C || oklch(css("--color-accent"));
  const success = b0B || oklch(css("--color-success"));
  const warning = b0A || oklch(css("--color-warning"));
  const error = b08 || oklch(css("--color-error"));
  const orange = b09 || warning;
  const magenta = b0F || secondary;
  const b03 = css("--base03");
  const b04 = css("--base04");
  const b02 = css("--base02");

  const tickFill = b04 || b03 || "oklch(0.7 0.03 260)";
  const gridStroke = b02 || "oklch(0.35 0.02 260)";

  _cache = {
    primary,
    secondary,
    accent,
    success,
    warning,
    error,
    orange,
    magenta,

    tickFill,
    gridStroke,

    model: {
      opus: secondary,
      sonnet: primary,
      haiku: success,
      other: warning,
    },

    palette: [primary, secondary, success, warning, accent, orange, error, magenta],

    category: {
      Read: success,
      Write: warning,
      Execute: error,
      AI: secondary,
      Other: primary,
    },

    permission: {
      allowed: success,
      denied: error,
      alwaysAllowed: primary,
    },
  };
  _cacheKey = key;
  return _cache;
}

/** Tick style object ready to spread onto Recharts axis components. */
export function getTickStyle() {
  const c = getChartColors();
  return {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fill: c.tickFill,
  };
}

/**
 * Returns a color for a model name by matching against known families.
 */
export function getModelColor(model: string): string {
  const c = getChartColors();
  const key = model.toLowerCase();
  if (key.includes("opus")) return c.model.opus;
  if (key.includes("sonnet")) return c.model.sonnet;
  if (key.includes("haiku")) return c.model.haiku;
  return c.model.other;
}

/**
 * Generate a dynamic OKLCH color based on the theme's primary hue.
 * Useful for heatmaps and treemaps that derive intensity from data.
 */
export function getIntensityColor(intensity: number, hueOverride?: number): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
  let hue = hueOverride ?? 280;
  if (raw) {
    const parts = raw.split(/\s+/);
    if (parts.length >= 3) {
      hue = parseFloat(parts[2]) || hue;
    }
  }
  const lightness = 0.45 - intensity * 0.15;
  const chroma = 0.15 + intensity * 0.12;
  return "oklch(" + lightness + " " + chroma + " " + hue + ")";
}

/**
 * Generate a score-based color using theme hue.
 */
export function getScoreColor(score: number, maxScore: number): string {
  const intensity = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  return getIntensityColor(intensity);
}
