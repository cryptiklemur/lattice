import { memo, useMemo, useCallback } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useNotificationPreference } from "../../hooks/useNotifications";
import { Sun, Moon, Check } from "lucide-react";
import type { ThemeEntry } from "../../themes/index";

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

export function Appearance() {
  var { mode, currentThemeId, toggleMode, setTheme, themes } = useTheme();
  var notifPref = useNotificationPreference();

  var darkThemes = useMemo(function () {
    return themes.filter(function (e) { return e.theme.variant === "dark"; });
  }, [themes]);

  var lightThemes = useMemo(function () {
    return themes.filter(function (e) { return e.theme.variant === "light"; });
  }, [themes]);

  var handleThemeSelect = useCallback(function (id: string) {
    setTheme(id);
  }, [setTheme]);

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

      <div className="mb-5 mt-6">
        <div className="text-[11px] font-semibold tracking-[0.06em] uppercase text-base-content/40 mb-3">
          Notifications
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-[13px] text-base-content">Browser notifications</div>
            <div className="text-[11px] text-base-content/30 mt-0.5">
              {notifPref.permission === "denied"
                ? "Blocked by browser — update in browser settings"
                : "Get notified about responses, node changes, and connection events"}
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={notifPref.enabled}
            onChange={notifPref.toggle}
            disabled={notifPref.permission === "denied"}
          />
        </div>
      </div>
    </div>
  );
}
