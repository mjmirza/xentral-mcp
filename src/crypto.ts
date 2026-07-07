/**
 * AES-256-GCM encryption for the tenant Personal Access Token at rest.
 *
 * Phase C2 stores the Xentral PAT inside an OAuth grant so the end user does
 * not resend it per request. The PAT is a full-access credential, so it is
 * never persisted in the clear. This module encrypts it with AES-256-GCM via
 * WebCrypto, keyed by the Workers secret TOKEN_ENCRYPTION_KEY.
 *
 * The stored form is a JSON string with two base64 fields, a per-record random
 * 12-byte IV and the ciphertext (the GCM auth tag is appended to the ciphertext
 * by WebCrypto). The raw PAT and the derived key exist only in memory, never in
 * a log line, never in the stored props (only the encrypted form is stored).
 *
 * Key derivation. The secret is a high-entropy machine secret, not a human
 * password, so its SHA-256 digest is used directly as the 256-bit AES key. Set
 * a long random value via `wrangler secret put TOKEN_ENCRYPTION_KEY`.
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();
const IV_BYTES = 12;

/** Shape of the stored encrypted record. Both fields are base64. */
interface EncryptedRecord {
  iv: string;
  ciphertext: string;
}

/** Derive a 256-bit AES-GCM key from the secret via SHA-256. */
async function deriveKey(secret: string): Promise<CryptoKey> {
  if (!secret || secret.trim() === "") {
    throw new Error("Missing TOKEN_ENCRYPTION_KEY. Set it with `wrangler secret put TOKEN_ENCRYPTION_KEY`.");
  }
  const digest = await crypto.subtle.digest("SHA-256", ENC.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Encrypt a plaintext token. Returns a JSON string with base64 iv and
 * ciphertext, suitable for storing in the grant props.
 */
export async function encryptToken(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ENC.encode(plaintext));
  const record: EncryptedRecord = {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
  };
  return JSON.stringify(record);
}

/**
 * Decrypt an encrypted record produced by encryptToken. Throws if the secret
 * is wrong, the record is malformed, or the auth tag does not verify.
 */
export async function decryptToken(encoded: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  let record: EncryptedRecord;
  try {
    record = JSON.parse(encoded) as EncryptedRecord;
  } catch {
    throw new Error("Stored token record is malformed.");
  }
  if (!record.iv || !record.ciphertext) {
    throw new Error("Stored token record is missing a field.");
  }
  const iv = base64ToBytes(record.iv);
  const ciphertext = base64ToBytes(record.ciphertext);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return DEC.decode(plainBuffer);
}

/**
 * A stable, non-reversible user id for an instance host. Xentral has no user
 * identity, so grants are keyed by the instance. The host itself is not used as
 * the id, so no host string sits in the grant key, and the value never contains
 * a colon, which the provider access-token format reserves.
 */
export async function userIdForInstance(baseUrl: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", ENC.encode(baseUrl));
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return `xentral-${hex.slice(0, 32)}`;
}
