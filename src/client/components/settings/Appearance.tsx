import { memo, useMemo, useCallback, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useWebSocket } from "../../hooks/useWebSocket";
import { Sun, Moon, Check, Plus, Pencil, Trash2, Download } from "lucide-react";
import type { ThemeEntry } from "../../themes/index";
import { ThemeWizard } from "./ThemeWizard";
import { ThemeSwatches } from "./ThemePreview";
import { ContextMenu, useContextMenu } from "../ui/ContextMenu";

var SWATCH_KEYS = [
  "base00", "base01", "base02", "base03",
  "base04", "base05", "base06", "base07",
  "base08", "base09", "base0A", "base0B",
  "base0C", "base0D", "base0E", "base0F",
] as const;

var ThemeCard = memo(function ThemeCard({
  entry,
  active,
  onSelect,
}: {
  entry: ThemeEntry;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  var t = entry.theme;

  function handleClick() {
    onSelect(entry.id);
  }

  return (
    <button
      onClick={handleClick}
      className={
        "flex flex-col gap-2 p-3 sm:p-2.5 px-3 rounded-lg border cursor-pointer text-left transition-colors duration-[120ms] relative focus-visible:ring-2 focus-visible:ring-primary " +
        (active
          ? "border-primary bg-base-300 shadow-sm"
          : "border-base-content/15 bg-base-300 hover:border-base-content/30")
      }
    >
      {active && (
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
          <Check size={8} className="text-primary-content" strokeWidth={1.8} />
        </div>
      )}

      <div className="flex gap-[3px] flex-wrap w-[80px]">
        {SWATCH_KEYS.map(function (key) {
          return (
            <div
              key={key}
              className="w-[10px] h-[10px] rounded-sm flex-shrink-0 ring-1 ring-base-content/10"
              style={{ background: "#" + t[key] }}
            />
          );
        })}
      </div>

      <div className="text-[12px] font-medium text-base-content">
        {t.name}
      </div>
    </button>
  );
});

function ThemeGroup({
  label,
  entries,
  currentThemeId,
  onSelect,
}: {
  label: string;
  entries: ThemeEntry[];
  currentThemeId: string;
  onSelect: (id: string) => void;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="text-[11px] font-mono font-bold tracking-[0.1em] uppercase text-base-content/40 mb-3">
        {label}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
        {entries.map(function (entry) {
          return (
            <ThemeCard
              key={entry.id}
              entry={entry}
              active={entry.id === currentThemeId}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CustomTheme {
  name: string;
  author: string;
  variant: string;
  filename: string;
  colors: Record<string, string>;
}

export function Appearance() {
  var ws = useWebSocket();
  var [wizardOpen, setWizardOpen] = useState(false);
  var [editTheme, setEditTheme] = useState<CustomTheme | null>(null);
  var ctxMenu = useContextMenu<CustomTheme>();

  var { mode, currentThemeId, toggleMode, setTheme, themes, allThemes } = useTheme();

  var customThemes = useMemo(function () {
    return allThemes
      .filter(function (e) { return e.id.startsWith("custom:"); })
      .map(function (e): CustomTheme {
        var colors: Record<string, string> = {};
        for (var key of Object.keys(e.theme)) {
          if (key.startsWith("base0")) {
            colors[key] = (e.theme as any)[key];
          }
        }
        return {
          name: e.theme.name,
          author: e.theme.author,
          variant: e.theme.variant,
          filename: e.id.replace("custom:", ""),
          colors,
        };
      });
  }, [allThemes]);

  var darkThemes = useMemo(function () {
    return themes.filter(function (e) { return e.theme.variant === "dark"; });
  }, [themes]);

  var lightThemes = useMemo(function () {
    return themes.filter(function (e) { return e.theme.variant === "light"; });
  }, [themes]);

  var handleThemeSelect = useCallback(function (id: string) {
    setTheme(id);
  }, [setTheme]);

  function handleEditCustom(theme: CustomTheme) {
    setEditTheme(theme);
    setWizardOpen(true);
  }

  function handleDeleteCustom(theme: CustomTheme) {
    ws.send({ type: "theme:delete", name: theme.filename } as any);
  }

  function handleExportCustom(theme: CustomTheme) {
    var obj: Record<string, string> = {
      name: theme.name,
      author: theme.author,
      variant: theme.variant,
    };
    for (var key of Object.keys(theme.colors)) {
      obj[key] = theme.colors[key];
    }
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = theme.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-6">
        <div className="text-[12px] font-semibold text-base-content/40">Color Mode</div>
        <button
          onClick={toggleMode}
          className="btn btn-ghost btn-sm border border-base-content/20"
        >
          {mode === "dark" ? (
            <>
              <Sun size={12} />
              Switch to Light
            </>
          ) : (
            <>
              <Moon size={12} />
              Switch to Dark
            </>
          )}
        </button>
      </div>

      <ThemeGroup
        label="Dark Themes"
        entries={darkThemes}
        currentThemeId={currentThemeId}
        onSelect={handleThemeSelect}
      />

      <ThemeGroup
        label="Light Themes"
        entries={lightThemes}
        currentThemeId={currentThemeId}
        onSelect={handleThemeSelect}
      />

      <div className="mb-6">
        <div className="text-[11px] font-mono font-bold tracking-[0.1em] uppercase text-base-content/40 mb-3">
          Custom Themes
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
          {customThemes.map(function (ct) {
            var customId = "custom:" + ct.filename;
            var isActive = customId === currentThemeId;
            return (
              <button
                key={ct.filename}
                onClick={function () { handleThemeSelect(customId); }}
                onContextMenu={function (e) { ctxMenu.open(e, ct); }}
                data-allow-context-menu
                className={
                  "flex flex-col gap-2 p-3 sm:p-2.5 px-3 rounded-lg border cursor-pointer text-left transition-colors duration-[120ms] relative focus-visible:ring-2 focus-visible:ring-primary " +
                  (isActive
                    ? "border-primary bg-base-300 shadow-sm"
                    : "border-base-content/15 bg-base-300 hover:border-base-content/30")
                }
              >
                {isActive ? (
                  <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={8} className="text-primary-content" strokeWidth={1.8} />
                  </div>
                ) : (
                  <div
                    role="button"
                    className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-base-content/10 transition-colors"
                    onClick={function (e) { e.stopPropagation(); handleEditCustom(ct); }}
                  >
                    <Pencil size={10} className="text-base-content/30 hover:text-base-content/60" />
                  </div>
                )}
                <ThemeSwatches colors={ct.colors} />
                <div className="text-[12px] font-medium text-base-content truncate w-full">
                  {ct.name}
                </div>
              </button>
            );
          })}

          <button
            onClick={function () { setEditTheme(null); setWizardOpen(true); }}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-base-content/15 cursor-pointer text-left transition-colors duration-[120ms] hover:border-primary/40 hover:bg-primary/5 min-h-[70px]"
          >
            <Plus size={18} className="text-base-content/25" />
            <div className="text-[11px] text-base-content/30">Create Theme</div>
          </button>
        </div>
      </div>

      {ctxMenu.state && (
        <ContextMenu
          x={ctxMenu.state.x}
          y={ctxMenu.state.y}
          onClose={ctxMenu.close}
          label="Custom theme actions"
          items={[
            { label: "Edit", icon: <Pencil size={14} />, onClick: function () { handleEditCustom(ctxMenu.state!.data); } },
            { label: "Export JSON", icon: <Download size={14} />, onClick: function () { handleExportCustom(ctxMenu.state!.data); } },
            { type: "divider" as const },
            { label: "Delete", icon: <Trash2 size={14} />, danger: true, onClick: function () { handleDeleteCustom(ctxMenu.state!.data); } },
          ]}
        />
      )}

      {wizardOpen && (
        <ThemeWizard
          onClose={function () { setWizardOpen(false); setEditTheme(null); }}
          editTheme={editTheme ? { name: editTheme.name, author: editTheme.author, variant: editTheme.variant as "dark" | "light", colors: editTheme.colors } : null}
        />
      )}
    </div>
  );
}
