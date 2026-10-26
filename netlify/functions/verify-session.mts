import { verifySession, authorizeBusiness, json, sessionError } from '../lib/session.mjs';

export default async (request: Request) => {
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET' });
  try {
    const session = await verifySession(request);
    const businessId = new URL(request.url).searchParams.get('biz') || session.payload.businessId;
    if (businessId) await authorizeBusiness(session, businessId);
    return json({ authenticated: true, authorized: true, role: session.role, tenantId: businessId || null });
  } catch (error) { return sessionError(error); }
};
export const config = { path: '/api/auth/verify-session' };
