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
  var path = getIdentityPath();
  if (existsSync(path)) {
    var stored = JSON.parse(readFileSync(path, "utf-8")) as NodeIdentity;
    if (stored.publicKey && stored.privateKey) {
      return stored;
    }
    var keys = generateEd25519Keypair();
    stored.publicKey = keys.publicKey;
    stored.privateKey = keys.privateKey;
    writeFileSync(path, JSON.stringify(stored, null, 2), "utf-8");
    chmodSync(path, 0o600);
    return stored;
  }
  var keys = generateEd25519Keypair();
  var identity: NodeIdentity = {
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
  var pair = generateKeyPairSync("ed25519", {
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
