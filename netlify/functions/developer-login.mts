import { json } from '../lib/session.mjs';
export default async () => json({ success: false, error: 'VERIFIED_ACCOUNT_REQUIRED', message: 'Sign in with a verified Firebase account assigned the developer role.' }, 410);
export const config = { path: '/api/auth/developer-login' };
