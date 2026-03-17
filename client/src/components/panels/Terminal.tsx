import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useWebSocket } from "../../hooks/useWebSocket";
import type { ServerMessage, TerminalCreatedMessage, TerminalOutputMessage } from "@lattice/shared";

export function Terminal() {
  var containerRef = useRef<HTMLDivElement | null>(null);
  var xtermRef = useRef<XTerm | null>(null);
  var fitAddonRef = useRef<FitAddon | null>(null);
  var termIdRef = useRef<string | null>(null);
  var { send, subscribe, unsubscribe } = useWebSocket();
  var [ready, setReady] = useState(false);

  useEffect(function() {
    if (!containerRef.current) {
      return;
    }

    var term = new XTerm({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: 13,
      theme: {
        background: "#0d0d0d",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
        black: "#1e1e1e",
        red: "#f44747",
        green: "#4ec9b0",
        yellow: "#dcdcaa",
        blue: "#569cd6",
        magenta: "#c586c0",
        cyan: "#9cdcfe",
        white: "#d4d4d4",
        brightBlack: "#808080",
        brightRed: "#f44747",
        brightGreen: "#4ec9b0",
        brightYellow: "#dcdcaa",
        brightBlue: "#569cd6",
        brightMagenta: "#c586c0",
        brightCyan: "#9cdcfe",
        brightWhite: "#ffffff",
      },
    });

    var fitAddon = new FitAddon();
    var webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    send({ type: "terminal:create" });

    function onCreated(msg: ServerMessage) {
      var created = msg as TerminalCreatedMessage;
      termIdRef.current = created.termId;
      setReady(true);
    }

    function onOutput(msg: ServerMessage) {
      var output = msg as TerminalOutputMessage;
      if (xtermRef.current && output.termId === termIdRef.current) {
        xtermRef.current.write(output.data);
      }
    }

    subscribe("terminal:created", onCreated);
    subscribe("terminal:output", onOutput);

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
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "200px",
        overflow: "hidden",
        backgroundColor: "#0d0d0d",
      }}
    />
  );
}
