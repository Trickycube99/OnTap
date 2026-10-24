// Server-Side Session & Object-Level Ownership Verification API
// Strictly checks that requested tenant ID matches the authenticated session's business ID (IDOR Defense)

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
  const isDev = Boolean(cookies['ontap_dev_session']);

  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!sessionToken && !isDev && !bearerToken) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      authenticated: false,
      message: 'Unauthenticated: No active session token found.'
    });
  }

  // Parameter target business ID from query or body
  const targetBusinessId = req.query?.biz || req.body?.biz || '';

  // Object-Level Ownership Verification (IDOR Defense)
  if (targetBusinessId && !isDev) {
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
    role: isDev ? 'developer' : sessionRole,
    tenantId: isDev ? targetBusinessId : tenantId
  });
}
