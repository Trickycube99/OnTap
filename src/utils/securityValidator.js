// Comprehensive Security Input Validation, Sanitization & Rate Limiting Module
// Guards against Cross-Site Scripting (XSS), Parameter Injection, and Brute Force Attacks

/**
 * Sanitize untrusted string to eliminate XSS vectors, null bytes, and script tags
 */
export function sanitizeString(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '') // Strip null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/[<>]/g, '') // Strip angle brackets to prevent HTML injection
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate email address format strictly
 */
export function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string.' };
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length > 254) {
    return { valid: false, error: 'Please enter a valid, format-compliant email address.' };
  }
  return { valid: true, sanitized: cleanEmail };
}

/**
 * Validate numeric PIN or password length & complexity
 */
export function validatePin(pin, minLength = 4, maxLength = 6) {
  const clean = String(pin || '').trim();
  if (!clean) {
    return { valid: false, error: 'PIN cannot be empty.' };
  }
  const regex = new RegExp(`^\\d{${minLength},${maxLength}}$`);
  if (!regex.test(clean)) {
    return { valid: false, error: `PIN must be between ${minLength} and ${maxLength} numeric digits.` };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Validate business account identifier
 */
export function validateBusinessId(businessId) {
  const clean = String(businessId || '').trim();
  if (!clean || !/^[a-zA-Z0-9_-]{2,64}$/.test(clean)) {
    return { valid: false, error: 'Business ID must be 2-64 alphanumeric characters, hyphens, or underscores.' };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Validate table identifier from QR codes or URL parameters
 */
export function validateTableNumber(table) {
  const clean = String(table || '').trim();
  if (!clean || clean.length > 32 || /[<>'";]/.test(clean)) {
    return { valid: false, error: 'Invalid table format.' };
  }
  return { valid: true, sanitized: clean };
}

/**
 * Client-Side Rate Limiter & Brute-Force Lockout Defense
 * Automatically tracks failed authentication attempts and enforces cooldowns
 */
const rateLimitMemory = new Map();

export function checkRateLimit(actionKey, maxAttempts = 5, lockoutMs = 300000) {
  const now = Date.now();
  let record = rateLimitMemory.get(actionKey);

  // If stored in sessionStorage, pull persistence across rapid reloads
  if (!record && typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(`flowscape_rate_${actionKey}`);
      if (stored) record = JSON.parse(stored);
    } catch {}
  }

  if (record) {
    // If currently locked out:
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: remainingSeconds,
        error: `Security Lockout: Too many failed attempts. Please try again in ${remainingSeconds} seconds.`
      };
    }

    // Cooldown window passed, reset attempts
    if (record.lockedUntil && now >= record.lockedUntil) {
      record = { attempts: 0, firstAttemptAt: now, lockedUntil: 0 };
    }
  } else {
    record = { attempts: 0, firstAttemptAt: now, lockedUntil: 0 };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, maxAttempts - record.attempts)
  };
}

export function recordFailedAttempt(actionKey, maxAttempts = 5, lockoutMs = 300000) {
  const now = Date.now();
  let record = rateLimitMemory.get(actionKey) || { attempts: 0, firstAttemptAt: now, lockedUntil: 0 };

  record.attempts += 1;

  if (record.attempts >= maxAttempts) {
    record.lockedUntil = now + lockoutMs;
  }

  rateLimitMemory.set(actionKey, record);

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(`flowscape_rate_${actionKey}`, JSON.stringify(record));
    } catch {}
  }

  const remainingSeconds = record.lockedUntil ? Math.ceil((record.lockedUntil - now) / 1000) : 0;
  return {
    isLocked: Boolean(record.lockedUntil),
    remainingAttempts: Math.max(0, maxAttempts - record.attempts),
    retryAfterSeconds: remainingSeconds
  };
}

export function resetRateLimit(actionKey) {
  rateLimitMemory.delete(actionKey);
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(`flowscape_rate_${actionKey}`);
    } catch {}
  }
}
