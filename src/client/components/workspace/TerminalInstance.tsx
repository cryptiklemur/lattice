import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSidebar } from "../../hooks/useSidebar";
import type { ServerMessage, TerminalCreatedMessage, TerminalOutputMessage, TerminalExitedMessage } from "#shared";

function getXtermTheme(): Record<string, string> {
  var root = document.documentElement;
  var cs = getComputedStyle(root);

  function resolveVar(prop: string, fallback: string): string {
    var val = cs.getPropertyValue(prop).trim();
    return val || fallback;
  }

  return {
    background: resolveVar("--base00", "#0d0d0d"),
    foreground: resolveVar("--base05", "#d4d4d4"),
    cursor: resolveVar("--base05", "#d4d4d4"),
    selectionBackground: resolveVar("--base02", "#264f78"),
    black: resolveVar("--base00", "#1e1e1e"),
    red: resolveVar("--base08", "#f44747"),
    green: resolveVar("--base0B", "#4ec9b0"),
    yellow: resolveVar("--base0A", "#dcdcaa"),
    blue: resolveVar("--base0D", "#569cd6"),
    magenta: resolveVar("--base0E", "#c586c0"),
    cyan: resolveVar("--base0C", "#9cdcfe"),
    white: resolveVar("--base05", "#d4d4d4"),
    brightBlack: resolveVar("--base03", "#808080"),
    brightRed: resolveVar("--base08", "#f44747"),
    brightGreen: resolveVar("--base0B", "#4ec9b0"),
    brightYellow: resolveVar("--base0A", "#dcdcaa"),
    brightBlue: resolveVar("--base0D", "#569cd6"),
    brightMagenta: resolveVar("--base0E", "#c586c0"),
    brightCyan: resolveVar("--base0C", "#9cdcfe"),
    brightWhite: resolveVar("--base07", "#ffffff"),
  };
}

interface TerminalInstanceProps {
  instanceId: string;
  visible: boolean;
}

export function TerminalInstance({ instanceId, visible }: TerminalInstanceProps) {
  var containerRef = useRef<HTMLDivElement | null>(null);
  var xtermRef = useRef<XTerm | null>(null);
  var fitAddonRef = useRef<FitAddon | null>(null);
  var searchAddonRef = useRef<SearchAddon | null>(null);
  var termIdRef = useRef<string | null>(null);
  var { activeProjectSlug } = useSidebar();
  var { send, subscribe, unsubscribe } = useWebSocket();

  useEffect(function() {
    if (!containerRef.current) {
      return;
    }

    var term = new XTerm({
      cursorBlink: true,
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "JetBrains Mono, monospace",
      fontSize: 13,
      theme: getXtermTheme(),
    });

    var fitAddon = new FitAddon();
    var webLinksAddon = new WebLinksAddon();
    var searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    var waitingForCreate = true;

    function onCreated(msg: ServerMessage) {
      if (!waitingForCreate) return;
      waitingForCreate = false;
      var created = msg as TerminalCreatedMessage;
      termIdRef.current = created.termId;
    }

    function onOutput(msg: ServerMessage) {
      var output = msg as TerminalOutputMessage;
      if (xtermRef.current && output.termId === termIdRef.current) {
        xtermRef.current.write(output.data);
      }
    }

    function onExited(msg: ServerMessage) {
      var exited = msg as TerminalExitedMessage;
      if (xtermRef.current && exited.termId === termIdRef.current) {
        xtermRef.current.write("\r\n\x1b[31m[process exited]\x1b[0m\r\n");
      }
    }

    subscribe("terminal:created", onCreated);
    subscribe("terminal:output", onOutput);
    subscribe("terminal:exited", onExited);

    send({ type: "terminal:create", projectSlug: activeProjectSlug || undefined });

    term.onData(function(data: string) {
      var termId = termIdRef.current;
      if (termId) {
        send({ type: "terminal:input", termId: termId, data: data });
      }
    });

    var resizeObserver = new ResizeObserver(function() {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        var termId = termIdRef.current;
        var dim = fitAddonRef.current.proposeDimensions();
        if (termId && dim) {
          send({ type: "terminal:resize", termId: termId, cols: dim.cols, rows: dim.rows });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return function() {
      unsubscribe("terminal:created", onCreated);
      unsubscribe("terminal:output", onOutput);
      unsubscribe("terminal:exited", onExited);
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, []);

  useEffect(function() {
    if (visible && fitAddonRef.current) {
      var timer = setTimeout(function() {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          var termId = termIdRef.current;
          var dim = fitAddonRef.current.proposeDimensions();
          if (termId && dim) {
            send({ type: "terminal:resize", termId: termId, cols: dim.cols, rows: dim.rows });
          }
        }
      }, 50);
      return function() { clearTimeout(timer); };
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-base-100"
      style={{ display: visible ? "block" : "none" }}
      data-instance-id={instanceId}
    />
  );
}
