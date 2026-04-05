import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { getLatticeHome } from "./config";

export interface CertPaths {
  cert: string;
  key: string;
}

export function getCertsDir(): string {
  var certsDir = join(getLatticeHome(), "certs");
  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
  }
  return certsDir;
}

function isCertExpiringSoon(certPath: string): boolean {
  try {
    var result = spawnSync("openssl", ["x509", "-enddate", "-noout", "-in", certPath], { encoding: "utf-8" });
    if (result.status !== 0) return true;
    var match = result.stdout.match(/notAfter=(.+)/);
    if (!match) return true;
    var expiryDate = new Date(match[1]);
    var daysLeft = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft < 30;
  } catch {
    return true;
  }
}

export function ensureCerts(): CertPaths {
  var certsDir = getCertsDir();
  var certPath = join(certsDir, "cert.pem");
  var keyPath = join(certsDir, "key.pem");

  if (existsSync(certPath) && existsSync(keyPath) && !isCertExpiringSoon(certPath)) {
    return { cert: certPath, key: keyPath };
  }

  console.log("[lattice] Generating self-signed TLS certificate...");

  var result = spawnSync(
    "openssl",
    [
      "req", "-x509",
      "-newkey", "rsa:2048",
      "-keyout", keyPath,
      "-out", certPath,
      "-days", "365",
      "-nodes",
      "-subj", "/CN=lattice",
    ],
    { encoding: "utf-8" }
  );

  if (result.status !== 0) {
    throw new Error("[lattice] Failed to generate TLS certificates: " + (result.stderr || result.error?.message || "unknown error"));
  }

  console.log("[lattice] TLS certificates generated at " + certsDir);

  return { cert: certPath, key: keyPath };
}
