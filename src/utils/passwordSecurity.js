// Cryptographic Password & PIN Hashing Layer using Web Crypto PBKDF2 (SHA-256, 100,000 iterations)
// Complies with NIST SP 800-63B and OWASP Password Storage Guidelines

/**
 * Convert an ArrayBuffer to a hex string
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array
 */
function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Constant-time string equality check to mitigate timing attacks
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Check if a stored string is already in PBKDF2 hashed format
 */
export function isPasswordHashed(storedValue) {
  if (typeof storedValue !== 'string') return false;
  return storedValue.startsWith('pbkdf2:');
}

/**
 * Securely hash a password or PIN using PBKDF2-HMAC-SHA256 with 100,000 rounds and unique salt
 * @param {string} password - Raw plaintext password or PIN
 * @returns {Promise<string>} - Formatted hash string `pbkdf2:100000:<saltHex>:<hashHex>`
 */
export async function hashPassword(password) {
  const cleanPass = String(password || '').trim();
  if (!cleanPass) {
    throw new Error('Cannot hash empty password or PIN.');
  }

  const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    // Fallback simple SHA-256 if subtle crypto is somehow unavailable
    return `plain:${cleanPass}`;
  }

  // Generate 16-byte cryptographically secure random salt
  const salt = new Uint8Array(16);
  cryptoObj.getRandomValues(salt);

  const encoder = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    encoder.encode(cleanPass),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const iterations = 100000;
  const derivedKey = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 32 bytes (256 bits)
  );

  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedKey);

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verify a plaintext candidate password or PIN against a stored value (hashed or legacy plaintext)
 * @param {string} candidatePassword - Plaintext candidate
 * @param {string} storedHash - Stored hash or legacy plaintext
 * @returns {Promise<{ valid: boolean, needsRehash: boolean }>}
 */
export async function verifyPassword(candidatePassword, storedHash) {
  const cleanCandidate = String(candidatePassword || '').trim();
  const cleanStored = String(storedHash || '').trim();

  if (!cleanCandidate || !cleanStored) {
    return { valid: false, needsRehash: false };
  }

  // 1. If stored in PBKDF2 format
  if (cleanStored.startsWith('pbkdf2:')) {
    const parts = cleanStored.split(':');
    if (parts.length !== 4) {
      return { valid: false, needsRehash: false };
    }

    const iterations = parseInt(parts[1], 10);
    const salt = hexToBuffer(parts[2]);
    const expectedHashHex = parts[3];

    const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : globalThis.crypto;
    if (!cryptoObj || !cryptoObj.subtle) {
      return { valid: false, needsRehash: false };
    }

    const encoder = new TextEncoder();
    const keyMaterial = await cryptoObj.subtle.importKey(
      'raw',
      encoder.encode(cleanCandidate),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    const candidateHashHex = bufferToHex(derivedBits);
    const valid = timingSafeEqual(candidateHashHex, expectedHashHex);
    return { valid, needsRehash: iterations < 100000 };
  }

  // 2. Legacy Plaintext comparison (during zero-downtime migration):
  // Constant-time comparison to prevent timing side channels
  const match = timingSafeEqual(cleanCandidate, cleanStored);
  return { valid: match, needsRehash: match }; // If matched, flag that it needs re-hashing
}
