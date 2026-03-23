import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

var BASE62_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

var PAIRING_TOKEN_TTL = 300000;
var CLEANUP_INTERVAL = 60000;

var pendingTokens = new Map<string, number>();

function base62Encode(buf: Buffer): string {
  var n = BigInt("0x" + buf.toString("hex"));
  var result = "";
  var base = BigInt(BASE62_CHARS.length);
  while (n > 0n) {
    result = BASE62_CHARS[Number(n % base)] + result;
    n = n / base;
  }
  return result || BASE62_CHARS[0];
}

function base62Decode(s: string): Buffer {
  var n = 0n;
  var base = BigInt(BASE62_CHARS.length);
  for (var i = 0; i < s.length; i++) {
    var idx = BASE62_CHARS.indexOf(s[i]);
    if (idx < 0) {
      throw new Error("Invalid base62 character: " + s[i]);
    }
    n = n * base + BigInt(idx);
  }
  var hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  return Buffer.from(hex, "hex");
}

function formatCode(raw: string): string {
  var upper = raw.toUpperCase();
  var chunks: string[] = [];
  for (var i = 0; i < upper.length; i += 4) {
    chunks.push(upper.slice(i, i + 4));
  }
  return "LTCE-" + chunks.join("-");
}

function stripCode(code: string): string {
  return code.replace(/^LTCE-/i, "").replace(/-/g, "");
}

export async function generateInviteCode(
  address: string,
  port: number
): Promise<{ code: string; token: string; qrDataUrl: string }> {
  var token = randomBytes(8).toString("hex");
  var payload = Buffer.from(address + ":" + port + ":" + token, "utf-8");
  var encoded = base62Encode(payload);
  var code = formatCode(encoded);

  pendingTokens.set(token, Date.now());

  var qrDataUrl = await QRCode.toString(code, { type: "svg" });

  return { code, token, qrDataUrl };
}

export function parseInviteCode(
  code: string
): { address: string; port: number; token: string } | null {
  try {
    var stripped = stripCode(code);
    var decoded = base62Decode(stripped).toString("utf-8");
    var parts = decoded.split(":");
    if (parts.length < 3) {
      return null;
    }
    var token = parts[parts.length - 1];
    var portStr = parts[parts.length - 2];
    var address = parts.slice(0, parts.length - 2).join(":");
    var port = parseInt(portStr, 10);
    if (isNaN(port)) {
      return null;
    }
    return { address, port, token };
  } catch {
    return null;
  }
}

export function validatePairingToken(token: string): boolean {
  var createdAt = pendingTokens.get(token);
  if (createdAt === undefined) {
    return false;
  }
  if (Date.now() - createdAt > PAIRING_TOKEN_TTL) {
    pendingTokens.delete(token);
    return false;
  }
  return true;
}

export function consumePairingToken(token: string): void {
  pendingTokens.delete(token);
}

setInterval(function () {
  var now = Date.now();
  pendingTokens.forEach(function (createdAt, token) {
    if (now - createdAt > PAIRING_TOKEN_TTL) {
      pendingTokens.delete(token);
    }
  });
}, CLEANUP_INTERVAL);
