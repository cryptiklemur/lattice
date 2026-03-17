import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

var activeSessions = new Set<string>();

export function hashPassphrase(passphrase: string): string {
  var salt = randomBytes(16).toString("hex");
  var hash = scryptSync(passphrase, salt, 64).toString("hex");
  return salt + ":" + hash;
}

export function verifyPassphrase(passphrase: string, storedHash: string): boolean {
  var parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }
  var salt = parts[0];
  var hash = parts[1];
  try {
    var derived = scryptSync(passphrase, salt, 64);
    var expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function addSession(token: string): void {
  activeSessions.add(token);
}

export function removeSession(token: string): void {
  activeSessions.delete(token);
}

export function isValidSession(token: string): boolean {
  return activeSessions.has(token);
}

export function clearSessions(): void {
  activeSessions.clear();
}
