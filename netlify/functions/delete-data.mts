import { json, verifySession, authorizeBusiness, sessionError } from '../lib/session.mjs';
export default async (request: Request) => {
  if (request.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
  try {
    const session = await verifySession(request);
    const body = await request.json().catch(() => null);
    if (!body?.businessId) return json({ success: false, error: 'BUSINESS_REQUIRED' }, 400);
    await authorizeBusiness(session, body.businessId);
    // The existing authenticated account-deletion workflow performs cloud erasure.
    // Never claim that a request receipt is completed erasure.
    return json({ success: false, status: 'not_completed', error: 'USE_ACCOUNT_DELETION', message: 'Use the authenticated account deletion action in Settings. This endpoint has not erased any data.' }, 409);
  } catch (error) { return sessionError(error); }
};
export const config = { path: '/api/privacy/delete-data' };
