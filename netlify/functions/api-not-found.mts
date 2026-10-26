import { json } from '../lib/session.mjs';
export default async () => json({ error: 'NOT_FOUND' }, 404);
