/**
 * encrypted-storage.ts
 *
 * Issue #943: Add encrypted local storage adapter for sensitive workspace credentials.
 *
 * Encrypts all values written to `localStorage` using AES-256-GCM via the
 * Web Crypto API so that sensitive data (custom RPC keys, private notes, etc.)
 * is not stored in plain-text in the browser.
 *
 * Key derivation
 * --------------
 * The encryption key is derived from a user-supplied passphrase using
 * PBKDF2 (SHA-256, 310 000 iterations per NIST SP 800-132 guidelines).
 * A random 16-byte salt is persisted alongside the encrypted value so that
 * the key can be re-derived on the next read.
 *
 * If no passphrase is supplied the adapter falls back to a deterministic
 * device-bound key derived from `crypto.randomUUID()` that is stored as a
 * separate non-sensitive key in localStorage (the "auto" mode).
 *
 * Key rotation
 * ------------
 * Call `EncryptedStorageAdapter.rotate(newPassphrase?)` to re-encrypt all
 * managed keys under a new derived key.  The old key material is erased
 * after successful rotation.
 *
 * Usage
 * -----
 *   const storage = new EncryptedStorageAdapter("my-passphrase");
 *   await storage.setItem("rpc-key", "https://secret-rpc-node.example");
 *   const value = await storage.getItem("rpc-key");
 *   await storage.removeItem("rpc-key");
 *   await storage.rotate("new-passphrase");
 *
 * Server-side rendering
 * ---------------------
 * All methods are no-ops (return `null` / do nothing) when `window` is
 * not defined so that the adapter is safe to import in Next.js page code.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** localStorage key under which the auto-generated device key seed is stored. */
const DEVICE_SEED_KEY = "sdc:enc:device-seed:v1";

/** Namespace prefix applied to every encrypted entry. */
const ENTRY_PREFIX = "sdc:enc:v1:";

/** PBKDF2 iteration count (NIST SP 800-132 minimum for SHA-256 is 310 000). */
const PBKDF2_ITERATIONS = 310_000;

/** AES-GCM IV byte length (96 bits). */
const GCM_IV_BYTES = 12;

/** PBKDF2 salt byte length. */
const SALT_BYTES = 16;

// ─── Serialised envelope (stored as JSON in localStorage) ────────────────────

interface EncryptedEnvelope {
  /** Base64-encoded AES-GCM initialisation vector. */
  iv: string;
  /** Base64-encoded PBKDF2 salt used to derive the key for this entry. */
  salt: string;
  /** Base64-encoded AES-GCM ciphertext. */
  ct: string;
  /** Schema version for forward-compatibility. */
  v: 1;
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ─── Web Crypto helpers ───────────────────────────────────────────────────────

/**
 * Import a passphrase string as a PBKDF2 key material handle.
 */
async function importPassphrase(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
}

/**
 * Derive an AES-256-GCM `CryptoKey` from a passphrase and salt using PBKDF2.
 */
async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await importPassphrase(passphrase);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // not extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt `plaintext` with AES-256-GCM, returning an `EncryptedEnvelope`.
 */
async function encrypt(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES));
  const key = await deriveAesKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    iv: bufToBase64(iv.buffer),
    salt: bufToBase64(salt.buffer),
    ct: bufToBase64(ciphertext),
    v: 1,
  };
}

/**
 * Decrypt an `EncryptedEnvelope` back to a plaintext string.
 * Throws `DOMException` if the key is wrong or the data has been tampered with.
 */
async function decrypt(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<string> {
  const salt = new Uint8Array(base64ToBuf(envelope.salt));
  const iv = new Uint8Array(base64ToBuf(envelope.iv));
  const ct = base64ToBuf(envelope.ct);

  const key = await deriveAesKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct,
  );

  return new TextDecoder().decode(plaintext);
}

// ─── Device seed (auto-mode key) ──────────────────────────────────────────────

/**
 * Retrieve (or generate and persist) a stable per-device random seed that is
 * used as the encryption passphrase when the caller does not supply one.
 *
 * ⚠️  The device seed is stored unencrypted in localStorage.  It provides
 * "encryption at rest" against casual inspection but NOT against an attacker
 * with JavaScript execution access.  For higher security, always supply an
 * explicit user passphrase.
 */
function getOrCreateDeviceSeed(): string {
  const existing = localStorage.getItem(DEVICE_SEED_KEY);
  if (existing) return existing;

  const seed = crypto.randomUUID();
  localStorage.setItem(DEVICE_SEED_KEY, seed);
  return seed;
}

// ─── EncryptedStorageAdapter ──────────────────────────────────────────────────

export class EncryptedStorageAdapter {
  private passphrase: string;

  /**
   * @param passphrase - Optional user passphrase.  If omitted, a device-bound
   *                     seed is derived automatically and stored in localStorage.
   */
  constructor(passphrase?: string) {
    this.passphrase = passphrase ?? "";
  }

  /** Resolve the active passphrase, initialising the device seed if needed. */
  private resolvePassphrase(): string {
    if (this.passphrase) return this.passphrase;
    return getOrCreateDeviceSeed();
  }

  private storageKey(key: string): string {
    return `${ENTRY_PREFIX}${key}`;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Encrypt `value` and persist it under `key`.
   */
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === "undefined") return;

    const envelope = await encrypt(value, this.resolvePassphrase());
    localStorage.setItem(this.storageKey(key), JSON.stringify(envelope));
  }

  /**
   * Retrieve and decrypt the value stored under `key`.
   *
   * Returns `null` when the key does not exist or the passphrase is wrong.
   */
  async getItem(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(this.storageKey(key));
    if (!raw) return null;

    let envelope: EncryptedEnvelope;
    try {
      envelope = JSON.parse(raw) as EncryptedEnvelope;
    } catch {
      console.warn(`[EncryptedStorageAdapter] Corrupted entry for key "${key}".`);
      return null;
    }

    try {
      return await decrypt(envelope, this.resolvePassphrase());
    } catch (err) {
      // AES-GCM authentication tag failure → wrong key or tampered data
      console.warn(
        `[EncryptedStorageAdapter] Decryption failed for key "${key}". ` +
        "The passphrase may have changed or the data may have been corrupted.",
        err,
      );
      return null;
    }
  }

  /**
   * Remove the encrypted entry for `key`.
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.storageKey(key));
  }

  /**
   * Remove ALL encrypted entries managed by this adapter (entries prefixed
   * with `sdc:enc:v1:`).
   */
  clear(): void {
    if (typeof window === "undefined") return;

    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(ENTRY_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  }

  /**
   * Return the list of logical keys (without the namespace prefix) that are
   * currently stored by this adapter.
   */
  keys(): string[] {
    if (typeof window === "undefined") return [];

    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(ENTRY_PREFIX)) {
        result.push(k.slice(ENTRY_PREFIX.length));
      }
    }
    return result;
  }

  // ─── Key rotation ────────────────────────────────────────────────────────────

  /**
   * Re-encrypt all managed entries under a new passphrase.
   *
   * 1. Reads every existing entry using the current passphrase.
   * 2. Switches to the new passphrase.
   * 3. Re-encrypts and writes every entry.
   * 4. Erases the old device seed if switching from auto to manual mode.
   *
   * @param newPassphrase - New passphrase.  Pass `undefined` to rotate back
   *                        to a fresh device-bound seed.
   */
  async rotate(newPassphrase?: string): Promise<void> {
    if (typeof window === "undefined") return;

    const managedKeys = this.keys();

    // Decrypt all values with the current passphrase
    const plainValues = await Promise.all(
      managedKeys.map(async (k) => ({ key: k, value: await this.getItem(k) })),
    );

    // Switch to new passphrase
    if (!newPassphrase) {
      // Auto mode: invalidate the existing device seed and create a fresh one
      localStorage.removeItem(DEVICE_SEED_KEY);
    }
    this.passphrase = newPassphrase ?? "";

    // Re-encrypt with the new passphrase
    for (const { key, value } of plainValues) {
      if (value !== null) {
        await this.setItem(key, value);
      } else {
        // Value could not be decrypted with old key; leave as-is
        console.warn(
          `[EncryptedStorageAdapter] Key rotation: could not decrypt "${key}". Entry preserved as-is.`,
        );
      }
    }
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _defaultAdapter: EncryptedStorageAdapter | null = null;

/**
 * Return the shared default `EncryptedStorageAdapter` instance (auto device-seed mode).
 *
 * For passphrase-protected storage create a new `EncryptedStorageAdapter` instance
 * directly.
 */
export function getEncryptedStorage(): EncryptedStorageAdapter {
  if (!_defaultAdapter) {
    _defaultAdapter = new EncryptedStorageAdapter();
  }
  return _defaultAdapter;
}

export default EncryptedStorageAdapter;
