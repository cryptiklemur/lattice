import { useState, useEffect } from "react";
import { ArrowRight, ChevronRight, ChevronLeft, Server, Palette, Lock, Folder, Info, Moon, Sun, Check, CheckCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useWebSocket } from "../../hooks/useWebSocket";
import { themes } from "../../themes/index";
import type { ThemeEntry } from "../../themes/index";
import { LatticeLogomark } from "../ui/LatticeLogomark";

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
    ws.send({ type: "settings:update", settings: { setupComplete: true } });
    localStorage.setItem("lattice-setup-complete", "1");
    props.onComplete();
  }

  var darkQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_DARK_THEMES.includes(e.id); });
  var lightQuickPicks = themes.filter(function (e: ThemeEntry) { return POPULAR_LIGHT_THEMES.includes(e.id); });
  var isForward = step > prevStep;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-base-100 transition-colors duration-300">
      <style>{wizardCSS}</style>

      {step === 1 ? (
        <div className="relative w-full max-w-[520px] px-6 py-12 flex flex-col items-center text-center">
          <div
            className="fixed inset-0 pointer-events-none z-0"
            aria-hidden="true"
            style={{
              backgroundImage: "linear-gradient(oklch(from var(--color-primary) l c h / 0.07) 1px, transparent 1px), linear-gradient(90deg, oklch(from var(--color-primary) l c h / 0.07) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              animation: "wizard-grid-shift 8s linear infinite",
            }}
          />
          <div className="relative z-[1] flex flex-col items-center gap-0">
            <div className="wizard-fade-in text-primary" style={{ animationDelay: "0ms" }}>
              <LatticeLogomark size={64} />
            </div>
            <h1
              className="wizard-fade-in font-mono font-bold text-base-content leading-none mt-5 mb-0"
              style={{ fontSize: "clamp(48px, 10vw, 72px)", letterSpacing: "-0.04em", animationDelay: "80ms" }}
            >
              Lattice
            </h1>
            <p className="wizard-fade-in text-[17px] text-base-content/60 mt-3 mb-8 tracking-[0.01em]" style={{ animationDelay: "160ms" }}>
              One dashboard. Every machine.
            </p>
            <div className="wizard-fade-in" style={{ animationDelay: "240ms" }}>
              <TerminalPreview />
            </div>
            <div className="wizard-fade-in" style={{ animationDelay: "320ms" }}>
              <button
                onClick={goNext}
                className="wizard-btn-primary btn btn-primary inline-flex items-center gap-2 mt-7 h-[52px] px-8 text-[15px] font-semibold cursor-pointer"
              >
                Get Started
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="wizard-fade-in text-[12px] text-base-content/30 mt-4" style={{ animationDelay: "380ms" }}>
              Takes about 2 minutes
            </p>
          </div>
        </div>
      ) : (
        <div className="w-[480px] max-w-[calc(100vw-24px)] bg-base-200 border border-base-300 rounded-xl flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS - 1 }, function (_, i) {
                var dotStep = i + 2;
                var isComplete = step > dotStep;
                var isActive = step === dotStep;
                return (
                  <div
                    key={i}
                    className="h-1.5 rounded-full transition-all duration-[250ms]"
                    style={{
                      background: (isComplete || isActive) ? "var(--color-primary)" : "var(--color-base-300)",
                      opacity: isActive ? 1 : isComplete ? 0.7 : 0.35,
                      width: isActive ? "24px" : "8px",
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-base-content/40 font-mono tracking-[0.06em]">
              {step - 1} / {TOTAL_STEPS - 1}
            </span>
          </div>

          <div
            className={"px-7 pt-7 pb-2 flex-1 min-h-[320px] " + (animating ? (isForward ? "wizard-slide-out-left" : "wizard-slide-out-right") : (isForward ? "wizard-slide-in-right" : "wizard-slide-in-left"))}
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

          <div className="flex items-center gap-2 px-6 py-4 border-t border-base-300 bg-base-100">
            {step >= 2 && step < TOTAL_STEPS && (
              <button onClick={goBack} className="wizard-btn-back btn btn-ghost btn-sm gap-1 text-base-content/40">
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {step === 2 && (
                <button onClick={skipToNext} className="wizard-btn-skip btn btn-ghost btn-sm text-base-content/40">Skip</button>
              )}
              {step === 3 && (
                <button onClick={handleAppearanceNext} className="wizard-btn-primary btn btn-primary btn-sm gap-1">
                  Continue
                  <ChevronRight size={14} />
                </button>
              )}
              {step === 4 && (
                <>
                  <button onClick={skipToNext} className="wizard-btn-skip btn btn-ghost btn-sm text-base-content/40">Skip</button>
                  <button onClick={handleSecurityNext} className="wizard-btn-primary btn btn-primary btn-sm gap-1">
                    Continue
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              {step === 5 && (
                <>
                  <button onClick={skipToNext} className="wizard-btn-skip btn btn-ghost btn-sm text-base-content/40">Skip</button>
                  <button onClick={handleProjectNext} className="wizard-btn-primary btn btn-primary btn-sm gap-1">
                    Add &amp; Continue
                    <ChevronRight size={14} />
                  </button>
                </>
              )}
              {step === 6 && (
                <button onClick={handleDone} className="wizard-btn-done btn btn-success btn-sm gap-2 font-bold">
                  Open Dashboard
                  <ArrowRight size={16} />
                </button>
              )}
              {step === 2 && (
                <button onClick={handleNameNext} className="wizard-btn-primary btn btn-primary btn-sm gap-1">
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

function TerminalPreview() {
  var [visible, setVisible] = useState(0);
  var lines = [
    { prefix: "$ ", text: "lattice", color: "var(--color-base-content)" },
    { prefix: "", text: "  [lattice] Daemon started (PID 4821)", color: "oklch(from var(--color-base-content) l c h / 0.5)" },
    { prefix: "", text: "  [lattice] Listening on https://0.0.0.0:7654", color: "var(--color-success)" },
    { prefix: "", text: "  [discovery] Found 2 nodes on mesh", color: "var(--color-primary)" },
  ];

  useEffect(function () {
    var timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach(function (_, i) {
      timers.push(setTimeout(function () { setVisible(i + 1); }, 600 + i * 600));
    });
    return function () { timers.forEach(clearTimeout); };
  }, []);

  return (
    <div className="w-[380px] max-w-[calc(100vw-48px)] bg-base-200 border border-base-300 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-base-300 border-b border-base-300">
        <span className="w-2.5 h-2.5 rounded-full bg-error opacity-80 flex-shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-warning opacity-80 flex-shrink-0" />
        <span className="w-2.5 h-2.5 rounded-full bg-success opacity-80 flex-shrink-0" />
        <span className="text-[11px] text-base-content/40 font-mono mx-auto tracking-[0.02em]">lattice — zsh</span>
      </div>
      <div className="px-4 py-3.5 flex flex-col gap-1 min-h-[96px]">
        {lines.map(function (line, i) {
          return (
            <div
              key={i}
              className="text-[12px] font-mono leading-relaxed whitespace-pre transition-all duration-200"
              style={{
                opacity: i < visible ? 1 : 0,
                transform: i < visible ? "translateY(0)" : "translateY(4px)",
                color: line.color,
              }}
            >
              {line.prefix && <span style={{ color: "var(--color-primary)" }}>{line.prefix}</span>}
              <span>{line.text}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-0.5 text-[12px] font-mono mt-0.5">
          <span style={{ color: "var(--color-primary)" }}>$ </span>
          <span
            className="inline-block w-2 h-3.5 rounded-[1px] align-middle opacity-90"
            style={{ background: "var(--color-primary)", animation: "wizard-cursor-blink 1s step-end infinite" }}
          />
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
    <div className="flex flex-col">
      <div className="flex items-center mb-3.5">
        <Server size={22} className="text-primary" />
      </div>
      <h2 className="font-mono text-[22px] font-bold text-base-content tracking-tight mb-2 leading-tight">
        Name this machine
      </h2>
      <p className="text-[13px] text-base-content/60 leading-relaxed mb-5">
        Give this node a recognizable name. It appears in your mesh when you connect multiple computers.
      </p>
      <fieldset className="fieldset mb-3.5">
        <legend className="fieldset-legend text-[11px] font-semibold text-base-content/40 uppercase tracking-[0.08em]">
          Machine name
        </legend>
        <div className="flex items-center gap-2 bg-base-300 border border-base-content/20 rounded-md px-3 h-[44px] focus-within:border-primary transition-colors duration-[120ms]">
          <span className="text-primary font-mono font-bold text-[16px]">&gt;</span>
          <input
            type="text"
            value={props.value}
            onChange={function (e) { props.onChange(e.target.value); }}
            placeholder="my-laptop"
            className="flex-1 bg-transparent text-base-content font-mono text-[14px] outline-none"
            autoFocus
            spellCheck={false}
          />
        </div>
      </fieldset>
      <div className="flex items-center gap-2 px-3 py-2 bg-base-300 border border-base-content/10 rounded-md">
        <span className="text-[10px] uppercase tracking-[0.08em] text-base-content/40 font-semibold">Preview</span>
        <span className="font-mono text-[13px] font-semibold text-base-content">{displayName}</span>
        <span className="text-base-content/30 text-[12px]">will appear on your mesh</span>
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
    <div className="flex flex-col">
      <div className="flex items-center mb-3.5">
        <Palette size={22} className="text-primary" />
      </div>
      <h2 className="font-mono text-[22px] font-bold text-base-content tracking-tight mb-2 leading-tight">
        Choose appearance
      </h2>
      <p className="text-[13px] text-base-content/60 leading-relaxed mb-4">
        Pick a color theme. You can always change this in settings.
      </p>

      <div className="flex gap-1.5 mb-4 p-1 bg-base-300 rounded-lg w-fit">
        <button
          onClick={function () { if (theme.mode !== "dark") { theme.toggleMode(); } }}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-[120ms] cursor-pointer " +
            (theme.mode === "dark" ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content")
          }
        >
          <Moon size={13} />
          Dark
        </button>
        <button
          onClick={function () { if (theme.mode !== "light") { theme.toggleMode(); } }}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-[120ms] cursor-pointer " +
            (theme.mode === "light" ? "bg-primary text-primary-content" : "text-base-content/60 hover:text-base-content")
          }
        >
          <Sun size={13} />
          Light
        </button>
      </div>

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))" }}>
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
              title={entry.theme.name}
              className={
                "relative flex flex-col gap-1.5 p-0 rounded-md overflow-hidden cursor-pointer border-2 transition-all duration-[120ms] " +
                (isActive ? "border-primary" : "border-transparent hover:border-base-content/20")
              }
            >
              <div className="w-full h-[48px] flex flex-col" style={{ background: bg }}>
                <div className="flex items-center gap-1 px-1.5 py-1" style={{ background: "#" + entry.theme.base01 }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: red }} />
                  <span className="w-6 h-1 rounded" style={{ background: accent, opacity: 0.7 }} />
                </div>
                <div className="flex flex-col gap-[3px] px-1.5 py-1">
                  <div className="h-[3px] rounded w-[80%]" style={{ background: accent, opacity: 0.8 }} />
                  <div className="h-[3px] rounded w-[60%]" style={{ background: text, opacity: 0.4 }} />
                  <div className="h-[3px] rounded w-[70%]" style={{ background: green, opacity: 0.6 }} />
                </div>
              </div>
              <span className="text-[10px] text-base-content/60 truncate px-1.5 pb-1">{entry.theme.name}</span>
              {isActive && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                  <Check size={8} className="text-primary-content" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-base-300 overflow-hidden transition-all duration-300">
        <div className="text-[9px] font-mono tracking-[0.05em] uppercase text-base-content/40 px-2.5 py-1.5 bg-base-300 border-b border-base-300 transition-all duration-300">
          Preview
        </div>
        <div className="flex h-[100px] bg-base-100 transition-all duration-300">
          <div className="w-[72px] flex-shrink-0 border-r border-base-300 p-2 flex flex-col gap-1">
            <div className="text-[8px] font-mono text-base-content/30 uppercase tracking-[0.05em] mb-0.5">Projects</div>
            <div className="h-1.5 w-[90%] rounded bg-primary opacity-80" />
            <div className="h-1.5 w-[70%] rounded bg-base-300" />
            <div className="h-1.5 w-[80%] rounded bg-base-300" />
          </div>
          <div className="flex-1 p-2.5 flex flex-col gap-1.5">
            <div className="text-[9px] font-mono font-semibold text-base-content">New Session</div>
            <div className="flex-1 flex flex-col gap-[3px] justify-center">
              <div className="flex gap-1 items-start">
                <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 opacity-60" />
                <div className="flex flex-col gap-0.5">
                  <div className="h-1 w-[120px] rounded bg-base-content/20" />
                  <div className="h-1 w-[80px] rounded bg-base-content/15" />
                </div>
              </div>
            </div>
            <div className="h-[18px] rounded bg-base-200 border border-base-300" />
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
    <div className="flex flex-col">
      <div className="flex items-center mb-3.5">
        <Lock size={22} className="text-primary" />
      </div>
      <h2 className="font-mono text-[22px] font-bold text-base-content tracking-tight mb-2 leading-tight">
        Set a passphrase
      </h2>

      <div className="flex gap-2 p-3 bg-base-300 border border-base-300 rounded-md mb-4">
        <Info size={16} className="text-base-content/40 flex-shrink-0 mt-[1px]" />
        <p className="text-[12px] text-base-content/50 leading-relaxed">
          Optional. Protects your dashboard on shared networks. Node-to-node connections use separate key-based auth.
        </p>
      </div>

      <fieldset className="fieldset mb-3.5">
        <legend className="fieldset-legend text-[11px] font-semibold text-base-content/40 uppercase tracking-[0.08em]">
          Passphrase
        </legend>
        <input
          type="password"
          value={props.passphrase}
          onChange={function (e) { props.onPassphraseChange(e.target.value); }}
          placeholder="Leave blank to skip"
          className="input input-bordered w-full bg-base-300 text-base-content text-[14px] focus:border-primary"
          autoFocus
        />
        {props.passphrase.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-base-300 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: strength.pct + "%", background: strength.color }}
              />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
          </div>
        )}
      </fieldset>

      {props.passphrase.length > 0 && (
        <fieldset className="fieldset mb-3.5">
          <legend className="fieldset-legend text-[11px] font-semibold text-base-content/40 uppercase tracking-[0.08em]">
            Confirm passphrase
          </legend>
          <input
            type="password"
            value={props.passphraseConfirm}
            onChange={function (e) { props.onConfirmChange(e.target.value); }}
            placeholder="Repeat passphrase"
            className={
              "input input-bordered w-full bg-base-300 text-base-content text-[14px] focus:border-primary " +
              (props.error ? "border-error" : "")
            }
          />
        </fieldset>
      )}

      {props.error && (
        <p className="text-[12px] text-error mt-1">{props.error}</p>
      )}
    </div>
  );
}

function getPassphraseStrength(p: string) {
  if (p.length === 0) return { pct: 0, label: "", color: "oklch(from var(--color-base-content) l c h / 0.5)" };
  if (p.length < 8) return { pct: 25, label: "Weak", color: "var(--color-error)" };
  if (p.length < 14) return { pct: 55, label: "Fair", color: "var(--color-warning)" };
  if (p.length < 20) return { pct: 80, label: "Good", color: "var(--color-primary)" };
  return { pct: 100, label: "Strong", color: "var(--color-success)" };
}

interface ProjectStepProps {
  path: string;
  title: string;
  onPathChange: (v: string) => void;
  onTitleChange: (v: string) => void;
}

function ProjectStep(props: ProjectStepProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-3.5">
        <Folder size={22} className="text-primary" />
      </div>
      <h2 className="font-mono text-[22px] font-bold text-base-content tracking-tight mb-2 leading-tight">
        Add your first project
      </h2>
      <p className="text-[13px] text-base-content/60 leading-relaxed mb-5">
        Point Lattice at a local directory. Claude runs inside that workspace. Add more projects from the sidebar anytime.
      </p>
      <fieldset className="fieldset mb-3.5">
        <legend className="fieldset-legend text-[11px] font-semibold text-base-content/40 uppercase tracking-[0.08em]">
          Project path
        </legend>
        <input
          type="text"
          value={props.path}
          onChange={function (e) { props.onPathChange(e.target.value); }}
          placeholder="/home/you/projects/my-app"
          className="input input-bordered w-full bg-base-300 text-base-content font-mono text-[14px] focus:border-primary"
          autoFocus
          spellCheck={false}
        />
        <p className="fieldset-label text-[11px] text-base-content/30 mt-1">
          Absolute path to a local directory on this machine.
        </p>
      </fieldset>
      <fieldset className="fieldset mb-3.5">
        <legend className="fieldset-legend text-[11px] font-semibold text-base-content/40 uppercase tracking-[0.08em]">
          Display name <span className="font-normal normal-case tracking-normal">(optional)</span>
        </legend>
        <input
          type="text"
          value={props.title}
          onChange={function (e) { props.onTitleChange(e.target.value); }}
          placeholder={props.path ? (props.path.replace(/\/+$/, "").split("/").pop() || "My App") : "My App"}
          className="input input-bordered w-full bg-base-300 text-base-content text-[14px] focus:border-primary"
        />
      </fieldset>
    </div>
  );
}

interface DoneStepProps {
  configured: string[];
}

function DoneStep(props: DoneStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="wizard-check-pop mb-4">
        <CheckCircle size={36} className="text-success" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 className="font-mono text-[26px] font-bold text-base-content tracking-tight mb-2">
        You're all set
      </h2>
      <p className="text-[13px] text-base-content/60 leading-relaxed mb-5">
        Lattice is configured and ready to go.
      </p>

      {props.configured.length > 0 ? (
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5 text-left w-full">
          {props.configured.map(function (item: string, i: number) {
            return (
              <li key={i} className="wizard-fade-in flex items-center gap-2 bg-base-300 px-3 py-2 rounded-md" data-delay={i * 60}>
                <span className="w-4 h-4 rounded-full bg-success/20 text-success flex items-center justify-center flex-shrink-0">
                  <Check size={10} />
                </span>
                <span className="font-mono text-[12px] text-base-content/60">{item}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[11px] text-base-content/30">
          Everything was skipped — configure it from settings anytime.
        </p>
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
  @keyframes wizard-slide-out-left {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(-24px); }
  }
  @keyframes wizard-slide-out-right {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(24px); }
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
  .wizard-slide-out-left {
    animation: wizard-slide-out-left 180ms ease both;
  }
  .wizard-slide-out-right {
    animation: wizard-slide-out-right 180ms ease both;
  }
  .wizard-check-pop {
    animation: wizard-check-pop 500ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }
  .wizard-btn-primary {
    transition: background 150ms ease, transform 100ms ease, box-shadow 150ms ease !important;
  }
  .wizard-btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px oklch(from var(--color-primary) l c h / 0.35);
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
    box-shadow: 0 4px 20px oklch(from var(--color-success) l c h / 0.4);
  }
  .wizard-btn-done:active {
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .wizard-fade-in,
    .wizard-slide-in-right,
    .wizard-slide-in-left,
    .wizard-slide-out-left,
    .wizard-slide-out-right,
    .wizard-check-pop {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .wizard-btn-primary:hover,
    .wizard-btn-done:hover {
      transform: none !important;
    }
  }
`;
