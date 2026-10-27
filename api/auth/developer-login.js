// Server-Side Developer Superadmin Login API Handler
// Provides constant-time master credential evaluation, rate-limiting, and issues HttpOnly cookies
import crypto from 'crypto';

const ALLOWED_DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || 'pranjalmk62@gmail.com').trim().toLowerCase();
const DEVELOPER_MASTER_SECRET = process.env.DEVELOPER_MASTER_SECRET || process.env.DEVELOPER_PASSWORD || '';
const SERVER_SECRET = process.env.SESSION_SECRET || DEVELOPER_MASTER_SECRET || 'ontap_edge_server_hmac_secret_2026';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function signSessionPayload(payload, secret = SERVER_SECRET) {
  const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(pB64).digest('hex');
  return `${pB64}.${sig}`;
}

// In-memory rate limiting for developer login attempts
const devAttemptMap = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const attempt = devAttemptMap.get(clientIp) || { count: 0, lockedUntil: 0 };

  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: `Developer endpoint locked due to repeated failed attempts. Retry in ${waitSec}s.`
    });
  }

  const { email, password } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!DEVELOPER_MASTER_SECRET) {
    return res.status(500).json({
      error: 'SERVER_NOT_CONFIGURED',
      message: 'Developer master secret is not set in server environment variables.'
    });
  }

  const isEmailMatch = cleanEmail === ALLOWED_DEVELOPER_EMAIL;
  const isPassMatch = timingSafeEqual(cleanPass, DEVELOPER_MASTER_SECRET);

  if (!isEmailMatch || !isPassMatch) {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout
    }
    devAttemptMap.set(clientIp, attempt);
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid developer superadmin credentials.'
    });
  }

  // Clear attempts on success
  devAttemptMap.delete(clientIp);

  // Generate cryptographically secure signed session token
  const nonce = crypto.randomBytes(16).toString('hex');
  const sessionPayload = {
    role: 'developer',
    email: ALLOWED_DEVELOPER_EMAIL,
    nonce,
    iat: now,
    exp: now + 86400 * 1000 // 24 hours
  };
  const sessionToken = signSessionPayload(sessionPayload);
  const cookieFlags = 'Path=/; Max-Age=86400; HttpOnly; SameSite=Strict; Secure';

  res.setHeader('Set-Cookie', [
    `ontap_dev_session=${sessionToken}; ${cookieFlags}`,
    `ontap_session_role=developer; ${cookieFlags}`
  ]);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  return res.status(200).json({
    success: true,
    role: 'developer',
    email: ALLOWED_DEVELOPER_EMAIL,
    token: sessionToken,
    message: 'Developer superadmin authenticated successfully.'
  });
}
