/**
 * Utility for encrypting and decrypting data using the Web Crypto API (AES-GCM).
 * Note: This is client-side security enhancement. The key derivation password 
 * should ideally not be hardcoded in a real production environment if the goal 
 * is to prevent a determined attacker, but it adds a layer of obfuscation/protection.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Derives a cryptographic key from a password and salt.
 */
async function deriveKey(password, salt) {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    ENCODER.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a string (e.g., JSON stringified config).
 * Returns a base64 string containing salt, iv, and ciphertext.
 */
export async function encryptData(data, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ENCODER.encode(data)
  );

  const encryptedArray = new Uint8Array(encrypted);
  const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(encryptedArray, salt.length + iv.length);

  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts a base64 string produced by encryptData.
 */
export async function decryptData(encryptedBase64, password) {
  const binaryString = atob(encryptedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ciphertext = bytes.slice(28);

  const key = await deriveKey(password, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  return DECODER.decode(decrypted);
}
