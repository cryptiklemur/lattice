import { useTheme } from "../../hooks/useTheme";
import { Sun, Moon, Check } from "lucide-react";
import type { ThemeEntry } from "../../themes/index";

function Swatch({ color }: { color: string }) {
  return (
    <div
      className="w-[10px] h-[10px] rounded-sm flex-shrink-0"
      style={{ background: "#" + color }}
    />
  );
}

function ThemeCard({
  entry,
  active,
  onSelect,
}: {
  entry: ThemeEntry;
  active: boolean;
  onSelect: () => void;
}) {
  var t = entry.theme;

  return (
    <button
      onClick={onSelect}
      className={
        "flex flex-col gap-2 p-2.5 px-3 rounded-md border cursor-pointer text-left transition-all duration-[120ms] relative " +
        (active
          ? "border-info bg-base-300"
          : "border-base-300 bg-base-300 hover:border-base-content/30 hover:bg-base-content/5")
      }
    >
      {active && (
        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-info flex items-center justify-center">
          <Check size={8} className="text-info-content" strokeWidth={1.8} />
        </div>
      )}

      <div className="flex gap-[3px] flex-wrap w-[80px]">
        <Swatch color={t.base00} />
        <Swatch color={t.base01} />
        <Swatch color={t.base02} />
        <Swatch color={t.base03} />
        <Swatch color={t.base04} />
        <Swatch color={t.base05} />
        <Swatch color={t.base06} />
        <Swatch color={t.base07} />
        <Swatch color={t.base08} />
        <Swatch color={t.base09} />
        <Swatch color={t.base0A} />
        <Swatch color={t.base0B} />
        <Swatch color={t.base0C} />
        <Swatch color={t.base0D} />
        <Swatch color={t.base0E} />
        <Swatch color={t.base0F} />
      </div>

      <div className="text-[12px] font-medium text-base-content">
        {t.name}
      </div>
    </button>
  );
}

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
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-3">
        {label}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
        {entries.map(function (entry) {
          return (
            <ThemeCard
              key={entry.id}
              entry={entry}
              active={entry.id === currentThemeId}
              onSelect={function () { onSelect(entry.id); }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function Appearance() {
  var { mode, currentThemeId, toggleMode, setTheme, themes } = useTheme();

  var darkThemes = themes.filter(function (e) { return e.theme.variant === "dark"; });
  var lightThemes = themes.filter(function (e) { return e.theme.variant === "light"; });

  return (
    <div className="py-2">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-base-content/40 mb-4">
        Appearance
      </div>

      <div className="flex items-center justify-between mb-6 p-3 px-3.5 bg-base-300 rounded-md border border-base-300">
        <div>
          <div className="text-[13px] font-medium text-base-content">Color Mode</div>
          <div className="text-[12px] text-base-content/40 mt-0.5">
            Currently: {mode === "dark" ? "Dark" : "Light"}
          </div>
        </div>

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
        onSelect={setTheme}
      />

      <ThemeGroup
        label="Light Themes"
        entries={lightThemes}
        currentThemeId={currentThemeId}
        onSelect={setTheme}
      />
    </div>
  );
}
