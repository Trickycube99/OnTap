import { createRemoteJWKSet, jwtVerify } from 'jose';

export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private', ...headers } });
}

export function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  const cookie = (request.headers.get('cookie') || '').split(';').find(part => part.trim().startsWith('ontap_session_token='));
  try { return cookie ? decodeURIComponent(cookie.trim().slice('ontap_session_token='.length)) : ''; }
  catch { return ''; }
}

export async function verifySession(request) {
  const projectId = (Netlify.env.get('VITE_FIREBASE_PROJECT_ID') || Netlify.env.get('projectId'));
  if (!projectId) throw new Error('NOT_CONFIGURED');
  const token = getBearerToken(request);
  if (!token) throw new Error('UNAUTHORIZED');
  const payload = await verifyFirebaseToken(token, projectId);
  if (!payload.sub || payload.email_verified !== true) throw new Error('UNAUTHORIZED');
  const role = payload.role === 'developer' ? 'developer' : payload.role === 'counter' ? 'counter' : payload.role === 'chef' ? 'chef' : 'admin';
  return { payload, role, token, projectId };
}

export async function authorizeBusiness(session, businessId) {
  if (!businessId || !/^[a-zA-Z0-9_-]{1,128}$/.test(businessId)) throw new Error('FORBIDDEN');
  if (session.role === 'developer') return;
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(session.projectId)}/databases/(default)/documents/businesses/${encodeURIComponent(businessId)}`, {
    headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('FORBIDDEN');
  const { fields } = await response.json();
  if (fields?.status?.stringValue !== 'active') throw new Error('FORBIDDEN');
  const ownerEmail = fields?.owner?.mapValue?.fields?.email?.stringValue;
  const isOwner = ownerEmail && ownerEmail.toLowerCase() === session.payload.email?.toLowerCase();
  const isStaff = ['counter', 'chef'].includes(session.role) && session.payload.businessId === businessId;
  if (!isOwner && !isStaff) throw new Error('FORBIDDEN');
}

export function sessionError(error) {
  if (error.message === 'NOT_CONFIGURED') return json({ authenticated: false, error: 'SERVICE_UNAVAILABLE' }, 503);
  if (error.message === 'FORBIDDEN') return json({ authenticated: true, authorized: false, error: 'FORBIDDEN' }, 403);
  return json({ authenticated: false, error: 'UNAUTHORIZED' }, 401);
}


function firebaseKeys() {
  firebaseKeys.cached ||= createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  return firebaseKeys.cached;
}

export async function verifyFirebaseToken(token, projectId, keys = firebaseKeys()) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (!payload.sub || payload.email_verified !== true) throw new Error('UNAUTHORIZED');
  return payload;
}
