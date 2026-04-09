import { useMemo } from "react";

interface ThemePreviewProps {
  colors: Record<string, string>;
  variant: "dark" | "light";
  compact?: boolean;
}

function hexToStyle(hex: string): string {
  return "#" + hex.replace(/^#/, "");
}

export function ThemePreview(props: ThemePreviewProps) {
  const c = props.colors;
  const style = useMemo(function () {
    return {
      "--preview-bg": hexToStyle(c.base00 || "1f1f28"),
      "--preview-surface": hexToStyle(c.base01 || "2a2a37"),
      "--preview-selection": hexToStyle(c.base02 || "363646"),
      "--preview-comment": hexToStyle(c.base03 || "54546d"),
      "--preview-dark-fg": hexToStyle(c.base04 || "727169"),
      "--preview-fg": hexToStyle(c.base05 || "dcd7ba"),
      "--preview-light-fg": hexToStyle(c.base06 || "c8c093"),
      "--preview-bright-fg": hexToStyle(c.base07 || "ffffff"),
      "--preview-red": hexToStyle(c.base08 || "c34043"),
      "--preview-orange": hexToStyle(c.base09 || "ffa066"),
      "--preview-yellow": hexToStyle(c.base0A || "c0a36e"),
      "--preview-green": hexToStyle(c.base0B || "76946a"),
      "--preview-cyan": hexToStyle(c.base0C || "6a9589"),
      "--preview-blue": hexToStyle(c.base0D || "7e9cd8"),
      "--preview-purple": hexToStyle(c.base0E || "957fb8"),
      "--preview-brown": hexToStyle(c.base0F || "d27e99"),
    } as React.CSSProperties;
  }, [c]);

  if (props.compact) {
    return (
      <div
        className="rounded-lg overflow-hidden border border-base-content/10"
        style={{ ...style, background: "var(--preview-bg)", color: "var(--preview-fg)" }}
      >
        <div className="flex h-[80px]">
          <div className="w-10 shrink-0 p-1.5 flex flex-col gap-1" style={{ background: "var(--preview-surface)" }}>
            <div className="w-full h-1.5 rounded-full" style={{ background: "var(--preview-blue)", opacity: 0.6 }} />
            <div className="w-full h-1.5 rounded-full" style={{ background: "var(--preview-comment)" }} />
            <div className="w-full h-1.5 rounded-full" style={{ background: "var(--preview-comment)" }} />
          </div>
          <div className="flex-1 p-2 flex flex-col gap-1.5">
            <div className="flex justify-end">
              <div className="rounded-lg px-2 py-1 text-[8px] max-w-[70%]" style={{ background: "var(--preview-blue)", color: "var(--preview-bright-fg)" }}>
                Hello world
              </div>
            </div>
            <div className="flex">
              <div className="rounded-lg px-2 py-1 text-[8px] max-w-[70%]" style={{ background: "var(--preview-selection)", color: "var(--preview-fg)" }}>
                Response text
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden border border-base-content/10 shadow-lg"
      style={{ ...style, background: "var(--preview-bg)", color: "var(--preview-fg)" }}
    >
      <div className="flex h-[280px]">
        <div className="w-[120px] shrink-0 p-3 flex flex-col gap-2 border-r" style={{ background: "var(--preview-surface)", borderColor: "var(--preview-selection)" }}>
          <div className="text-[10px] font-bold mb-1" style={{ color: "var(--preview-light-fg)" }}>Projects</div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "var(--preview-blue)", opacity: 0.3 }} />
            <div className="text-[9px]" style={{ color: "var(--preview-fg)" }}>lattice</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: "var(--preview-green)", opacity: 0.3 }} />
            <div className="text-[9px]" style={{ color: "var(--preview-dark-fg)" }}>my-app</div>
          </div>
          <div className="mt-auto">
            <div className="text-[8px] mb-1" style={{ color: "var(--preview-comment)" }}>Sessions</div>
            <div className="text-[8px] truncate" style={{ color: "var(--preview-dark-fg)" }}>Fix auth bug</div>
            <div className="text-[8px] truncate" style={{ color: "var(--preview-comment)" }}>Add dark mode</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
            <div className="flex justify-end">
              <div className="rounded-xl px-3 py-1.5 text-[10px] max-w-[75%]" style={{ background: "var(--preview-blue)", color: "var(--preview-bright-fg)" }}>
                Can you fix the login page?
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-4 h-4 rounded-full shrink-0 mt-0.5" style={{ background: "var(--preview-blue)", opacity: 0.2 }} />
              <div className="rounded-xl px-3 py-1.5 text-[10px] max-w-[75%] border" style={{ background: "var(--preview-selection)", borderColor: "var(--preview-comment)", opacity: 0.3 }}>
                <span style={{ color: "var(--preview-fg)" }}>I'll update the </span>
                <code className="px-1 rounded text-[9px]" style={{ background: "var(--preview-bg)", color: "var(--preview-orange)" }}>LoginForm</code>
                <span style={{ color: "var(--preview-fg)" }}> component.</span>
              </div>
            </div>

            <div className="rounded-lg p-2 text-[9px] font-mono border" style={{ background: "var(--preview-bg)", borderColor: "var(--preview-selection)" }}>
              <div><span style={{ color: "var(--preview-purple)" }}>function</span> <span style={{ color: "var(--preview-blue)" }}>login</span><span style={{ color: "var(--preview-dark-fg)" }}>(</span><span style={{ color: "var(--preview-orange)" }}>user</span><span style={{ color: "var(--preview-dark-fg)" }}>)</span> {"{"}</div>
              <div className="ml-3"><span style={{ color: "var(--preview-purple)" }}>var</span> <span style={{ color: "var(--preview-red)" }}>token</span> = <span style={{ color: "var(--preview-blue)" }}>auth</span>(<span style={{ color: "var(--preview-green)" }}>"secret"</span>);</div>
              <div className="ml-3"><span style={{ color: "var(--preview-purple)" }}>return</span> {"{"} <span style={{ color: "var(--preview-yellow)" }}>ok</span>: <span style={{ color: "var(--preview-orange)" }}>true</span> {"}"};</div>
              <div>{"}"}</div>
            </div>
          </div>

          <div className="px-3 py-2 border-t" style={{ borderColor: "var(--preview-selection)" }}>
            <div className="rounded-lg px-3 py-1.5 text-[9px]" style={{ background: "var(--preview-surface)", color: "var(--preview-comment)" }}>
              Type a message...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemeSwatches(props: { colors: Record<string, string> }) {
  const keys = ["base00", "base01", "base02", "base03", "base04", "base05", "base06", "base07", "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"];
  return (
    <div className="flex gap-0.5 rounded overflow-hidden">
      {keys.map(function (key) {
        return (
          <div
            key={key}
            className="h-4 flex-1"
            style={{ background: "#" + (props.colors[key] || "000000").replace(/^#/, "") }}
            title={key + ": #" + (props.colors[key] || "000000")}
          />
        );
      })}
    </div>
  );
}
