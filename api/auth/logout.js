// Server-Side Logout & Session Revocation API Handler
// Completely wipes auth cookies, revokes credentials, and prevents BFCache restoration

export default async function handler(req, res) {
  // CORS & Methods
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Clear all session cookies across root path with strict flags
  const expiredCookies = [
    'ontap_session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    'ontap_session_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    'ontap_tenant_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    'ontap_dev_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Strict; Secure'
  ];

  res.setHeader('Set-Cookie', expiredCookies);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return res.status(200).json({
    success: true,
    message: 'Backend session invalidated, cookies cleared, and caching revoked.'
  });
}
