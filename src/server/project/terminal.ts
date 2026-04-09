import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname_local = dirname(fileURLToPath(import.meta.url));

interface TerminalWorker {
  process: ChildProcess;
  send: (msg: object) => void;
}

const terminals = new Map<string, TerminalWorker>();

const WORKER_PATH = join(__dirname_local, "pty-worker.cjs");

const NODE_MODULES_PATH = (function () {
  try {
    const resolved = require.resolve("node-pty");
    const parts = resolved.split("/node_modules/");
    parts.pop();
    return parts.join("/node_modules/") + "/node_modules";
  } catch {
    return join(__dirname_local, "..", "..", "..", "node_modules");
  }
})();

export function createTerminal(
  cwd: string,
  onData: (data: string) => void,
  onExit: (code: number) => void,
): string {
  const termId = randomUUID();

  const child = spawn("node", [WORKER_PATH], {
    stdio: ["pipe", "pipe", "ignore"],
    cwd: cwd,
    env: { ...process.env, NODE_PATH: NODE_MODULES_PATH },
  });

  let buffer = "";

  child.stdout!.setEncoding("utf-8");
  child.stdout!.on("data", function (chunk: string) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try {
        const msg = JSON.parse(lines[i]);
        if (msg.type === "data") {
          onData(msg.data);
        } else if (msg.type === "exit") {
          terminals.delete(termId);
          onExit(msg.code ?? 0);
        }
      } catch {
        // ignore parse errors
      }
    }
  });

  child.on("exit", function () {
    if (terminals.has(termId)) {
      terminals.delete(termId);
      onExit(0);
    }
  });

  function sendMsg(msg: object) {
    if (child.stdin && !child.stdin.destroyed) {
      child.stdin.write(JSON.stringify(msg) + "\n");
    }
  }

  terminals.set(termId, { process: child, send: sendMsg });

  // Tell the worker to create the PTY
  sendMsg({ type: "create", cwd: cwd, cols: 80, rows: 24 });

  return termId;
}

export function writeToTerminal(termId: string, data: string): void {
  const worker = terminals.get(termId);
  if (worker) {
    worker.send({ type: "input", data: data });
  }
}

export function resizeTerminal(termId: string, cols: number, rows: number): void {
  const worker = terminals.get(termId);
  if (worker) {
    worker.send({ type: "resize", cols: cols, rows: rows });
  }
}

export function destroyTerminal(termId: string): void {
  const worker = terminals.get(termId);
  if (worker) {
    worker.send({ type: "kill" });
    terminals.delete(termId);
  }
}

export function getTerminal(termId: string): TerminalWorker | undefined {
  return terminals.get(termId);
}
