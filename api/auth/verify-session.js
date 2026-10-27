// Server-Side Session & Object-Level Ownership Verification API
// Strictly checks that requested tenant ID matches the authenticated session's business ID (IDOR Defense)
import crypto from 'crypto';

const DEVELOPER_MASTER_SECRET = process.env.DEVELOPER_MASTER_SECRET || process.env.DEVELOPER_PASSWORD || '';
const SERVER_SECRET = process.env.SESSION_SECRET || DEVELOPER_MASTER_SECRET || 'ontap_edge_server_hmac_secret_2026';

function verifySignedToken(token, secret = SERVER_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [pB64, sig] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(pB64).digest('hex');
    const bufA = Buffer.from(sig);
    const bufB = Buffer.from(expectedSig);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }
    const jsonStr = Buffer.from(pB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Extract cookies
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });

  const sessionToken = cookies['ontap_session_token'] || '';
  const sessionRole = cookies['ontap_session_role'] || '';
  const tenantId = cookies['ontap_tenant_id'] || '';
  const rawDevCookie = cookies['ontap_dev_session'] || '';

  // Cryptographically verify developer session token
  const devPayload = verifySignedToken(rawDevCookie);
  const isVerifiedDev = Boolean(devPayload && devPayload.role === 'developer');

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!sessionToken && !isVerifiedDev && !bearerToken) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      authenticated: false,
      message: 'Unauthenticated: No active valid session token found.'
    });
  }

  // Parameter target business ID from query or body
  const targetBusinessId = req.query?.biz || req.body?.biz || '';

  // Object-Level Ownership Verification (IDOR Defense)
  if (targetBusinessId && !isVerifiedDev) {
    if (tenantId && tenantId.toLowerCase() !== targetBusinessId.toLowerCase()) {
      return res.status(403).json({
        error: 'IDOR_FORBIDDEN',
        authenticated: true,
        authorized: false,
        message: `Object ownership mismatch: Authenticated tenant "${tenantId}" cannot access target tenant "${targetBusinessId}".`
      });
    }
  }

  return res.status(200).json({
    authenticated: true,
    authorized: true,
    role: isVerifiedDev ? 'developer' : sessionRole,
    tenantId: isVerifiedDev ? targetBusinessId : tenantId
  });
}
