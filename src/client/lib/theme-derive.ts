export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(hex);
}

export function normalizeHex(hex: string): string {
  return hex.replace(/^#/, "").toLowerCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  var h = normalizeHex(hex);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b]
    .map(function (c) {
      var clamped = Math.max(0, Math.min(255, Math.round(c)));
      return clamped.toString(16).padStart(2, "0");
    })
    .join("");
}

function srgbToLinear(c: number): number {
  var s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  var clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308
    ? clamped * 12.92 * 255
    : (1.055 * clamped ** (1 / 2.4) - 0.055) * 255;
}

export function rgbToOklch(
  r: number,
  g: number,
  b: number,
): { L: number; C: number; h: number } {
  var lr = srgbToLinear(r);
  var lg = srgbToLinear(g);
  var lb = srgbToLinear(b);

  var l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  var m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  var s_ = 0.0883024619 * lr + 0.2220049168 * lg + 0.6696926213 * lb;

  var l_cbrt = Math.cbrt(l_);
  var m_cbrt = Math.cbrt(m_);
  var s_cbrt = Math.cbrt(s_);

  var L = 0.2104542553 * l_cbrt + 0.7936177850 * m_cbrt - 0.0040720468 * s_cbrt;
  var a = 1.9779984951 * l_cbrt - 2.4285922050 * m_cbrt + 0.4505937099 * s_cbrt;
  var b2 = 0.0259040371 * l_cbrt + 0.7827717662 * m_cbrt - 0.8086757660 * s_cbrt;

  var C = Math.sqrt(a * a + b2 * b2);
  var h = (Math.atan2(b2, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { L, C, h };
}

export function oklchToRgb(
  L: number,
  C: number,
  h: number,
): [number, number, number] {
  var hRad = (h * Math.PI) / 180;
  var a = C * Math.cos(hRad);
  var b = C * Math.sin(hRad);

  var l_cbrt = L + 0.3963377774 * a + 0.2158037573 * b;
  var m_cbrt = L - 0.1055613458 * a - 0.0638541728 * b;
  var s_cbrt = L - 0.0894841775 * a - 1.2914855480 * b;

  var l_ = l_cbrt * l_cbrt * l_cbrt;
  var m_ = m_cbrt * m_cbrt * m_cbrt;
  var s_ = s_cbrt * s_cbrt * s_cbrt;

  var r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  var g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  var bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;

  return [
    Math.round(linearToSrgb(r)),
    Math.round(linearToSrgb(g)),
    Math.round(linearToSrgb(bl)),
  ];
}

export function oklchMix(hex1: string, hex2: string, t: number): string {
  var [r1, g1, b1] = hexToRgb(hex1);
  var [r2, g2, b2] = hexToRgb(hex2);

  var c1 = rgbToOklch(r1, g1, b1);
  var c2 = rgbToOklch(r2, g2, b2);

  var L = c1.L + (c2.L - c1.L) * t;
  var C = c1.C + (c2.C - c1.C) * t;

  var h1 = c1.C < 0.001 ? c2.h : c1.h;
  var h2 = c2.C < 0.001 ? c1.h : c2.h;

  var diff = h2 - h1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  var h = h1 + diff * t;
  if (h < 0) h += 360;
  if (h >= 360) h -= 360;

  var [r, g, b] = oklchToRgb(L, C, h);
  return rgbToHex(r, g, b);
}

export function oklchLighten(hex: string, amount: number): string {
  var [r, g, b] = hexToRgb(hex);
  var oklch = rgbToOklch(r, g, b);

  var L = Math.max(0, Math.min(1, oklch.L + amount));

  var [nr, ng, nb] = oklchToRgb(L, oklch.C, oklch.h);
  return rgbToHex(nr, ng, nb);
}

export function oklchRotateHue(hex: string, degrees: number): string {
  var [r, g, b] = hexToRgb(hex);
  var oklch = rgbToOklch(r, g, b);

  var h = (oklch.h + degrees) % 360;
  if (h < 0) h += 360;

  var [nr, ng, nb] = oklchToRgb(oklch.L, oklch.C, h);
  return rgbToHex(nr, ng, nb);
}

function clampSyntaxLightness(
  hex: string,
  variant: "dark" | "light",
): string {
  var [r, g, b] = hexToRgb(hex);
  var oklch = rgbToOklch(r, g, b);

  var L = oklch.L;
  if (variant === "dark") {
    if (L < 0.65) L = 0.65;
    if (L > 0.85) L = 0.85;
  } else {
    if (L < 0.35) L = 0.35;
    if (L > 0.55) L = 0.55;
  }

  var [nr, ng, nb] = oklchToRgb(L, oklch.C, oklch.h);
  return rgbToHex(nr, ng, nb);
}

export function deriveFullPalette(
  bg: string,
  surface: string,
  fg: string,
  accent: string,
  variant: "dark" | "light",
): Record<string, string> {
  var nbg = normalizeHex(bg);
  var nsurface = normalizeHex(surface);
  var nfg = normalizeHex(fg);
  var naccent = normalizeHex(accent);

  return {
    base00: nbg,
    base01: oklchMix(nbg, nsurface, 0.5),
    base02: nsurface,
    base03: oklchMix(nsurface, nfg, 0.25),
    base04: oklchMix(nsurface, nfg, 0.45),
    base05: nfg,
    base06:
      variant === "dark"
        ? oklchLighten(nfg, 0.05)
        : oklchLighten(nfg, -0.05),
    base07:
      variant === "dark"
        ? oklchLighten(nfg, 0.15)
        : oklchLighten(nfg, -0.15),
    base08: clampSyntaxLightness(oklchRotateHue(naccent, 0), variant),
    base09: clampSyntaxLightness(oklchRotateHue(naccent, 30), variant),
    base0A: clampSyntaxLightness(oklchRotateHue(naccent, 60), variant),
    base0B: clampSyntaxLightness(oklchRotateHue(naccent, 120), variant),
    base0C: clampSyntaxLightness(oklchRotateHue(naccent, 180), variant),
    base0D: clampSyntaxLightness(naccent, variant),
    base0E: clampSyntaxLightness(oklchRotateHue(naccent, 270), variant),
    base0F: clampSyntaxLightness(oklchRotateHue(naccent, 330), variant),
  };
}
