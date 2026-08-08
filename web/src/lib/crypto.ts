// src/lib/crypto.ts
//
// ⚠️  SECURITY NOTICE — DEPRECATED CLIENT-SIDE ENCRYPTION
// ──────────────────────────────────────────────────────────────────────────────
// The functions below derive an AES-GCM key from the user's Firebase UID.
// Because the UID is a *public* identifier (visible in Firestore rules, auth
// tokens, URLs, etc.), any attacker who can read localStorage can also derive
// the key and decrypt the stored API key — this is *not* meaningful encryption.
//
// The correct approach is to store API keys exclusively in the server-side
// Firestore vault (collection: apiKeysWallet) and retrieve/use them only from
// the backend via the Admin SDK.  The frontend should NEVER hold or transmit
// a plaintext API key.
//
// These functions are retained only to avoid breaking any legacy import paths.
// DO NOT add new callers.  The resume-builder no longer calls decryptApiKey.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @deprecated — See security notice above.
 * Derives a cryptographic key from the user's Firebase UID using SHA-256 hash.
 */
async function deriveKey(uid: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const rawSalt = encoder.encode(uid + '_careercraft_byok_salt_2026');
  const hash = await window.crypto.subtle.digest('SHA-256', rawSalt);
  
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain-text API key client-side using the user's UID.
 * Returns a combined string format: "iv_hex:ciphertext_hex"
 */
export async function encryptApiKey(apiKey: string, uid: string): Promise<string> {
  if (typeof window === 'undefined' || !apiKey || !uid) return '';
  try {
    const key = await deriveKey(uid);
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(apiKey);
    
    // Generate a random 12-byte IV for AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );
    
    // Convert ArrayBuffer to Hex string
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${ivHex}:${cipherHex}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Could not encrypt API key client-side.');
  }
}

/**
 * Decrypts the encrypted API key string ("iv_hex:ciphertext_hex") using the user's UID.
 * Returns the original plain-text API key.
 */
export async function decryptApiKey(encryptedCombined: string, uid: string): Promise<string> {
  if (typeof window === 'undefined' || !encryptedCombined || !uid) return '';
  try {
    const parts = encryptedCombined.split(':');
    if (parts.length !== 2) {
      // Legacy unencrypted key format fallback or empty key
      return encryptedCombined;
    }
    
    const [ivHex, cipherHex] = parts;
    
    // Convert Hex strings back to Uint8Array
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    const key = await deriveKey(uid);
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}
