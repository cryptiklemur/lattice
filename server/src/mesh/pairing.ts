import { randomBytes } from "node:crypto";

var BASE62_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
var CODE_LENGTH = 16;

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
  while (result.length < CODE_LENGTH) {
    result = BASE62_CHARS[0] + result;
  }
  return result;
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

function packPayload(address: string, port: number, token: Buffer): Buffer {
  var parts = address.split(".");
  var buf = Buffer.alloc(4 + 2 + token.length);
  for (var i = 0; i < 4; i++) {
    buf[i] = parseInt(parts[i] || "0", 10);
  }
  buf.writeUInt16BE(port, 4);
  token.copy(buf, 6);
  return buf;
}

function unpackPayload(buf: Buffer): { address: string; port: number; token: string } | null {
  if (buf.length < 8) return null;
  var address = buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3];
  var port = buf.readUInt16BE(4);
  var token = buf.subarray(6).toString("hex");
  return { address, port, token };
}

function formatCode(raw: string): string {
  var chunks: string[] = [];
  for (var i = 0; i < raw.length; i += 4) {
    chunks.push(raw.slice(i, i + 4));
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
  var tokenBuf = randomBytes(4);
  var token = tokenBuf.toString("hex");
  var payload = packPayload(address, port, tokenBuf);
  var encoded = base62Encode(payload);
  var code = formatCode(encoded);

  pendingTokens.set(token, Date.now());

  return { code, token, qrDataUrl: "" };
}

export function parseInviteCode(
  code: string
): { address: string; port: number; token: string } | null {
  try {
    var stripped = stripCode(code);
    var decoded = base62Decode(stripped);
    return unpackPayload(decoded);
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
