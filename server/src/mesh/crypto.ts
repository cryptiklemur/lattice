import { createSign, createVerify, randomBytes, createCipheriv, createDecipheriv, createHash, diffieHellman, generateKeyPairSync, createPublicKey, createPrivateKey } from "node:crypto";

export function sign(privateKeyBase64: string, data: Buffer): string {
  var privateKeyDer = Buffer.from(privateKeyBase64, "base64");
  var key = createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs8" });
  var signer = createSign("ed25519");
  signer.update(data);
  return signer.sign(key).toString("base64");
}

export function verify(publicKeyBase64: string, data: Buffer, signatureBase64: string): boolean {
  try {
    var publicKeyDer = Buffer.from(publicKeyBase64, "base64");
    var key = createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    var verifier = createVerify("ed25519");
    verifier.update(data);
    return verifier.verify(key, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

export function generateChallenge(): string {
  return randomBytes(32).toString("base64");
}

export interface EphemeralKeys {
  publicKey: string;
  privateKey: Buffer;
}

export function generateEphemeralKeys(): EphemeralKeys {
  var pair = generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey: Buffer.from(pair.publicKey).toString("base64"),
    privateKey: Buffer.from(pair.privateKey),
  };
}

export function deriveSharedSecret(myPrivateKeyDer: Buffer, theirPublicKeyBase64: string, nodeIdA: string, nodeIdB: string): Buffer {
  var myKey = createPrivateKey({ key: myPrivateKeyDer, format: "der", type: "pkcs8" });
  var theirKey = createPublicKey({ key: Buffer.from(theirPublicKeyBase64, "base64"), format: "der", type: "spki" });

  var shared = diffieHellman({ privateKey: myKey, publicKey: theirKey });

  var sortedIds = [nodeIdA, nodeIdB].sort().join(":");
  var hash = createHash("sha256");
  hash.update(shared);
  hash.update(Buffer.from("lattice-mesh-v1:" + sortedIds));
  return hash.digest();
}

export function encrypt(key: Buffer, nonce: number, plaintext: string): { ciphertext: string; tag: string } {
  var iv = Buffer.alloc(12);
  iv.writeBigUInt64BE(BigInt(nonce), 4);
  var cipher = createCipheriv("aes-256-gcm", key, iv);
  var encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decrypt(key: Buffer, nonce: number, ciphertext: string, tag: string): string | null {
  try {
    var iv = Buffer.alloc(12);
    iv.writeBigUInt64BE(BigInt(nonce), 4);
    var decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    var decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return null;
  }
}

export interface SecureSession {
  sharedKey: Buffer;
  sendNonce: number;
  recvNonce: number;
}

export function createSecureSession(sharedKey: Buffer): SecureSession {
  return { sharedKey, sendNonce: 0, recvNonce: 0 };
}

export function encryptMessage(session: SecureSession, message: object): { type: "mesh:encrypted"; nonce: number; ciphertext: string; tag: string } {
  session.sendNonce++;
  var result = encrypt(session.sharedKey, session.sendNonce, JSON.stringify(message));
  return { type: "mesh:encrypted", nonce: session.sendNonce, ...result };
}

export function decryptMessage(session: SecureSession, nonce: number, ciphertext: string, tag: string): object | null {
  if (nonce <= session.recvNonce) return null;
  var plaintext = decrypt(session.sharedKey, nonce, ciphertext, tag);
  if (!plaintext) return null;
  session.recvNonce = nonce;
  try {
    return JSON.parse(plaintext);
  } catch {
    return null;
  }
}
