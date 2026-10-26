import { json } from '../lib/session.mjs';
export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
  const response = json({ success: true });
  for (const name of ['ontap_session_token', 'ontap_session_role', 'ontap_tenant_id', 'ontap_dev_session']) {
    response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`);
  }
  return response;
};
export const config = { path: '/api/auth/logout' };
