import { json } from '../lib/session.mjs';
export default async () => {
  const configured = [['VITE_FIREBASE_API_KEY', 'apiKey'], ['VITE_FIREBASE_PROJECT_ID', 'projectId'], ['VITE_FIREBASE_AUTH_DOMAIN', 'authDomain']].every(names => names.some(name => Boolean(Netlify.env.get(name))));
  return json({ status: configured ? 'configured' : 'setup_required', configurationPresent: configured, operationalReadinessVerified: false }, configured ? 200 : 503);
};
export const config = { path: '/api/health' };
