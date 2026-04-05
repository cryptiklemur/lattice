import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise(function (resolve, reject) {
    scrypt(password, salt, keylen, function (err, derivedKey) {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

var TOKEN_TTL = 86400000;
var CLEANUP_INTERVAL = 600000;

var activeSessions = new Map<string, number>();

export async function hashPassphrase(passphrase: string): Promise<string> {
  var salt = randomBytes(16).toString("hex");
  var hash = (await scryptAsync(passphrase, salt, 64)).toString("hex");
  return salt + ":" + hash;
}

export async function verifyPassphrase(passphrase: string, storedHash: string): Promise<boolean> {
  var parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }
  var salt = parts[0];
  var hash = parts[1];
  try {
    var derived = await scryptAsync(passphrase, salt, 64);
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
  activeSessions.set(token, Date.now());
}

export function removeSession(token: string): void {
  activeSessions.delete(token);
}

export function isValidSession(token: string): boolean {
  var createdAt = activeSessions.get(token);
  if (createdAt === undefined) {
    return false;
  }
  if (Date.now() - createdAt > TOKEN_TTL) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function clearSessions(): void {
  activeSessions.clear();
}

var cleanupInterval = setInterval(function () {
  var now = Date.now();
  activeSessions.forEach(function (createdAt, token) {
    if (now - createdAt > TOKEN_TTL) {
      activeSessions.delete(token);
    }
  });
}, CLEANUP_INTERVAL);
cleanupInterval.unref();
