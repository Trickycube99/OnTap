import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { getBearerToken, verifySession, verifyFirebaseToken, authorizeBusiness } from '../netlify/lib/session.mjs';

test('cookie role flags cannot authenticate a session', async () => {
  globalThis.Netlify = { env: { get: () => 'test-project' } };
  const request = new Request('https://example.test/api/auth/verify-session', { headers: { Cookie: 'ontap_dev_session=forged; ontap_session_role=developer' } });
  assert.equal(getBearerToken(request), '');
  await assert.rejects(verifySession(request), /UNAUTHORIZED/);
});
test('malformed cookie is treated as unauthenticated', () => {
  assert.equal(getBearerToken(new Request('https://example.test', { headers: { Cookie: 'ontap_session_token=%ZZ' } })), '');
});
test('session signature, project, expiry, and verification are validated', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const sign = async (changes = {}, audience = 'test-project', expiration = '1h') => new SignJWT({ email_verified: true, ...changes })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer('https://securetoken.google.com/test-project')
    .setAudience(audience).setSubject('test-user').setIssuedAt().setExpirationTime(expiration).sign(privateKey);
  assert.equal((await verifyFirebaseToken(await sign(), 'test-project', publicKey)).sub, 'test-user');
  await assert.rejects(verifyFirebaseToken(await sign({}, 'other-project'), 'test-project', publicKey));
  await assert.rejects(verifyFirebaseToken(await sign({}, 'test-project', '-1h'), 'test-project', publicKey));
  await assert.rejects(verifyFirebaseToken(await sign({ email_verified: false }), 'test-project', publicKey));
  const { publicKey: wrongKey } = await generateKeyPair('RS256');
  await assert.rejects(verifyFirebaseToken(await sign(), 'test-project', wrongKey));
});
test('business authorization rejects a mismatched owner and suspended tenants', async () => {
  const originalFetch = globalThis.fetch;
  const session = { role: 'admin', projectId: 'test-project', token: 'fixture', payload: { email: 'other@example.test' } };
  try {
    globalThis.fetch = async () => Response.json({ fields: { status: { stringValue: 'active' }, owner: { mapValue: { fields: { email: { stringValue: 'owner@example.test' } } } } } });
    await assert.rejects(authorizeBusiness(session, 'restaurant_test'), /FORBIDDEN/);
    session.payload.email = 'owner@example.test';
    await assert.doesNotReject(authorizeBusiness(session, 'restaurant_test'));
    globalThis.fetch = async () => Response.json({ fields: { status: { stringValue: 'suspended' } } });
    await assert.rejects(authorizeBusiness(session, 'restaurant_test'), /FORBIDDEN/);
  } finally { globalThis.fetch = originalFetch; }
});
