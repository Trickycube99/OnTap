import { onIdTokenChanged } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseAuth';
import { getStoredSessions, saveStoredSessions, setAuthCookie, clearAuthCookies } from './auth';

/** Refresh short-lived Firebase tokens rather than keeping an expired API cookie. */
export function startSessionRefresh() {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  return onIdTokenChanged(auth, async user => {
    if (!user || user.isAnonymous) { clearAuthCookies(); return; }
    try {
      const result = await user.getIdTokenResult();
      const sessions = getStoredSessions();
      let activeSession = null;
      for (const role of ['admin', 'counter']) {
        const session = sessions[role];
        if (session?.email === user.email) {
          session.token = result.token;
          activeSession = session;
        }
      }
      saveStoredSessions(sessions);
      if (activeSession) setAuthCookie(result.token, activeSession.role, activeSession.businessId);
      const storedDeveloper = sessionStorage.getItem('flowscape_dev_session_v1');
      if (storedDeveloper && result.claims.role === 'developer') {
        const session = JSON.parse(storedDeveloper);
        if (session.email === user.email) {
          session.token = result.token;
          sessionStorage.setItem('flowscape_dev_session_v1', JSON.stringify(session));
          setAuthCookie(result.token, 'developer');
        }
      }
    } catch { clearAuthCookies(); }
  });
}
