import { useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useWebSocket } from "../../hooks/useWebSocket";
import { themes } from "../../themes/index";
import type { ThemeEntry } from "../../themes/index";

var POPULAR_DARK_THEMES = ["dracula", "catppuccin-mocha", "tokyo-night", "one-dark", "amoled"];
var POPULAR_LIGHT_THEMES = ["ayu-light", "catppuccin-latte", "github-light", "one-light", "rose-pine-dawn"];

var TOTAL_STEPS = 6;

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard(props: SetupWizardProps) {
  var [step, setStep] = useState(1);
  var [nodeName, setNodeName] = useState("");
  var [passphrase, setPassphrase] = useState("");
  var [passphraseConfirm, setPassphraseConfirm] = useState("");
  var [passphraseError, setPassphraseError] = useState("");
  var [projectPath, setProjectPath] = useState("");
  var [projectTitle, setProjectTitle] = useState("");
  var [configured, setConfigured] = useState<string[]>([]);

  var theme = useTheme();
  var ws = useWebSocket();

  function goNext() {
    setStep(function (s) { return Math.min(s + 1, TOTAL_STEPS); });
  }

  function goBack() {
    setStep(function (s) { return Math.max(s - 1, 1); });
  }

  function skipToNext() {
    goNext();
  }

  function handleNameNext() {
    var name = nodeName.trim();
    if (name.length > 0) {
      ws.send({ type: "settings:update", settings: { name } });
      setConfigured(function (c) { return [...c.filter(function (x) { return x !== "name"; }), "name: " + name]; });
    }
    goNext();
  }

  function handleAppearanceNext() {
    setConfigured(function (c) {
      var label = "theme: " + theme.currentThemeId + " (" + theme.mode + ")";
      return [...c.filter(function (x) { return !x.startsWith("theme:"); }), label];
    });
    goNext();
  }

  function handleSecurityNext() {
    if (passphrase.length === 0) {
      goNext();
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setPassphraseError("Passphrases do not match");
      return;
    }
    ws.send({ type: "settings:update", settings: { passphraseHash: passphrase } });
    setConfigured(function (c) { return [...c.filter(function (x) { return x !== "security"; }), "security: passphrase set"]; });
    goNext();
  }

  function handleProjectNext() {
    var path = projectPath.trim();
    if (path.length > 0) {
      ws.send({ type: "settings:update", settings: { projects: [{ path, slug: "", title: projectTitle.trim() || path.split("/").pop() || path, env: {} }] } });
      setConfigured(function (c) { return [...c.filter(function (x) { return !x.startsWith("project:"); }), "project: " + (projectTitle.trim() || path.split("/").pop() || path)]; });
    }
    goNext();
  }

  function handleDone() {
    localStorage.setItem("lattice-setup-complete", "1");
    props.onComplete();
  }

  var darkQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_DARK_THEMES.includes(e.id); });
  var lightQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_LIGHT_THEMES.includes(e.id); });

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={progressBarContainerStyle}>
          {Array.from({ length: TOTAL_STEPS }, function (_, i) {
            return (
              <div
                key={i}
                style={{
                  ...progressSegmentStyle,
                  background: i < step ? "var(--accent-primary)" : "var(--border-default)",
                  opacity: i < step ? 1 : 0.4,
                  transition: "background 300ms ease, opacity 300ms ease",
                }}
              />
            );
          })}
        </div>

        <div style={stepLabelStyle}>Step {step} of {TOTAL_STEPS}</div>

        <div style={contentStyle}>
          {step === 1 && <WelcomeStep />}
          {step === 2 && (
            <NameStep
              value={nodeName}
              onChange={setNodeName}
            />
          )}
          {step === 3 && (
            <AppearanceStep
              theme={theme}
              darkQuickPicks={darkQuickPicks}
              lightQuickPicks={lightQuickPicks}
            />
          )}
          {step === 4 && (
            <SecurityStep
              passphrase={passphrase}
              passphraseConfirm={passphraseConfirm}
              error={passphraseError}
              onPassphraseChange={function (v: string) {
                setPassphrase(v);
                setPassphraseError("");
              }}
              onConfirmChange={function (v: string) {
                setPassphraseConfirm(v);
                setPassphraseError("");
              }}
            />
          )}
          {step === 5 && (
            <ProjectStep
              path={projectPath}
              title={projectTitle}
              onPathChange={setProjectPath}
              onTitleChange={setProjectTitle}
            />
          )}
          {step === 6 && <DoneStep configured={configured} />}
        </div>

        <div style={footerStyle}>
          {step > 1 && step < TOTAL_STEPS && (
            <button onClick={goBack} style={backButtonStyle}>Back</button>
          )}
          {step === 1 && (
            <button onClick={goNext} style={primaryButtonStyle}>Get Started</button>
          )}
          {step === 2 && (
            <>
              <button onClick={skipToNext} style={skipButtonStyle}>Skip</button>
              <button onClick={handleNameNext} style={primaryButtonStyle}>Next</button>
            </>
          )}
          {step === 3 && (
            <button onClick={handleAppearanceNext} style={primaryButtonStyle}>Next</button>
          )}
          {step === 4 && (
            <>
              <button onClick={skipToNext} style={skipButtonStyle}>Skip</button>
              <button onClick={handleSecurityNext} style={primaryButtonStyle}>Next</button>
            </>
          )}
          {step === 5 && (
            <>
              <button onClick={skipToNext} style={skipButtonStyle}>Skip</button>
              <button onClick={handleProjectNext} style={primaryButtonStyle}>Add &amp; Continue</button>
            </>
          )}
          {step === 6 && (
            <button onClick={handleDone} style={primaryButtonStyle}>Open Dashboard</button>
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div style={stepContentStyle}>
      <div style={logoMarkStyle}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" fill="var(--accent-primary)" opacity="0.9" />
          <rect x="28" y="4" width="16" height="16" rx="3" fill="var(--accent-primary)" opacity="0.6" />
          <rect x="4" y="28" width="16" height="16" rx="3" fill="var(--accent-primary)" opacity="0.6" />
          <rect x="28" y="28" width="16" height="16" rx="3" fill="var(--accent-primary)" opacity="0.3" />
          <line x1="12" y1="20" x2="12" y2="28" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.7" />
          <line x1="36" y1="20" x2="36" y2="28" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.5" />
          <line x1="20" y1="12" x2="28" y2="12" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.7" />
          <line x1="20" y1="36" x2="28" y2="36" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>
      <h1 style={headingStyle}>Welcome to Lattice</h1>
      <p style={descStyle}>
        A multi-machine dashboard for Claude Code. Manage projects across all your computers from a single browser interface.
      </p>
      <p style={subDescStyle}>
        Let's get you set up in a few quick steps.
      </p>
    </div>
  );
}

interface NameStepProps {
  value: string;
  onChange: (v: string) => void;
}

function NameStep(props: NameStepProps) {
  return (
    <div style={stepContentStyle}>
      <h2 style={stepHeadingStyle}>Name this machine</h2>
      <p style={stepDescStyle}>
        Give this node a recognizable name. It will appear in your mesh when you connect multiple machines.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Machine name</label>
        <input
          type="text"
          value={props.value}
          onChange={function (e) { props.onChange(e.target.value); }}
          placeholder="My Machine"
          style={inputStyle}
          autoFocus
        />
      </div>
    </div>
  );
}

interface AppearanceStepProps {
  theme: ReturnType<typeof useTheme>;
  darkQuickPicks: ThemeEntry[];
  lightQuickPicks: ThemeEntry[];
}

function AppearanceStep(props: AppearanceStepProps) {
  var { theme, darkQuickPicks, lightQuickPicks } = props;
  var quickPicks = theme.mode === "dark" ? darkQuickPicks : lightQuickPicks;

  return (
    <div style={stepContentStyle}>
      <h2 style={stepHeadingStyle}>Choose your appearance</h2>
      <p style={stepDescStyle}>Select a theme and color mode. You can change this anytime from settings.</p>

      <div style={modeSwitchRowStyle}>
        <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>Mode</span>
        <button
          onClick={function () { theme.toggleMode(); }}
          style={modeToggleStyle}
        >
          <span style={{ opacity: theme.mode === "light" ? 1 : 0.4 }}>Light</span>
          <span style={modeDividerStyle}>/</span>
          <span style={{ opacity: theme.mode === "dark" ? 1 : 0.4 }}>Dark</span>
        </button>
      </div>

      <div style={themeGridStyle}>
        {quickPicks.map(function (entry: ThemeEntry) {
          var isActive = entry.id === theme.currentThemeId;
          return (
            <button
              key={entry.id}
              onClick={function () { theme.setTheme(entry.id); }}
              style={{
                ...themeSwatchStyle,
                outline: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                outlineOffset: "2px",
              }}
              title={entry.theme.name}
            >
              <div style={{ display: "flex", gap: "2px", marginBottom: "6px" }}>
                {(["base00", "base01", "base08", "base0B", "base0D", "base0E"] as const).map(function (key) {
                  return (
                    <div
                      key={key}
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                        background: "#" + entry.theme[key],
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                {entry.theme.name}
              </span>
              {isActive && (
                <span style={{ position: "absolute", top: "6px", right: "6px", fontSize: "10px", color: "var(--accent-primary)" }}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SecurityStepProps {
  passphrase: string;
  passphraseConfirm: string;
  error: string;
  onPassphraseChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
}

function SecurityStep(props: SecurityStepProps) {
  return (
    <div style={stepContentStyle}>
      <h2 style={stepHeadingStyle}>Set a passphrase</h2>
      <p style={stepDescStyle}>
        Protect your dashboard if others can access your network. Leave blank to skip — you can enable this later in settings.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Passphrase</label>
        <input
          type="password"
          value={props.passphrase}
          onChange={function (e) { props.onPassphraseChange(e.target.value); }}
          placeholder="Leave blank to skip"
          style={inputStyle}
          autoFocus
        />
      </div>
      {props.passphrase.length > 0 && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm passphrase</label>
          <input
            type="password"
            value={props.passphraseConfirm}
            onChange={function (e) { props.onConfirmChange(e.target.value); }}
            placeholder="Repeat passphrase"
            style={inputStyle}
          />
        </div>
      )}
      {props.error && (
        <p style={{ color: "var(--accent-danger)", fontSize: "13px", marginTop: "8px" }}>{props.error}</p>
      )}
      <p style={hintStyle}>
        If set, anyone opening the UI will be prompted for this passphrase. Node-to-node mesh connections use separate key-based authentication.
      </p>
    </div>
  );
}

interface ProjectStepProps {
  path: string;
  title: string;
  onPathChange: (v: string) => void;
  onTitleChange: (v: string) => void;
}

function ProjectStep(props: ProjectStepProps) {
  return (
    <div style={stepContentStyle}>
      <h2 style={stepHeadingStyle}>Add your first project</h2>
      <p style={stepDescStyle}>
        Point Lattice at a local directory. Claude will run inside that project. You can add more projects from the sidebar later.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Project path</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={props.path}
            onChange={function (e) { props.onPathChange(e.target.value); }}
            placeholder="/home/you/projects/my-app"
            style={{ ...inputStyle, flex: 1 }}
            autoFocus
          />
        </div>
        <span style={hintStyle}>Enter the absolute path to your project directory.</span>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Display name (optional)</label>
        <input
          type="text"
          value={props.title}
          onChange={function (e) { props.onTitleChange(e.target.value); }}
          placeholder="My App"
          style={inputStyle}
        />
      </div>
    </div>
  );
}

interface DoneStepProps {
  configured: string[];
}

function DoneStep(props: DoneStepProps) {
  return (
    <div style={stepContentStyle}>
      <div style={checkmarkStyle}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" stroke="var(--accent-success)" strokeWidth="1.5" />
          <path d="M9 16.5L13.5 21L23 11" stroke="var(--accent-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 style={stepHeadingStyle}>You're all set</h2>
      <p style={stepDescStyle}>Lattice is ready. Here's what was configured:</p>
      {props.configured.length > 0 ? (
        <ul style={summaryListStyle}>
          {props.configured.map(function (item: string, i: number) {
            return (
              <li key={i} style={summaryItemStyle}>
                <span style={{ color: "var(--accent-success)", marginRight: "8px" }}>+</span>
                {item}
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={hintStyle}>Everything was skipped — you can configure all of this from settings at any time.</p>
      )}
    </div>
  );
}

var overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0, 0, 0, 0.85)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

var cardStyle: React.CSSProperties = {
  width: "480px",
  maxWidth: "calc(100vw - 32px)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "0",
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
};

var progressBarContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  marginBottom: "8px",
};

var progressSegmentStyle: React.CSSProperties = {
  flex: 1,
  height: "3px",
  borderRadius: "2px",
};

var stepLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  marginBottom: "28px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

var contentStyle: React.CSSProperties = {
  flex: 1,
  minHeight: "280px",
};

var footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "32px",
  paddingTop: "20px",
  borderTop: "1px solid var(--border-subtle)",
};

var primaryButtonStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "var(--accent-primary)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity var(--transition-fast)",
};

var backButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "var(--bg-overlay)",
  color: "var(--text-secondary)",
  borderRadius: "var(--radius-md)",
  fontSize: "14px",
  cursor: "pointer",
  marginRight: "auto",
};

var skipButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: "var(--radius-md)",
  fontSize: "14px",
  cursor: "pointer",
};

var stepContentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0",
};

var logoMarkStyle: React.CSSProperties = {
  marginBottom: "20px",
};

var headingStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: "12px",
  letterSpacing: "-0.02em",
  fontFamily: "var(--font-sans)",
};

var descStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: "8px",
};

var subDescStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-muted)",
  marginTop: "8px",
};

var stepHeadingStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "var(--text-primary)",
  marginBottom: "8px",
  letterSpacing: "-0.01em",
  fontFamily: "var(--font-sans)",
};

var stepDescStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: "20px",
};

var fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginBottom: "16px",
};

var labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

var inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
  width: "100%",
};

var hintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.5,
  marginTop: "4px",
};

var modeSwitchRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
};

var modeToggleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 12px",
  background: "var(--bg-overlay)",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border-default)",
  fontSize: "13px",
  color: "var(--text-primary)",
  cursor: "pointer",
};

var modeDividerStyle: React.CSSProperties = {
  color: "var(--text-muted)",
};

var themeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "8px",
};

var themeSwatchStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "8px 6px 6px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  transition: "border-color var(--transition-fast), outline-color var(--transition-fast)",
  overflow: "hidden",
};

var checkmarkStyle: React.CSSProperties = {
  marginBottom: "16px",
};

var summaryListStyle: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginTop: "4px",
};

var summaryItemStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  display: "flex",
  alignItems: "center",
  padding: "6px 10px",
  background: "var(--bg-tertiary)",
  borderRadius: "var(--radius-sm)",
};
