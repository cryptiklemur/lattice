import { useTheme } from "../../hooks/useTheme";
import type { ThemeEntry } from "../../themes/index";

function Swatch({ color }: { color: string }) {
  return (
    <div
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "2px",
        background: "#" + color,
        flexShrink: 0,
      }}
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        border: active
          ? "1.5px solid var(--blue)"
          : "1.5px solid var(--border-subtle)",
        background: active ? "var(--bg-overlay)" : "var(--bg-tertiary)",
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color var(--transition-fast), background var(--transition-fast)",
        position: "relative",
      }}
      onMouseEnter={function (e) {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
        }
      }}
      onMouseLeave={function (e) {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tertiary)";
        }
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "var(--blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "3px",
          flexWrap: "wrap",
          width: "80px",
        }}
      >
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

      <div
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--text-primary)",
          fontFamily: "var(--font-ui)",
        }}
      >
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
    <div style={{ marginBottom: "24px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "12px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "8px",
        }}
      >
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
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}
      >
        Appearance
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          padding: "12px 14px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
            Color Mode
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Currently: {mode === "dark" ? "Dark" : "Light"}
          </div>
        </div>

        <button
          onClick={toggleMode}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-overlay)",
            color: "var(--text-secondary)",
            fontSize: "12px",
            fontWeight: 500,
            transition: "background var(--transition-fast), color var(--transition-fast)",
          }}
          onMouseEnter={function (e) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--border-default)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={function (e) {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-overlay)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          {mode === "dark" ? (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 1v1M8 14v1M1 8h1M14 8h1M3.05 3.05l.7.7M12.25 12.25l.7.7M12.25 3.75l-.7.7M3.75 12.25l-.7.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Switch to Light
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 9.5A5.5 5.5 0 016.5 2.5a5.5 5.5 0 107 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
