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

var _cache: ChartColors | null = null;
var _cacheKey: string = "";

/**
 * Returns chart colors derived from the current CSS theme.
 * Results are cached per theme so repeated calls within
 * the same render cycle are cheap.
 */
export function getChartColors(): ChartColors {
  var key = css("--color-primary") + css("--color-base-content") + css("--base0D");
  if (_cache && _cacheKey === key) return _cache;

  var b08 = css("--base08");
  var b09 = css("--base09");
  var b0A = css("--base0A");
  var b0B = css("--base0B");
  var b0C = css("--base0C");
  var b0D = css("--base0D");
  var b0E = css("--base0E");
  var b0F = css("--base0F");

  var primary = b0D || oklch(css("--color-primary"));
  var secondary = b0E || oklch(css("--color-secondary"));
  var accent = b0C || oklch(css("--color-accent"));
  var success = b0B || oklch(css("--color-success"));
  var warning = b0A || oklch(css("--color-warning"));
  var error = b08 || oklch(css("--color-error"));
  var orange = b09 || warning;
  var magenta = b0F || secondary;
  var contentRaw = css("--color-base-content");

  var tickFill = contentRaw
    ? "oklch(" + contentRaw + " / 0.3)"
    : "oklch(0.9 0.02 280 / 0.3)";

  var gridStroke = contentRaw
    ? "oklch(" + contentRaw + " / 0.06)"
    : "oklch(0.9 0.02 280 / 0.06)";

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
  var c = getChartColors();
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
  var c = getChartColors();
  var key = model.toLowerCase();
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
  var raw = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
  var hue = hueOverride ?? 280;
  if (raw) {
    var parts = raw.split(/\s+/);
    if (parts.length >= 3) {
      hue = parseFloat(parts[2]) || hue;
    }
  }
  var lightness = 0.45 - intensity * 0.15;
  var chroma = 0.15 + intensity * 0.12;
  return "oklch(" + lightness + " " + chroma + " " + hue + ")";
}

/**
 * Generate a score-based color using theme hue.
 */
export function getScoreColor(score: number, maxScore: number): string {
  var intensity = maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
  return getIntensityColor(intensity);
}
