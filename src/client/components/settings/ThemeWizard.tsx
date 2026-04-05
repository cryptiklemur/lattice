import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, Save, Palette, Sun, Moon, Check } from "lucide-react";
import { ThemePreview, ThemeSwatches } from "./ThemePreview";
import { deriveFullPalette, normalizeHex, isValidHex } from "../../lib/theme-derive";
import { useWebSocket } from "../../hooks/useWebSocket";
import { themes as allThemes } from "../../themes";
import type { ThemeEntry } from "../../themes";

interface ThemeWizardProps {
  onClose: () => void;
  editTheme?: { name: string; author: string; variant: "dark" | "light"; colors: Record<string, string> } | null;
}

var BASE16_KEYS = ["base00", "base01", "base02", "base03", "base04", "base05", "base06", "base07", "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"];

var COLOR_LABELS: Record<string, string> = {
  base00: "Background",
  base01: "Lighter Background",
  base02: "Selection",
  base03: "Comments",
  base04: "Dark Foreground",
  base05: "Foreground",
  base06: "Light Foreground",
  base07: "Brightest",
  base08: "Red / Variables",
  base09: "Orange / Numbers",
  base0A: "Yellow / Classes",
  base0B: "Green / Strings",
  base0C: "Cyan / Support",
  base0D: "Blue / Functions",
  base0E: "Purple / Keywords",
  base0F: "Brown / Deprecated",
};

function emptyColors(): Record<string, string> {
  var c: Record<string, string> = {};
  for (var i = 0; i < BASE16_KEYS.length; i++) {
    c[BASE16_KEYS[i]] = "000000";
  }
  return c;
}

function defaultDarkColors(): Record<string, string> {
  return {
    base00: "1a1a2e", base01: "222240", base02: "2a2a4a", base03: "505070",
    base04: "7a7a9a", base05: "c0c0d0", base06: "d0d0e0", base07: "ffffff",
    base08: "ff6b6b", base09: "ffa06b", base0A: "ffd06b", base0B: "6bffa0",
    base0C: "6bd0ff", base0D: "6b9fff", base0E: "c06bff", base0F: "ff6bb0",
  };
}

function defaultLightColors(): Record<string, string> {
  return {
    base00: "f5f5f0", base01: "e8e8e0", base02: "d5d5cd", base03: "999990",
    base04: "666660", base05: "333330", base06: "222220", base07: "000000",
    base08: "c24040", base09: "b06030", base0A: "907020", base0B: "408040",
    base0C: "207080", base0D: "3060b0", base0E: "703090", base0F: "a04060",
  };
}

export function ThemeWizard(props: ThemeWizardProps) {
  var ws = useWebSocket();
  var [step, setStep] = useState(1);
  var [name, setName] = useState(props.editTheme?.name || "");
  var [author, setAuthor] = useState(props.editTheme?.author || "");
  var [variant, setVariant] = useState<"dark" | "light">(props.editTheme?.variant || "dark");
  var [baseTheme, setBaseTheme] = useState<string | null>(null);
  var [colors, setColors] = useState<Record<string, string>>(
    props.editTheme?.colors || defaultDarkColors()
  );
  var [coreBg, setCoreBg] = useState(colors.base00);
  var [coreSurface, setCoreSurface] = useState(colors.base02);
  var [coreFg, setCoreFg] = useState(colors.base05);
  var [coreAccent, setCoreAccent] = useState(colors.base0D);
  var [showAdvanced, setShowAdvanced] = useState(false);

  function handleBaseSelect(themeName: string) {
    setBaseTheme(themeName);
    var found = allThemes.find(function (t: ThemeEntry) { return t.theme.name === themeName; });
    if (found) {
      var theme = found.theme as unknown as Record<string, string>;
      var newColors: Record<string, string> = {};
      for (var i = 0; i < BASE16_KEYS.length; i++) {
        newColors[BASE16_KEYS[i]] = normalizeHex(theme[BASE16_KEYS[i]] || "000000");
      }
      setColors(newColors);
      setVariant(found.theme.variant as "dark" | "light");
      setCoreBg(newColors.base00);
      setCoreSurface(newColors.base02);
      setCoreFg(newColors.base05);
      setCoreAccent(newColors.base0D);
    }
  }

  function handleVariantChange(v: "dark" | "light") {
    setVariant(v);
    if (!baseTheme && !props.editTheme) {
      var defaults = v === "dark" ? defaultDarkColors() : defaultLightColors();
      setColors(defaults);
      setCoreBg(defaults.base00);
      setCoreSurface(defaults.base02);
      setCoreFg(defaults.base05);
      setCoreAccent(defaults.base0D);
    }
  }

  function handleCoreChange(field: "bg" | "surface" | "fg" | "accent", value: string) {
    var hex = normalizeHex(value);
    if (field === "bg") setCoreBg(hex);
    if (field === "surface") setCoreSurface(hex);
    if (field === "fg") setCoreFg(hex);
    if (field === "accent") setCoreAccent(hex);
  }

  useEffect(function () {
    if (step === 2 && isValidHex(coreBg) && isValidHex(coreSurface) && isValidHex(coreFg) && isValidHex(coreAccent)) {
      var derived = deriveFullPalette(normalizeHex(coreBg), normalizeHex(coreSurface), normalizeHex(coreFg), normalizeHex(coreAccent), variant);
      setColors(derived);
    }
  }, [coreBg, coreSurface, coreFg, coreAccent, variant, step]);

  function handleColorChange(key: string, value: string) {
    var hex = normalizeHex(value);
    setColors(function (prev) {
      var next = { ...prev };
      next[key] = hex;
      return next;
    });
  }

  function handleSave() {
    ws.send({
      type: "theme:save",
      name: name || "Untitled Theme",
      author: author || "Custom",
      variant: variant,
      colors: colors,
    } as any);
    props.onClose();
  }

  function handleExport() {
    var theme: Record<string, string> = {
      name: name || "Untitled Theme",
      author: author || "Custom",
      variant: variant,
    };
    for (var i = 0; i < BASE16_KEYS.length; i++) {
      theme[BASE16_KEYS[i]] = colors[BASE16_KEYS[i]];
    }
    var blob = new Blob([JSON.stringify(theme, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = (name || "custom-theme").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  var canProceed = step === 1 ? name.trim().length > 0 : true;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div
        className="bg-base-200 border border-base-content/15 rounded-2xl shadow-2xl w-[90vw] max-w-[860px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-content/10">
          <div className="flex items-center gap-3">
            <Palette size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-base-content">
              {props.editTheme ? "Edit Theme" : "Create Theme"}
            </h2>
            <div className="flex items-center gap-1 ml-2">
              {[1, 2, 3, 4].map(function (s) {
                return (
                  <div
                    key={s}
                    className={"w-2 h-2 rounded-full transition-colors " + (s === step ? "bg-primary" : s < step ? "bg-primary/40" : "bg-base-content/15")}
                  />
                );
              })}
            </div>
          </div>
          <button onClick={props.onClose} className="btn btn-ghost btn-sm btn-circle">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1.5 block">Theme Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={function (e) { setName(e.target.value); }}
                  placeholder="My Awesome Theme"
                  className="input input-bordered w-full max-w-xs text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1.5 block">Variant</label>
                <div className="flex gap-2">
                  <button
                    onClick={function () { handleVariantChange("dark"); }}
                    className={"btn btn-sm gap-2 " + (variant === "dark" ? "btn-primary" : "btn-ghost")}
                  >
                    <Moon size={14} /> Dark
                  </button>
                  <button
                    onClick={function () { handleVariantChange("light"); }}
                    className={"btn btn-sm gap-2 " + (variant === "light" ? "btn-primary" : "btn-ghost")}
                  >
                    <Sun size={14} /> Light
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-2 block">Start from (optional)</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto pr-1">
                  {allThemes.filter(function (t: ThemeEntry) { return t.theme.variant === variant; }).map(function (t: ThemeEntry) {
                    var isSelected = baseTheme === t.theme.name;
                    return (
                      <button
                        key={t.id}
                        onClick={function () { handleBaseSelect(t.theme.name); }}
                        className={"relative rounded-lg border-2 p-1 transition-all cursor-pointer " + (isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-base-content/20")}
                      >
                        <ThemeSwatches colors={t.theme as unknown as Record<string, string>} />
                        <div className="text-[9px] text-base-content/50 mt-1 truncate text-center">{t.theme.name}</div>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check size={10} className="text-primary-content" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex gap-6">
              <div className="flex-1 space-y-4">
                <p className="text-xs text-base-content/40 mb-3">Pick 4 core colors. The remaining 12 are auto-derived.</p>

                <ColorPicker label="Background" sublabel="base00 — Main background" value={coreBg} onChange={function (v) { handleCoreChange("bg", v); }} />
                <ColorPicker label="Surface" sublabel="base02 — Panels, selections" value={coreSurface} onChange={function (v) { handleCoreChange("surface", v); }} />
                <ColorPicker label="Foreground" sublabel="base05 — Main text" value={coreFg} onChange={function (v) { handleCoreChange("fg", v); }} />
                <ColorPicker label="Accent" sublabel="base0D — Links, interactive elements" value={coreAccent} onChange={function (v) { handleCoreChange("accent", v); }} />
              </div>
              <div className="w-[320px] shrink-0">
                <ThemePreview colors={colors} variant={variant} />
                <div className="mt-3">
                  <ThemeSwatches colors={colors} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-6">
              <div className="flex-1 space-y-3">
                <button
                  onClick={function () { setShowAdvanced(!showAdvanced); }}
                  className="text-xs text-primary cursor-pointer hover:underline"
                >
                  {showAdvanced ? "Hide individual colors" : "Show individual colors"}
                </button>

                {showAdvanced && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-semibold text-base-content/30 uppercase tracking-wider mb-2">Backgrounds</div>
                      <div className="grid grid-cols-2 gap-2">
                        {["base00", "base01", "base02", "base03"].map(function (key) {
                          return <ColorPicker key={key} label={key} sublabel={COLOR_LABELS[key]} value={colors[key]} onChange={function (v) { handleColorChange(key, v); }} compact />;
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-base-content/30 uppercase tracking-wider mb-2">Foregrounds</div>
                      <div className="grid grid-cols-2 gap-2">
                        {["base04", "base05", "base06", "base07"].map(function (key) {
                          return <ColorPicker key={key} label={key} sublabel={COLOR_LABELS[key]} value={colors[key]} onChange={function (v) { handleColorChange(key, v); }} compact />;
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-base-content/30 uppercase tracking-wider mb-2">Syntax & UI</div>
                      <div className="grid grid-cols-2 gap-2">
                        {["base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"].map(function (key) {
                          return <ColorPicker key={key} label={key} sublabel={COLOR_LABELS[key]} value={colors[key]} onChange={function (v) { handleColorChange(key, v); }} compact />;
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {!showAdvanced && (
                  <p className="text-xs text-base-content/30">Colors were auto-derived from your core palette. Click above to fine-tune individual colors.</p>
                )}
              </div>
              <div className="w-[320px] shrink-0">
                <ThemePreview colors={colors} variant={variant} />
                <div className="mt-3">
                  <ThemeSwatches colors={colors} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <ThemePreview colors={colors} variant={variant} />
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">Name</label>
                  <input type="text" value={name} onChange={function (e) { setName(e.target.value); }} className="input input-bordered input-sm w-full" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-base-content/50 uppercase tracking-wider mb-1 block">Author</label>
                  <input type="text" value={author} onChange={function (e) { setAuthor(e.target.value); }} placeholder="Your name" className="input input-bordered input-sm w-full" />
                </div>
              </div>
              <ThemeSwatches colors={colors} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-base-content/10">
          <div>
            {step > 1 && (
              <button onClick={function () { setStep(step - 1); }} className="btn btn-ghost btn-sm gap-1">
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 4 && (
              <button onClick={handleExport} className="btn btn-ghost btn-sm gap-1">
                <Download size={14} /> Export JSON
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={function () { setStep(step + 1); }}
                disabled={!canProceed}
                className="btn btn-primary btn-sm gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button onClick={handleSave} className="btn btn-primary btn-sm gap-1">
                <Save size={14} /> Save Theme
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ColorPicker(props: { label: string; sublabel?: string; value: string; onChange: (hex: string) => void; compact?: boolean }) {
  var hex = normalizeHex(props.value);
  var displayHex = "#" + hex;

  return (
    <div className={"flex items-center gap-2 " + (props.compact ? "" : "py-1")}>
      <label className="relative cursor-pointer group">
        <div
          className={"rounded-lg border-2 border-base-content/15 group-hover:border-base-content/30 transition-colors " + (props.compact ? "w-7 h-7" : "w-9 h-9")}
          style={{ background: displayHex }}
        />
        <input
          type="color"
          value={displayHex}
          onChange={function (e) { props.onChange(e.target.value); }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <div className="flex-1 min-w-0">
        <div className={"font-medium text-base-content/70 " + (props.compact ? "text-[10px]" : "text-xs")}>{props.label}</div>
        {props.sublabel && <div className="text-[9px] text-base-content/30">{props.sublabel}</div>}
      </div>
      <input
        type="text"
        value={hex}
        onChange={function (e) { props.onChange(e.target.value); }}
        className={"input input-bordered font-mono " + (props.compact ? "input-xs w-20 text-[10px]" : "input-sm w-24 text-xs")}
        maxLength={7}
      />
    </div>
  );
}
