// Public-key encryption of exported files (tweetnacl: X25519 + XSalsa20-Poly1305).
//
// Each export uses a fresh throw-away key pair, so the phone that made the file cannot open it
// again: only the admin's private key can. File layout (all binary):
//
//   "MWE1" (4) | admin key id (8) | ephemeral public key (32) | nonce (24) | sealed box (rest)
//
// The decrypt tool in admin-tool/decrypt.html reads exactly this layout. Change one, change both.
import nacl from 'tweetnacl';
import * as Crypto from 'expo-crypto';
import { base64ToBytes } from '../excel/base64';

// Hermes has no crypto.getRandomValues, so give tweetnacl a secure random source.
nacl.setPRNG((x, n) => {
  const r = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = r[i];
});

const MAGIC = [0x4d, 0x57, 0x45, 0x31]; // "MWE1"

export class AdminKeyError extends Error {}

function parsePublicKey(publicKeyB64: string): Uint8Array {
  const key = base64ToBytes((publicKeyB64 ?? '').trim());
  if (key.length !== 32) {
    throw new AdminKeyError(
      'The admin public key is missing or invalid. Set ADMIN_PUBLIC_KEY in constants/adminKey.ts.'
    );
  }
  return key;
}

function keyId(publicKey: Uint8Array): Uint8Array {
  return nacl.hash(publicKey).slice(0, 8);
}

/** Short fingerprint to show on screen, e.g. "3FA9-81C2-0B7D-E455". Null if no valid key is set. */
export function adminKeyFingerprint(publicKeyB64: string): string | null {
  try {
    const hex = Array.from(keyId(parsePublicKey(publicKeyB64)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    return hex.match(/.{4}/g)!.join('-');
  } catch {
    return null;
  }
}

export function encryptForAdmin(plain: Uint8Array, adminPublicKeyB64: string): Uint8Array {
  const adminPublic = parsePublicKey(adminPublicKeyB64);
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  const sealed = nacl.box(plain, nonce, adminPublic, ephemeral.secretKey);
  ephemeral.secretKey.fill(0);

  const out = new Uint8Array(4 + 8 + 32 + 24 + sealed.length);
  out.set(MAGIC, 0);
  out.set(keyId(adminPublic), 4);
  out.set(ephemeral.publicKey, 12);
  out.set(nonce, 44);
  out.set(sealed, 68);
  return out;
}
