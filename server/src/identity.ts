import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getLatticeHome } from "./config";

interface NodeIdentity {
  id: string;
  createdAt: number;
}

export function getIdentityPath(): string {
  return join(getLatticeHome(), "identity.json");
}

export function loadOrCreateIdentity(): NodeIdentity {
  var path = getIdentityPath();
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, "utf-8")) as NodeIdentity;
  }
  var identity: NodeIdentity = {
    id: randomUUID(),
    createdAt: Date.now(),
  };
  writeFileSync(path, JSON.stringify(identity, null, 2), "utf-8");
  return identity;
}
