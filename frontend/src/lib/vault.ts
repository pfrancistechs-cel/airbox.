/**
 * Zero-Knowledge Vault Encryption Engine
 * Implements client-side AES-256-GCM authenticated encryption + PBKDF2 key derivation.
 * The server never sees the plaintext or the user's passphrase.
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;

// Derive a 256-bit AES-GCM CryptoKey from a passphrase and salt
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a File into a Zero-Knowledge Encrypted Blob.
 * Output format: [16 bytes Salt] + [12 bytes IV] + [Ciphertext + Auth Tag]
 */
export async function encryptVaultFile(file: File, passphrase: string): Promise<Blob> {
  const fileBytes = await file.arrayBuffer();

  // 1. Generate random Salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));

  // 2. Derive AES key
  const key = await deriveKey(passphrase, salt);

  // 3. Encrypt file data
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    fileBytes
  );

  // 4. Concatenate: Salt (16) + IV (12) + Ciphertext
  return new Blob([salt, iv, ciphertext], { type: "application/octet-stream" });
}

/**
 * Decrypts a Zero-Knowledge Encrypted Blob using the passphrase.
 * Returns the decrypted plaintext Blob with original MIME type.
 */
export async function decryptVaultFile(
  encryptedBlob: Blob,
  passphrase: string,
  originalMimeType: string = "application/octet-stream"
): Promise<Blob> {
  const buffer = await encryptedBlob.arrayBuffer();

  if (buffer.byteLength < SALT_BYTE_LENGTH + IV_BYTE_LENGTH) {
    throw new Error("Invalid or corrupted vault file payload.");
  }

  // 1. Extract Salt, IV, and Ciphertext
  const salt = new Uint8Array(buffer.slice(0, SALT_BYTE_LENGTH));
  const iv = new Uint8Array(buffer.slice(SALT_BYTE_LENGTH, SALT_BYTE_LENGTH + IV_BYTE_LENGTH));
  const ciphertext = buffer.slice(SALT_BYTE_LENGTH + IV_BYTE_LENGTH);

  // 2. Derive key
  const key = await deriveKey(passphrase, salt);

  // 3. Decrypt
  try {
    const decryptedBytes = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      ciphertext as any
    );
    return new Blob([decryptedBytes], { type: originalMimeType });
  } catch {
    throw new Error("Decryption failed. Incorrect passphrase or corrupted vault file.");
  }
}
