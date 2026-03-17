import { useState, useEffect } from "react";
import { ArrowRight, ChevronRight, ChevronLeft, Server, Palette, Lock, Folder, Info, Moon, Sun, Check, CheckCircle } from "lucide-react";
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
  var [prevStep, setPrevStep] = useState(1);
  var [animating, setAnimating] = useState(false);
  var [nodeName, setNodeName] = useState("");
  var [passphrase, setPassphrase] = useState("");
  var [passphraseConfirm, setPassphraseConfirm] = useState("");
  var [passphraseError, setPassphraseError] = useState("");
  var [projectPath, setProjectPath] = useState("");
  var [projectTitle, setProjectTitle] = useState("");
  var [configured, setConfigured] = useState<string[]>([]);

  var theme = useTheme();
  var ws = useWebSocket();

  function navigateTo(next: number) {
    if (animating) return;
    setPrevStep(step);
    setAnimating(true);
    setTimeout(function () {
      setStep(next);
      setAnimating(false);
    }, 180);
  }

  function goNext() {
    navigateTo(Math.min(step + 1, TOTAL_STEPS));
  }

  function goBack() {
    navigateTo(Math.max(step - 1, 1));
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
      var derivedName = path.replace(/\/+$/, "").split("/").pop() || path;
      var title = projectTitle.trim() || derivedName;
      ws.send({ type: "settings:update", settings: { projects: [{ path: path, slug: "", title: title, env: {} }] } });
      setConfigured(function (c) { return [...c.filter(function (x) { return !x.startsWith("project:"); }), "project: " + title]; });
    }
    goNext();
  }

  function handleDone() {
    localStorage.setItem("lattice-setup-complete", "1");
    props.onComplete();
  }

  var darkQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_DARK_THEMES.includes(e.id); });
  var lightQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_LIGHT_THEMES.includes(e.id); });
  var isForward = step > prevStep;

  return (
    <div style={overlayStyle}>
      <style>{wizardCSS}</style>

      {step === 1 ? (
        <div style={fullscreenWelcomeStyle}>
          <div style={gridPatternStyle} aria-hidden="true" />
          <div style={welcomeInnerStyle}>
            <div className="wizard-fade-in" style={{ animationDelay: "0ms" }}>
              <LatticeLogomark size={64} />
            </div>
            <h1 className="wizard-fade-in" style={{ ...wordmarkStyle, animationDelay: "80ms" }}>Lattice</h1>
            <p className="wizard-fade-in" style={{ ...taglineStyle, animationDelay: "160ms" }}>
              One dashboard. Every machine.
            </p>
            <div className="wizard-fade-in" style={{ animationDelay: "240ms" }}>
              <TerminalPreview />
            </div>
            <div className="wizard-fade-in" style={{ animationDelay: "320ms" }}>
              <button
                onClick={goNext}
                style={welcomeCTAStyle}
                className="wizard-btn-primary"
              >
                Get Started
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="wizard-fade-in" style={{ ...welcomeSubnoteStyle, animationDelay: "380ms" }}>
              Takes about 2 minutes
            </p>
          </div>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={stepDotsStyle}>
              {Array.from({ length: TOTAL_STEPS - 1 }, function (_, i) {
                var dotStep = i + 2;
                var isComplete = step > dotStep;
                var isActive = step === dotStep;
                return (
                  <div
                    key={i}
                    style={{
                      ...dotStyle,
                      background: isComplete ? "var(--accent-primary)" : isActive ? "var(--accent-primary)" : "var(--border-default)",
                      opacity: isActive ? 1 : isComplete ? 0.7 : 0.35,
                      width: isActive ? "24px" : "8px",
                      transition: "all 250ms ease",
                    }}
                  />
                );
              })}
            </div>
            <span style={stepCounterStyle}>
              {step - 1} / {TOTAL_STEPS - 1}
            </span>
          </div>

          <div
            style={contentStyle}
            className={animating ? (isForward ? "wizard-slide-out-left" : "wizard-slide-out-right") : (isForward ? "wizard-slide-in-right" : "wizard-slide-in-left")}
            key={step}
          >
            {step === 2 && (
              <NameStep value={nodeName} onChange={setNodeName} />
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
            {step > 2 && step < TOTAL_STEPS && (
              <button onClick={goBack} style={backButtonStyle} className="wizard-btn-back">
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {step === 2 && (
              <button onClick={goBack} style={backButtonStyle} className="wizard-btn-back">
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <div style={footerRightStyle}>
              {step === 2 && (
                <button onClick={skipToNext} style={skipButtonStyle} className="wizard-btn-skip">Skip</button>
              )}
              {step === 3 && (
                <button onClick={handleAppearanceNext} style={primaryButtonStyle} className="wizard-btn-primary">
                  Continue
                  <ChevronRight size={14} />
                </button>
              )}
              {step === 4 && (
                <>
                  <button onClick={skipToNext} style={skipButtonStyle} className="wizard-btn-skip">Skip</button>
                  <button onClick={handleSecurityNext} style={primaryButtonStyle} className="wizard-btn-primary">
                    Continue
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              {step === 5 && (
                <>
                  <button onClick={skipToNext} style={skipButtonStyle} className="wizard-btn-skip">Skip</button>
                  <button onClick={handleProjectNext} style={primaryButtonStyle} className="wizard-btn-primary">
                    Add &amp; Continue
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              {step === 6 && (
                <button onClick={handleDone} style={doneButtonStyle} className="wizard-btn-done">
                  Open Dashboard
                  <ArrowRight size={16} />
                </button>
              )}
              {step === 2 && (
                <button onClick={handleNameNext} style={primaryButtonStyle} className="wizard-btn-primary">
                  Continue
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LatticeLogomark(props: { size: number }) {
  var s = props.size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="18" height="18" rx="3" fill="var(--accent-primary)" />
      <rect x="26" y="4" width="18" height="18" rx="3" fill="var(--accent-primary)" opacity="0.55" />
      <rect x="4" y="26" width="18" height="18" rx="3" fill="var(--accent-primary)" opacity="0.55" />
      <rect x="26" y="26" width="18" height="18" rx="3" fill="var(--accent-primary)" opacity="0.25" />
      <line x1="13" y1="22" x2="13" y2="26" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.8" />
      <line x1="35" y1="22" x2="35" y2="26" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.5" />
      <line x1="22" y1="13" x2="26" y2="13" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.8" />
      <line x1="22" y1="35" x2="26" y2="35" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

function TerminalPreview() {
  var [visible, setVisible] = useState(0);
  var lines = [
    { prefix: "$ ", text: "lattice", color: "var(--text-primary)" },
    { prefix: "", text: "  [lattice] Daemon started (PID 4821)", color: "var(--text-muted)" },
    { prefix: "", text: "  [lattice] Listening on https://0.0.0.0:7654", color: "var(--accent-success)" },
    { prefix: "", text: "  [discovery] Found 2 nodes on mesh", color: "var(--accent-primary)" },
  ];

  useEffect(function () {
    var timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach(function (_, i) {
      timers.push(setTimeout(function () { setVisible(i + 1); }, 600 + i * 600));
    });
    return function () { timers.forEach(clearTimeout); };
  }, []);

  return (
    <div style={terminalBlockStyle}>
      <div style={terminalTitleBarStyle}>
        <span style={terminalDotStyle("#ef4444")} />
        <span style={terminalDotStyle("#f59e0b")} />
        <span style={terminalDotStyle("#22c55e")} />
        <span style={terminalTitleTextStyle}>lattice — zsh</span>
      </div>
      <div style={terminalBodyStyle}>
        {lines.map(function (line, i) {
          return (
            <div
              key={i}
              style={{
                ...terminalLineStyle,
                opacity: i < visible ? 1 : 0,
                transform: i < visible ? "translateY(0)" : "translateY(4px)",
                transition: "opacity 200ms ease, transform 200ms ease",
                color: line.color,
              }}
            >
              {line.prefix && <span style={{ color: "var(--accent-primary)" }}>{line.prefix}</span>}
              <span style={{ fontFamily: "var(--font-mono)" }}>{line.text}</span>
            </div>
          );
        })}
        <div style={terminalCursorRowStyle}>
          <span style={{ color: "var(--accent-primary)" }}>$ </span>
          <span style={terminalCursorStyle} />
        </div>
      </div>
    </div>
  );
}

interface NameStepProps {
  value: string;
  onChange: (v: string) => void;
}

function NameStep(props: NameStepProps) {
  var displayName = props.value.trim() || "this-machine";
  return (
    <div style={stepContentStyle}>
      <div style={stepIconRowStyle}>
        <Server size={22} color="var(--accent-primary)" />
      </div>
      <h2 style={stepHeadingStyle}>Name this machine</h2>
      <p style={stepDescStyle}>
        Give this node a recognizable name. It appears in your mesh when you connect multiple computers.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Machine name</label>
        <div style={inputWrapperStyle}>
          <span style={inputPromptStyle}>&gt;</span>
          <input
            type="text"
            value={props.value}
            onChange={function (e) { props.onChange(e.target.value); }}
            placeholder="my-laptop"
            style={monoInputStyle}
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
      <div style={previewBannerStyle}>
        <span style={previewLabelStyle}>Preview</span>
        <span style={previewValueStyle}>{displayName}</span>
        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>will appear on your mesh</span>
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
      <div style={stepIconRowStyle}>
        <Palette size={22} color="var(--accent-primary)" />
      </div>
      <h2 style={stepHeadingStyle}>Choose appearance</h2>
      <p style={stepDescStyle}>Pick a color theme. You can always change this in settings.</p>

      <div style={modeToggleRowStyle}>
        <button
          onClick={function () { if (theme.mode !== "dark") { theme.toggleMode(); } }}
          style={{
            ...modeTabStyle,
            background: theme.mode === "dark" ? "var(--accent-primary)" : "var(--bg-overlay)",
            color: theme.mode === "dark" ? "#fff" : "var(--text-secondary)",
          }}
        >
          <Moon size={13} />
          Dark
        </button>
        <button
          onClick={function () { if (theme.mode !== "light") { theme.toggleMode(); } }}
          style={{
            ...modeTabStyle,
            background: theme.mode === "light" ? "var(--accent-primary)" : "var(--bg-overlay)",
            color: theme.mode === "light" ? "#fff" : "var(--text-secondary)",
          }}
        >
          <Sun size={13} />
          Light
        </button>
      </div>

      <div style={themeGridStyle}>
        {quickPicks.map(function (entry: ThemeEntry) {
          var isActive = entry.id === theme.currentThemeId;
          var bg = "#" + entry.theme.base00;
          var accent = "#" + entry.theme.base0D;
          var text = "#" + entry.theme.base05;
          var red = "#" + entry.theme.base08;
          var green = "#" + entry.theme.base0B;
          return (
            <button
              key={entry.id}
              onClick={function () { theme.setTheme(entry.id); }}
              style={{
                ...themeCardStyle,
                outline: isActive ? "2px solid var(--accent-primary)" : "2px solid transparent",
                outlineOffset: "2px",
              }}
              title={entry.theme.name}
            >
              <div style={{ ...themeCardPreviewStyle, background: bg }}>
                <div style={{ ...themeCardBarStyle, background: "#" + entry.theme.base01 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: red, display: "inline-block" }} />
                  <span style={{ width: "24px", height: "4px", borderRadius: "2px", background: accent, opacity: 0.7, display: "inline-block", marginLeft: "4px" }} />
                </div>
                <div style={{ padding: "4px 5px", display: "flex", flexDirection: "column", gap: "3px" }}>
                  <div style={{ width: "80%", height: "3px", borderRadius: "2px", background: accent, opacity: 0.8 }} />
                  <div style={{ width: "60%", height: "3px", borderRadius: "2px", background: text, opacity: 0.4 }} />
                  <div style={{ width: "70%", height: "3px", borderRadius: "2px", background: green, opacity: 0.6 }} />
                </div>
              </div>
              <span style={themeCardLabelStyle}>{entry.theme.name}</span>
              {isActive && (
                <div style={themeCardCheckStyle}>
                  <Check size={10} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{
        marginTop: "16px",
        borderRadius: "8px",
        border: "1px solid var(--border-default)",
        overflow: "hidden",
        transition: "all 300ms ease",
      }}>
        <div style={{
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          padding: "6px 10px",
          background: "var(--bg-tertiary)",
          borderBottom: "1px solid var(--border-subtle)",
          transition: "all 300ms ease",
        }}>Preview</div>
        <div style={{
          display: "flex",
          height: "100px",
          background: "var(--bg-primary)",
          transition: "all 300ms ease",
        }}>
          <div style={{
            width: "72px",
            flexShrink: 0,
            borderRight: "1px solid var(--border-subtle)",
            padding: "8px 6px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            transition: "all 300ms ease",
          }}>
            <div style={{ fontSize: "8px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px", transition: "color 300ms ease" }}>Projects</div>
            <div style={{ height: "6px", width: "90%", borderRadius: "3px", background: "var(--accent-primary)", opacity: 0.8, transition: "background 300ms ease" }} />
            <div style={{ height: "6px", width: "70%", borderRadius: "3px", background: "var(--bg-overlay)", transition: "background 300ms ease" }} />
            <div style={{ height: "6px", width: "80%", borderRadius: "3px", background: "var(--bg-overlay)", transition: "background 300ms ease" }} />
          </div>
          <div style={{
            flex: 1,
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            transition: "all 300ms ease",
          }}>
            <div style={{ fontSize: "9px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)", transition: "color 300ms ease" }}>New Session</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-primary)", flexShrink: 0, opacity: 0.6, transition: "background 300ms ease" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ height: "4px", width: "120px", borderRadius: "2px", background: "var(--text-secondary)", opacity: 0.5, transition: "background 300ms ease" }} />
                  <div style={{ height: "4px", width: "80px", borderRadius: "2px", background: "var(--text-secondary)", opacity: 0.3, transition: "background 300ms ease" }} />
                </div>
              </div>
            </div>
            <div style={{
              height: "18px",
              borderRadius: "4px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              transition: "all 300ms ease",
            }} />
          </div>
        </div>
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
  var strength = getPassphraseStrength(props.passphrase);

  return (
    <div style={stepContentStyle}>
      <div style={stepIconRowStyle}>
        <Lock size={22} color="var(--accent-primary)" />
      </div>
      <h2 style={stepHeadingStyle}>Set a passphrase</h2>

      <div style={infoBoxStyle}>
        <Info size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: "1px" }} />
        <p style={infoBoxTextStyle}>
          Optional. Protects your dashboard on shared networks. Node-to-node connections use separate key-based auth.
        </p>
      </div>

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
        {props.passphrase.length > 0 && (
          <div style={strengthBarRowStyle}>
            <div style={strengthBarTrackStyle}>
              <div style={{
                ...strengthBarFillStyle,
                width: strength.pct + "%",
                background: strength.color,
                transition: "width 200ms ease, background 200ms ease",
              }} />
            </div>
            <span style={{ ...strengthLabelStyle, color: strength.color }}>{strength.label}</span>
          </div>
        )}
      </div>

      {props.passphrase.length > 0 && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Confirm passphrase</label>
          <input
            type="password"
            value={props.passphraseConfirm}
            onChange={function (e) { props.onConfirmChange(e.target.value); }}
            placeholder="Repeat passphrase"
            style={{
              ...inputStyle,
              borderColor: props.error ? "var(--accent-danger)" : "var(--border-default)",
            }}
          />
        </div>
      )}

      {props.error && (
        <p style={errorTextStyle}>{props.error}</p>
      )}
    </div>
  );
}

function getPassphraseStrength(p: string) {
  if (p.length === 0) return { pct: 0, label: "", color: "var(--text-muted)" };
  if (p.length < 8) return { pct: 25, label: "Weak", color: "var(--accent-danger)" };
  if (p.length < 14) return { pct: 55, label: "Fair", color: "var(--accent-warning)" };
  if (p.length < 20) return { pct: 80, label: "Good", color: "var(--accent-primary)" };
  return { pct: 100, label: "Strong", color: "var(--accent-success)" };
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
      <div style={stepIconRowStyle}>
        <Folder size={22} color="var(--accent-primary)" />
      </div>
      <h2 style={stepHeadingStyle}>Add your first project</h2>
      <p style={stepDescStyle}>
        Point Lattice at a local directory. Claude runs inside that workspace. Add more projects from the sidebar anytime.
      </p>
      <div style={fieldStyle}>
        <label style={labelStyle}>Project path</label>
        <input
          type="text"
          value={props.path}
          onChange={function (e) { props.onPathChange(e.target.value); }}
          placeholder="/home/you/projects/my-app"
          style={monoInputStyle}
          autoFocus
          spellCheck={false}
        />
        <span style={hintStyle}>Absolute path to a local directory on this machine.</span>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Display name <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
        <input
          type="text"
          value={props.title}
          onChange={function (e) { props.onTitleChange(e.target.value); }}
          placeholder={props.path ? (props.path.replace(/\/+$/, "").split("/").pop() || "My App") : "My App"}
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
    <div style={doneStepStyle}>
      <div style={doneCheckCircleStyle} className="wizard-check-pop">
        <CheckCircle size={36} color="var(--accent-success)" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 style={doneHeadingStyle}>You're all set</h2>
      <p style={stepDescStyle}>Lattice is configured and ready to go.</p>

      {props.configured.length > 0 ? (
        <ul style={summaryListStyle}>
          {props.configured.map(function (item: string, i: number) {
            return (
              <li key={i} style={summaryItemStyle} className="wizard-fade-in" data-delay={i * 60}>
                <span style={summaryCheckStyle}>
                  <Check size={10} />
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)" }}>{item}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p style={hintStyle}>Everything was skipped — configure it from settings anytime.</p>
      )}
    </div>
  );
}

var wizardCSS = `
  @keyframes wizard-fade-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes wizard-slide-in-right {
    from { opacity: 0; transform: translateX(24px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes wizard-slide-in-left {
    from { opacity: 0; transform: translateX(-24px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes wizard-check-pop {
    0% { transform: scale(0.5); opacity: 0; }
    70% { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes wizard-cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes wizard-grid-shift {
    0% { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }
  .wizard-fade-in {
    animation: wizard-fade-in 400ms ease both;
  }
  .wizard-slide-in-right {
    animation: wizard-slide-in-right 220ms ease both;
  }
  .wizard-slide-in-left {
    animation: wizard-slide-in-left 220ms ease both;
  }
  .wizard-check-pop {
    animation: wizard-check-pop 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }
  .wizard-btn-primary {
    transition: background 150ms ease, transform 100ms ease, box-shadow 150ms ease !important;
  }
  .wizard-btn-primary:hover {
    background: var(--accent-secondary) !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(124, 106, 247, 0.35);
  }
  .wizard-btn-primary:active {
    transform: translateY(0);
  }
  .wizard-btn-done {
    transition: background 150ms ease, transform 100ms ease, box-shadow 150ms ease !important;
  }
  .wizard-btn-done:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(74, 222, 128, 0.4);
  }
  .wizard-btn-done:active {
    transform: translateY(0);
  }
  .wizard-btn-back:hover {
    color: var(--text-primary) !important;
    background: var(--bg-surface) !important;
  }
  .wizard-btn-skip:hover {
    color: var(--text-secondary) !important;
  }
`;

var overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-primary)",
  transition: "background 300ms ease",
};

var fullscreenWelcomeStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "520px",
  padding: "48px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

var gridPatternStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundImage: `
    linear-gradient(rgba(124,106,247,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,106,247,0.07) 1px, transparent 1px)
  `,
  backgroundSize: "40px 40px",
  animation: "wizard-grid-shift 8s linear infinite",
  pointerEvents: "none",
  zIndex: 0,
};

var welcomeInnerStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0",
};

var wordmarkStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "clamp(48px, 10vw, 72px)",
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.04em",
  marginTop: "20px",
  marginBottom: "0",
  lineHeight: 1,
};

var taglineStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "17px",
  color: "var(--text-secondary)",
  marginTop: "12px",
  marginBottom: "32px",
  letterSpacing: "0.01em",
};

var welcomeCTAStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "28px",
  padding: "0 32px",
  height: "52px",
  background: "var(--accent-primary)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  fontSize: "15px",
  fontWeight: 600,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  letterSpacing: "0.01em",
  border: "none",
};

var welcomeSubnoteStyle: React.CSSProperties = {
  marginTop: "16px",
  fontSize: "12px",
  color: "var(--text-muted)",
  fontFamily: "var(--font-ui)",
};

var terminalBlockStyle: React.CSSProperties = {
  width: "380px",
  maxWidth: "calc(100vw - 48px)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-lg)",
  overflow: "hidden",
  boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,106,247,0.1)",
};

var terminalTitleBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 14px",
  background: "var(--bg-overlay)",
  borderBottom: "1px solid var(--border-subtle)",
};

function terminalDotStyle(color: string): React.CSSProperties {
  return {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: color,
    opacity: 0.8,
    flexShrink: 0,
  };
}

var terminalTitleTextStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  marginLeft: "auto",
  marginRight: "auto",
  letterSpacing: "0.02em",
};

var terminalBodyStyle: React.CSSProperties = {
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minHeight: "96px",
};

var terminalLineStyle: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.6,
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre",
};

var terminalCursorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
  fontSize: "12px",
  fontFamily: "var(--font-mono)",
  marginTop: "2px",
};

var terminalCursorStyle: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "14px",
  background: "var(--accent-primary)",
  borderRadius: "1px",
  animation: "wizard-cursor-blink 1s step-end infinite",
  opacity: 0.9,
  verticalAlign: "middle",
};

var cardStyle: React.CSSProperties = {
  width: "480px",
  maxWidth: "calc(100vw - 24px)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-default)",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,106,247,0.08)",
  overflow: "hidden",
};

var cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 24px",
  borderBottom: "1px solid var(--border-subtle)",
  background: "var(--bg-primary)",
};

var stepDotsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

var dotStyle: React.CSSProperties = {
  height: "6px",
  borderRadius: "3px",
};

var stepCounterStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.06em",
};

var contentStyle: React.CSSProperties = {
  padding: "28px 28px 8px",
  flex: 1,
  minHeight: "320px",
};

var footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "16px 24px",
  borderTop: "1px solid var(--border-subtle)",
  background: "var(--bg-primary)",
};

var footerRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginLeft: "auto",
};

var primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: "40px",
  padding: "0 18px",
  background: "var(--accent-primary)",
  color: "#fff",
  borderRadius: "var(--radius-md)",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  border: "none",
  letterSpacing: "0.01em",
};

var doneButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  height: "44px",
  padding: "0 24px",
  background: "var(--accent-success)",
  color: "#051a0a",
  borderRadius: "var(--radius-md)",
  fontSize: "14px",
  fontWeight: 700,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  border: "none",
  letterSpacing: "0.01em",
};

var backButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  height: "40px",
  padding: "0 14px",
  background: "var(--bg-overlay)",
  color: "var(--text-muted)",
  borderRadius: "var(--radius-md)",
  fontSize: "13px",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  border: "1px solid var(--border-subtle)",
  transition: "color 120ms ease, background 120ms ease",
};

var skipButtonStyle: React.CSSProperties = {
  height: "40px",
  padding: "0 14px",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: "var(--radius-md)",
  fontSize: "13px",
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  border: "none",
  transition: "color 120ms ease",
};

var stepContentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

var stepIconRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "14px",
};

var stepHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "22px",
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.02em",
  marginBottom: "8px",
  lineHeight: 1.2,
};

var stepDescStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  lineHeight: 1.65,
  marginBottom: "20px",
  fontFamily: "var(--font-ui)",
};

var fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginBottom: "14px",
};

var labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily: "var(--font-ui)",
};

var inputStyle: React.CSSProperties = {
  height: "44px",
  padding: "0 14px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
  width: "100%",
  fontFamily: "var(--font-ui)",
  transition: "border-color 150ms ease",
};

var inputWrapperStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

var inputPromptStyle: React.CSSProperties = {
  position: "absolute",
  left: "14px",
  color: "var(--accent-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: "14px",
  pointerEvents: "none",
  userSelect: "none",
  zIndex: 1,
};

var monoInputStyle: React.CSSProperties = {
  height: "44px",
  padding: "0 14px 0 32px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: "13px",
  outline: "none",
  width: "100%",
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.01em",
  transition: "border-color 150ms ease",
};

var hintStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  lineHeight: 1.5,
  fontFamily: "var(--font-ui)",
};

var previewBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 14px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  marginTop: "4px",
};

var previewLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily: "var(--font-ui)",
  flexShrink: 0,
};

var previewValueStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  color: "var(--accent-primary)",
  fontWeight: 600,
  flex: 1,
};

var modeToggleRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  marginBottom: "16px",
};

var modeTabStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: "36px",
  padding: "0 16px",
  borderRadius: "var(--radius-md)",
  fontSize: "13px",
  fontWeight: 500,
  fontFamily: "var(--font-ui)",
  cursor: "pointer",
  border: "1px solid var(--border-subtle)",
  transition: "background 150ms ease, color 150ms ease",
};

var themeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "8px",
};

var themeCardStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
  overflow: "hidden",
  padding: "0",
  transition: "border-color 150ms ease, transform 150ms ease",
};

var themeCardPreviewStyle: React.CSSProperties = {
  height: "52px",
  borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
  overflow: "hidden",
};

var themeCardBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "4px 5px",
  gap: "3px",
};

var themeCardLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--text-muted)",
  padding: "4px 6px 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontFamily: "var(--font-ui)",
  display: "block",
};

var themeCardCheckStyle: React.CSSProperties = {
  position: "absolute",
  top: "5px",
  right: "5px",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  background: "var(--accent-primary)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

var infoBoxStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  padding: "12px 14px",
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  marginBottom: "20px",
};

var infoBoxTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted)",
  lineHeight: 1.6,
  fontFamily: "var(--font-ui)",
};

var strengthBarRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "2px",
};

var strengthBarTrackStyle: React.CSSProperties = {
  flex: 1,
  height: "3px",
  background: "var(--border-subtle)",
  borderRadius: "2px",
  overflow: "hidden",
};

var strengthBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "2px",
};

var strengthLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  fontFamily: "var(--font-ui)",
  minWidth: "44px",
  textAlign: "right",
};

var errorTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--accent-danger)",
  fontFamily: "var(--font-ui)",
  marginTop: "-6px",
};

var doneStepStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
};

var doneCheckCircleStyle: React.CSSProperties = {
  marginBottom: "16px",
};

var doneHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "22px",
  fontWeight: 700,
  color: "var(--text-primary)",
  letterSpacing: "-0.02em",
  marginBottom: "8px",
};

var summaryListStyle: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  marginTop: "8px",
  width: "100%",
};

var summaryItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  background: "var(--bg-tertiary)",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--border-subtle)",
};

var summaryCheckStyle: React.CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "var(--accent-success)",
  color: "#051a0a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
