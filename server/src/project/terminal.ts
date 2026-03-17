import { randomUUID } from "node:crypto";
import type { IPty } from "node-pty";

var terminals = new Map<string, IPty>();
var pty: typeof import("node-pty") | null = null;

function getPty(): typeof import("node-pty") {
  if (!pty) {
    pty = require("node-pty") as typeof import("node-pty");
  }
  return pty;
}

export function createTerminal(
  cwd: string,
  onData: (data: string) => void,
  onExit: (code: number) => void,
): string {
  var termId = randomUUID();
  var shell = process.env.SHELL || "bash";
  var lib = getPty();

  var term = lib.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: cwd,
    env: process.env as Record<string, string>,
  });

  term.onData(onData);
  term.onExit(function(e) {
    terminals.delete(termId);
    onExit(e.exitCode ?? 0);
  });

  terminals.set(termId, term);
  return termId;
}

export function writeToTerminal(termId: string, data: string): void {
  var term = terminals.get(termId);
  if (term) {
    term.write(data);
  }
}

export function resizeTerminal(termId: string, cols: number, rows: number): void {
  var term = terminals.get(termId);
  if (term) {
    term.resize(cols, rows);
  }
}

export function destroyTerminal(termId: string): void {
  var term = terminals.get(termId);
  if (term) {
    try {
      term.kill();
    } catch {
      // already dead
    }
    terminals.delete(termId);
  }
}

export function getTerminal(termId: string): IPty | undefined {
  return terminals.get(termId);
}
