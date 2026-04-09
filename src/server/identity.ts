import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { getLatticeHome } from "./config";

interface NodeIdentity {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: number;
}

export function getIdentityPath(): string {
  return join(getLatticeHome(), "identity.json");
}

export function loadOrCreateIdentity(): NodeIdentity {
  const path = getIdentityPath();
  if (existsSync(path)) {
    const stored = JSON.parse(readFileSync(path, "utf-8")) as NodeIdentity;
    if (stored.publicKey && stored.privateKey) {
      return stored;
    }
    const keys = generateEd25519Keypair();
    stored.publicKey = keys.publicKey;
    stored.privateKey = keys.privateKey;
    writeFileSync(path, JSON.stringify(stored, null, 2), "utf-8");
    chmodSync(path, 0o600);
    return stored;
  }
  const keys = generateEd25519Keypair();
  const identity: NodeIdentity = {
    id: randomUUID(),
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: Date.now(),
  };
  writeFileSync(path, JSON.stringify(identity, null, 2), "utf-8");
  chmodSync(path, 0o600);
  return identity;
}

function generateEd25519Keypair(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey: Buffer.from(pair.publicKey).toString("base64"),
    privateKey: Buffer.from(pair.privateKey).toString("base64"),
  };
}

export function getPublicKey(): string {
  return loadOrCreateIdentity().publicKey;
}
