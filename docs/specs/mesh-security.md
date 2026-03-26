# Mesh Security — Design Spec

## Threat Model

Zero-trust: assume the network is hostile. An attacker on the same network (or between nodes) should not be able to:

1. **Eavesdrop** on mesh traffic (session data, file contents, terminal I/O)
2. **Impersonate** a node (inject commands, steal sessions)
3. **Replay** captured messages to a different node
4. **Man-in-the-middle** the pairing handshake

## Architecture

### Key Hierarchy

```
Pairing time:
  Node A generates Ed25519 keypair → stores in ~/.lattice/identity.json
  Node B generates Ed25519 keypair → stores in ~/.lattice/identity.json
  During pairing handshake, they exchange public keys
  Each node stores the other's public key in peers.json

Session time:
  Nodes derive a shared secret via X25519 key exchange (ECDH)
  All messages encrypted with AES-256-GCM using the shared secret
  Nonce = counter (prevents replay)
```

### Identity

Each Lattice node already has an identity (`~/.lattice/identity.json` with a UUID). Extend this with a persistent Ed25519 keypair:

```json
{
  "id": "uuid-here",
  "publicKey": "base64-encoded-ed25519-public-key",
  "privateKey": "base64-encoded-ed25519-private-key"
}
```

Generated once on first run. The public key becomes the node's cryptographic identity. The UUID remains for display/routing.

### Pairing Handshake (Enhanced)

Current flow + cryptographic binding:

```
Machine A                              Machine B
    |                                      |
    |  Generate invite code                |
    |  (encodes IP:port:token)             |
    |                                      |
    |  User copies code to Machine B       |
    |                                      |
    |              WebSocket connect       |
    |  <---------------------------------- |
    |                                      |
    |              mesh:hello              |
    |  <---------------------------------- |
    |  { nodeId, name, token,              |
    |    publicKey: B's Ed25519 pubkey,    |
    |    addresses }                       |
    |                                      |
    |  Validate token (one-time)           |
    |  Store B's public key in peers.json  |
    |                                      |
    |              mesh:hello              |
    |  --------------------------------->  |
    |  { nodeId, name,                     |
    |    publicKey: A's Ed25519 pubkey }   |
    |                                      |
    |  Store A's public key in peers.json  |
    |                                      |
    |  --- Pairing complete ---            |
```

After pairing, `peers.json` on each side stores the other's public key. This is the trust anchor — all future connections verify identity against this stored key.

### Reconnection Handshake (Mutual Authentication)

When a connector reconnects to a known peer:

```
Machine A                              Machine B
    |                                      |
    |              WebSocket connect       |
    |  --------------------------------->  |
    |                                      |
    |              mesh:hello              |
    |  --------------------------------->  |
    |  { nodeId,                           |
    |    challenge: random 32 bytes,       |
    |    publicKey: A's pubkey }           |
    |                                      |
    |  Verify A's pubkey matches stored    |
    |  Sign A's challenge with B's privkey |
    |                                      |
    |              mesh:hello_ack          |
    |  <---------------------------------  |
    |  { nodeId,                           |
    |    challenge: random 32 bytes,       |
    |    signature: sign(A's challenge),   |
    |    publicKey: B's pubkey }           |
    |                                      |
    |  Verify B's pubkey matches stored    |
    |  Verify B's signature on challenge   |
    |  Sign B's challenge with A's privkey |
    |                                      |
    |              mesh:hello_complete     |
    |  --------------------------------->  |
    |  { signature: sign(B's challenge) }  |
    |                                      |
    |  Verify A's signature               |
    |                                      |
    |  --- Authenticated session ---       |
    |  Derive shared secret via X25519     |
```

### Session Key Derivation

After mutual authentication, both nodes derive a shared secret for message encryption:

1. Each node generates an ephemeral X25519 keypair (per connection)
2. Exchange ephemeral public keys during the hello handshake
3. Derive shared secret: `ECDH(my_ephemeral_private, their_ephemeral_public)`
4. Derive encryption key: `HKDF-SHA256(shared_secret, salt="lattice-mesh-v1", info=sorted_node_ids)`

This provides forward secrecy — compromising a node's long-term key doesn't decrypt past sessions.

### Message Encryption

All mesh messages after authentication are encrypted:

```typescript
interface EncryptedMeshMessage {
  type: "mesh:encrypted";
  nonce: number;        // monotonic counter, prevents replay
  ciphertext: string;   // AES-256-GCM encrypted JSON
  tag: string;          // GCM auth tag
}
```

**Encryption:** `AES-256-GCM(key, nonce, plaintext_json)`
**Nonce:** 12-byte IV constructed from the counter + connection ID
**Replay protection:** Each side tracks the highest seen nonce and rejects anything ≤ last seen

### Message Signing (Lightweight Alternative)

If full encryption is too expensive for high-throughput messages (e.g., terminal I/O streaming), a signing-only mode can be used:

```typescript
interface SignedMeshMessage {
  type: "mesh:signed";
  payload: string;      // JSON string of the actual message
  nonce: number;
  signature: string;    // Ed25519 signature of (nonce + payload)
}
```

This prevents tampering and replay without the encryption overhead. Useful when the transport is already encrypted (Tailscale/WireGuard).

## Implementation Phases

### Phase 1: Identity Keypairs

- Generate Ed25519 keypair on first run, store in `identity.json`
- Extend `PeerInfo` with `publicKey: string` (already has the field, currently empty)
- Exchange public keys during pairing handshake
- **Files:** `server/src/identity.ts`, `server/src/handlers/mesh.ts`, `shared/src/models.ts`

### Phase 2: Mutual Authentication on Reconnect

- Challenge-response during connector reconnection
- Reject connections from nodes whose public key doesn't match stored key
- **Files:** `server/src/mesh/connector.ts`, `server/src/handlers/mesh.ts`

### Phase 3: Message Encryption

- X25519 ephemeral key exchange after authentication
- AES-256-GCM encryption for all mesh messages
- Nonce counter for replay protection
- **Files:** `server/src/mesh/crypto.ts` (new), `server/src/mesh/connector.ts`

### Phase 4: Transport Security

- Optional TLS for WebSocket connections between nodes (already supported via `config.tls`)
- Certificate pinning against the peer's public key
- **Files:** `server/src/mesh/connector.ts`, `server/src/daemon.ts`

## Crypto Primitives

All available in Node.js `crypto` module (and Bun):

| Primitive | Purpose | Module |
|-----------|---------|--------|
| Ed25519 | Identity keypair, signing | `crypto.generateKeyPairSync('ed25519')` |
| X25519 | Ephemeral key exchange (ECDH) | `crypto.diffieHellman()` with X25519 |
| AES-256-GCM | Message encryption | `crypto.createCipheriv('aes-256-gcm')` |
| HKDF-SHA256 | Key derivation | `crypto.hkdfSync('sha256')` |
| randomBytes | Challenges, nonces | `crypto.randomBytes()` |

## Security Properties

| Property | Mechanism |
|----------|-----------|
| **Confidentiality** | AES-256-GCM encryption of all mesh messages |
| **Integrity** | GCM authentication tag on every message |
| **Authentication** | Ed25519 challenge-response on every connection |
| **Non-repudiation** | Ed25519 signatures tied to persistent identity |
| **Forward secrecy** | Ephemeral X25519 keys per connection |
| **Replay protection** | Monotonic nonce counter per connection |
| **MITM prevention** | Public key pinning from initial pairing |

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Identity keypairs | Small | None |
| Phase 2: Mutual auth | Medium | Phase 1 |
| Phase 3: Encryption | Medium | Phase 2 |
| Phase 4: Transport TLS | Small | Phase 1 |
