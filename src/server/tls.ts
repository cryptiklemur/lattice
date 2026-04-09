import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import { getLatticeHome } from "./config";

export interface CertPaths {
  cert: string;
  key: string;
}

export function getCertsDir(): string {
  const certsDir = join(getLatticeHome(), "certs");
  if (!existsSync(certsDir)) {
    mkdirSync(certsDir, { recursive: true });
  }
  return certsDir;
}

function isCertExpiringSoon(certPath: string): boolean {
  try {
    const result = spawnSync("openssl", ["x509", "-enddate", "-noout", "-in", certPath], { encoding: "utf-8" });
    if (result.status !== 0) return true;
    const match = result.stdout.match(/notAfter=(.+)/);
    if (!match) return true;
    const expiryDate = new Date(match[1]);
    const daysLeft = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft < 30;
  } catch {
    return true;
  }
}

export function ensureCerts(): CertPaths {
  const certsDir = getCertsDir();
  const certPath = join(certsDir, "cert.pem");
  const keyPath = join(certsDir, "key.pem");

  if (existsSync(certPath) && existsSync(keyPath) && !isCertExpiringSoon(certPath)) {
    return { cert: certPath, key: keyPath };
  }

  console.log("[lattice] Generating self-signed TLS certificate...");

  const sans = ["DNS:lattice", "DNS:localhost", "IP:127.0.0.1", "IP:::1"];
  const ifaces = networkInterfaces();
  for (const name in ifaces) {
    const addrs = ifaces[name];
    if (!addrs) continue;
    for (let i = 0; i < addrs.length; i++) {
      if (!addrs[i].internal) {
        sans.push("IP:" + addrs[i].address);
      }
    }
  }

  const extFile = join(certsDir, "openssl-san.cnf");
  writeFileSync(extFile, "[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=lattice\n[v3]\nsubjectAltName=" + sans.join(",") + "\n");

  const result = spawnSync(
    "openssl",
    [
      "req", "-x509",
      "-newkey", "rsa:2048",
      "-keyout", keyPath,
      "-out", certPath,
      "-days", "365",
      "-nodes",
      "-config", extFile,
    ],
    { encoding: "utf-8" }
  );

  if (result.status !== 0) {
    throw new Error("[lattice] Failed to generate TLS certificates: " + (result.stderr || result.error?.message || "unknown error"));
  }

  console.log("[lattice] TLS certificates generated at " + certsDir);

  return { cert: certPath, key: keyPath };
}
