import createDebug from "debug";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";

let fileStream: ReturnType<typeof createWriteStream> | null = null;

export function initFileLogger(latticeHome: string): void {
  const logsDir = join(latticeHome, "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const logPath = join(logsDir, "debug.log");
  fileStream = createWriteStream(logPath, { flags: "a" });
  fileStream.on("error", function () {
    fileStream = null;
  });
}

function writeToFile(namespace: string, fmt: string, ...args: unknown[]): void {
  if (!fileStream) return;
  const timestamp = new Date().toISOString();
  const message = format(fmt, ...args);
  fileStream.write(timestamp + " " + namespace + " " + message + "\n");
}

type LogFn = (fmt: string, ...args: unknown[]) => void;

function createLogger(namespace: string): LogFn {
  const debugInstance = createDebug(namespace);

  return function (fmt: string, ...args: unknown[]) {
    writeToFile(namespace, fmt, ...args);
    debugInstance(fmt, ...args);
  };
}

export const log = {
  server: createLogger("lattice:server"),
  ws: createLogger("lattice:ws"),
  chat: createLogger("lattice:chat"),
  session: createLogger("lattice:session"),
  mesh: createLogger("lattice:mesh"),
  meshConnect: createLogger("lattice:mesh:connect"),
  meshHello: createLogger("lattice:mesh:hello"),
  meshProxy: createLogger("lattice:mesh:proxy"),
  router: createLogger("lattice:router"),
  broadcast: createLogger("lattice:broadcast"),
  auth: createLogger("lattice:auth"),
  fs: createLogger("lattice:fs"),
  analytics: createLogger("lattice:analytics"),
  plugins: createLogger("lattice:plugins"),
  update: createLogger("lattice:update"),
  terminal: createLogger("lattice:terminal"),
  settings: createLogger("lattice:settings"),
  superpowers: createLogger("lattice:superpowers"),
};
