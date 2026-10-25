// Server-Side Developer Superadmin Login API Handler
// Provides constant-time master credential evaluation, rate-limiting, and issues HttpOnly cookies

const ALLOWED_DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || 'pranjalmk62@gmail.com').trim().toLowerCase();
const DEVELOPER_MASTER_SECRET = process.env.DEVELOPER_MASTER_SECRET || process.env.DEVELOPER_PASSWORD || '';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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

  const sessionToken = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
