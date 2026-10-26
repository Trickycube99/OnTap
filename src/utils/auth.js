import { getApps, getApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
// Auth Abstraction Layer for Restaurant OS & Multi-Tenant Business Architecture
// Supports Developer Superadmin, Distinct Business Owners, Counterperson POS, and Customer Dining

import {
  authenticateBusinessOwner,
  authenticateCounterByPin,
  authenticateStaffMemberByLoginId,
  authenticateDeveloper,
  isDeveloperAuthenticated,
  getActiveBusiness,
  DEVELOPER_CREDENTIALS
} from './businessManager.js';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from './securityValidator.js';

export const ROLES = {
  CUSTOMER: 'customer',
  COUNTER: 'counter',
  ADMIN: 'admin',
  DEVELOPER: 'developer',
  CHEF: 'chef'
};

export const AUTH_STORAGE_KEY = 'flowscape_auth_sessions_v3';

export const ROLE_PERMISSIONS = {
  // Developer can access everything across all tenants
  [ROLES.DEVELOPER]: [ROLES.DEVELOPER, ROLES.ADMIN, ROLES.COUNTER, ROLES.CUSTOMER, ROLES.CHEF],
  // Admin can access: admin, counter, customer
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.COUNTER, ROLES.CUSTOMER, ROLES.CHEF],
  // Counter person can ONLY access: counter, customer (NO ADMIN)
  [ROLES.COUNTER]: [ROLES.COUNTER, ROLES.CUSTOMER],
  [ROLES.CHEF]: [ROLES.CHEF, ROLES.CUSTOMER],
  [ROLES.CUSTOMER]: [ROLES.CUSTOMER]
};

/**
 * Check if an actor role is permitted to access a target role
 */
export function canRoleAccess(actorRole, targetRole) {
  if (targetRole === ROLES.CUSTOMER) return true;
  if (!actorRole) return false;
  if (actorRole === ROLES.DEVELOPER) return true;
  const allowed = ROLE_PERMISSIONS[actorRole];
  return Boolean(allowed && allowed.includes(targetRole));
}

export const ROLE_CONFIGS = {
  [ROLES.CUSTOMER]: {
    id: ROLES.CUSTOMER,
    name: 'Customer (QR Dine-in)',
    shortName: 'Diner',
    badge: 'Diner Check-In',
    securityLevel: 'Guest Table Session & Mobile Loyalty',
    description: 'Browse curated artisanal menu, place contactless table orders, and track live kitchen prep.',
    demoCredentials: null,
    validate: (creds) => {
      if (!creds?.name?.trim()) {
        return { valid: false, error: 'Please enter your diner name to register your table order.' };
      }
      const cleanPhone = (creds?.phone || '').replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number (+91).' };
      }
      return { valid: true };
    },
    createSession: (creds) => ({
      role: ROLES.CUSTOMER,
      name: creds.name.trim(),
      phone: creds.phone.replace(/\D/g, '').slice(-10),
      table: creds.table || 'Table 04',
      loyaltyTier: 'Gold Connoisseur (480 Pts)',
      token: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      authenticatedAt: new Date().toISOString()
    })
  },

  [ROLES.COUNTER]: {
    id: ROLES.COUNTER,
    name: 'Live Counter & POS Terminal',
    shortName: 'Cashier POS',
    badge: 'POS Terminal Guard',
    securityLevel: 'Staff POS Credentials & Secret PIN Verification',
    description: 'Accept live dining orders, apply custom item modifiers, print 80mm thermal receipts, and reconcile EOD cash.',
    demoCredentials: null,
    validate: (creds) => {
      const pin = (creds?.pin || '').toString().trim();
      const loginId = (creds?.loginId || '').trim();

      if (!loginId) {
        return { valid: false, error: 'Please enter your Staff Login ID (e.g. @username.pos).' };
      }

      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return { valid: false, error: 'Staff POS PIN must be 4 to 6 numeric digits.' };
      }

      const rateCheck = checkRateLimit(`login_counter_${loginId}`);
      if (!rateCheck.allowed) {
        return { valid: false, error: rateCheck.error };
      }

      // Cross-organization multi-tenant authentication by Login ID & PIN
      const authRes = authenticateStaffMemberByLoginId(loginId, pin);
      if (!authRes.success) {
        recordFailedAttempt(`login_counter_${loginId}`);
        return { valid: false, error: authRes.error };
      }

      resetRateLimit(`login_counter_${loginId}`);
      return { valid: true, business: authRes.business, resolvedSession: authRes.session };
    },
    createSession: (creds, validationResult = null) => {
      if (validationResult?.resolvedSession) {
        return validationResult.resolvedSession;
      }
      const activeBiz = getActiveBusiness();
      const pin = (creds?.pin || '').toString().trim();
      const isAdminOverride = Boolean(activeBiz?.owner?.pin && activeBiz.owner.pin === pin);
      return {
        role: ROLES.COUNTER,
        businessId: activeBiz.id,
        businessName: activeBiz.name,
        name: isAdminOverride ? `${activeBiz.owner.name} (Admin Override)` : 'Counter Staff',
        terminal: activeBiz.counter.terminalName || 'POS Terminal 01',
        token: `pos_${activeBiz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: isAdminOverride ? ROLES.ADMIN : ROLES.COUNTER
      };
    }
  },

  [ROLES.ADMIN]: {
    id: ROLES.ADMIN,
    name: 'Business Owner Back-Office',
    shortName: 'Owner Admin',
    badge: 'Business Owner Back-Office',
    securityLevel: 'Master Financial Executive Dual-Factor (Owner Only)',
    description: 'Real-time sales KPIs, P&L cash check, HDFC bank CSV reconciliation, automated payroll batches, and accounting exports.',
    demoCredentials: null,
    validate: (creds) => {
      const email = (creds?.email || '').trim().toLowerCase();
      if (!email.includes('@') || !email.includes('.')) {
        return { valid: false, error: 'Please enter a valid owner executive email address.' };
      }
      const pin = (creds?.pin || '').toString().trim();
      if (!pin || !/^\d{6}$/.test(pin)) {
        return { valid: false, error: 'Please enter your 6-digit Owner Master PIN.' };
      }

      const rateCheck = checkRateLimit(`login_admin_${email}`);
      if (!rateCheck.allowed) {
        return { valid: false, error: rateCheck.error };
      }

      // Authenticate against multi-tenant business database
      const authRes = authenticateBusinessOwner(email, pin);
      if (!authRes.success) {
        recordFailedAttempt(`login_admin_${email}`);
        return { valid: false, error: authRes.error };
      }

      resetRateLimit(`login_admin_${email}`);
      return { valid: true, business: authRes.business, resolvedSession: authRes.session };
    },
    createSession: (creds, validationResult = null) => {
      if (validationResult?.resolvedSession) {
        return validationResult.resolvedSession;
      }
      const activeBiz = getActiveBusiness();
      return {
        role: ROLES.ADMIN,
        businessId: activeBiz.id,
        businessName: activeBiz.name,
        name: activeBiz.owner.name,
        email: activeBiz.owner.email,
        branch: activeBiz.city,
        token: `admin_${activeBiz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: ROLES.ADMIN
      };
    }
  },

  [ROLES.DEVELOPER]: {
    id: ROLES.DEVELOPER,
    name: 'Developer Superadmin Infrastructure',
    shortName: 'Developer Console',
    badge: 'Platform Root Access',
    securityLevel: 'Master Developer Root Authentication',
    description: 'Manage all tenant businesses, provision new business accounts, monitor real-time platform telemetry and database partitions.',
    demoCredentials: null,
    validate: (creds) => {
      const email = (creds?.email || '').trim().toLowerCase();
      const password = (creds?.password || creds?.pin || '').trim();

      const rateCheck = checkRateLimit(`login_dev_${email}`);
      if (!rateCheck.allowed) {
        return { valid: false, error: rateCheck.error };
      }

      const authRes = authenticateDeveloper(email, password);
      if (!authRes.success) {
        recordFailedAttempt(`login_dev_${email}`);
        return { valid: false, error: authRes.error };
      }

      resetRateLimit(`login_dev_${email}`);
      return { valid: true, resolvedSession: authRes.session };
    },
    createSession: (creds, validationResult = null) => {
      if (validationResult?.resolvedSession) {
        return validationResult.resolvedSession;
      }
      return {
        role: ROLES.DEVELOPER,
        name: DEVELOPER_CREDENTIALS.name,
        email: DEVELOPER_CREDENTIALS.email,
        token: `dev_${Date.now()}`,
        authenticatedAt: new Date().toISOString()
      };
    }
  },

  [ROLES.CHEF]: {
    id: ROLES.CHEF,
    name: 'Verified Executive Chef',
    shortName: 'Chef Story',
    badge: 'Culinary Master Audit',
    securityLevel: 'FSSAI Licensee & Culinary Master Passkey',
    description: 'Verify FSSAI laboratory audits, culinary provenance certifications, and curate signature menu items.',
    demoCredentials: null,
    validate: () => ({ valid: true }),
    createSession: () => ({
      role: ROLES.CHEF,
      name: 'Executive Chef',
      title: 'Culinary Director',
      fssaiLicense: '',
      token: `chef_${Date.now()}`,
      authenticatedAt: new Date().toISOString()
    })
  }
};

// Initial default sessions for clean zero-slate startup
export const INITIAL_DEFAULT_SESSIONS = {
  [ROLES.CUSTOMER]: null,
  [ROLES.CHEF]: null,
  [ROLES.COUNTER]: null,
  [ROLES.ADMIN]: null,
  [ROLES.DEVELOPER]: null
};

/**
 * Load all stored authentication sessions (Strictly scoped to browser tab lifetime via sessionStorage)
 * Ensures that whenever the tab or browser is closed completely, all credentials & sessions are erased,
 * requiring staff and admin to log in again on next visit.
 */
export function getStoredSessions() {
  try {
    // Purge any legacy localStorage session keys so sessions NEVER persist across browser closures
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('flowscape_auth_sessions_v1');
      localStorage.removeItem('flowscape_auth_sessions_v2');
      localStorage.removeItem('flowscape_auth_sessions_v3');
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    if (typeof sessionStorage === 'undefined') {
      return INITIAL_DEFAULT_SESSIONS;
    }
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_SESSIONS));
      return INITIAL_DEFAULT_SESSIONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading auth sessions:', err);
    return INITIAL_DEFAULT_SESSIONS;
  }
}

/**
 * Save sessions map to sessionStorage (Erased automatically when browser or tab is closed)
 */
export function saveStoredSessions(sessions) {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessions));
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Error saving auth sessions:', err);
  }
}

/**
 * Cookie Management for Server-Side Route Middleware Synchronization
 */
export function setAuthCookie(token, role, businessId = '') {
  if (typeof document === 'undefined') return;
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  const maxAge = 86400; // 24 hours
  document.cookie = `ontap_session_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Strict${secureFlag}`;
  document.cookie = `ontap_session_role=${encodeURIComponent(role)}; path=/; max-age=${maxAge}; SameSite=Strict${secureFlag}`;
  if (businessId) {
    document.cookie = `ontap_tenant_id=${encodeURIComponent(businessId)}; path=/; max-age=${maxAge}; SameSite=Strict${secureFlag}`;
  }
}

export function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  const isSecure = window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `ontap_session_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${secureFlag}`;
  document.cookie = `ontap_session_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${secureFlag}`;
  document.cookie = `ontap_tenant_id=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${secureFlag}`;
}

/**
 * Check if a specific role is currently authenticated in this browser tab session.
 * STRICT IDOR PROTECTION: If targetBusinessId is provided, validates that the user's
 * session businessId matches the requested record before granting access.
 */
export function isAuthenticated(role, targetBusinessId = null) {
  if (role === ROLES.CUSTOMER || role === ROLES.CHEF) {
    return true;
  }
  if (role === ROLES.DEVELOPER) {
    return isDeveloperAuthenticated();
  }

  // Developer Superadmin has master clearance to inspect any role only when verified in this session
  if (isDeveloperAuthenticated()) {
    return true;
  }

  const sessions = getStoredSessions();
  if (!sessions) return false;

  const cleanTargetBizId = targetBusinessId ? String(targetBusinessId).trim() : null;

  // 1. Admin Master session check:
  if (sessions[ROLES.ADMIN] && sessions[ROLES.ADMIN].token) {
    const adminBizId = sessions[ROLES.ADMIN].businessId;
    // If targetBusinessId is specified, STRICTLY reject IDOR cross-tenant access!
    if (cleanTargetBizId && adminBizId && adminBizId !== cleanTargetBizId) {
      console.warn(`🛡️ [IDOR Defense] Blocked Admin access: Session biz "${adminBizId}" does not own target "${cleanTargetBizId}"`);
      return false;
    }
    if (role === ROLES.ADMIN || role === ROLES.COUNTER) {
      return true;
    }
  }

  // 2. Switched from Admin state:
  if (
    (role === ROLES.ADMIN || role === ROLES.COUNTER) &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('flowscape_switched_from_admin') === 'true' &&
    Boolean(sessions[ROLES.ADMIN]?.token)
  ) {
    const adminBizId = sessions[ROLES.ADMIN]?.businessId;
    if (cleanTargetBizId && adminBizId && adminBizId !== cleanTargetBizId) {
      return false;
    }
    return true;
  }

  // 3. Counter staff session check:
  if (role === ROLES.COUNTER && sessions[ROLES.COUNTER] && sessions[ROLES.COUNTER].token) {
    const counterBizId = sessions[ROLES.COUNTER].businessId;
    // Strict IDOR ownership check for Counter staff
    if (cleanTargetBizId && counterBizId && counterBizId !== cleanTargetBizId) {
      console.warn(`🛡️ [IDOR Defense] Blocked Counter access: Staff terminal biz "${counterBizId}" does not match target "${cleanTargetBizId}"`);
      return false;
    }
    return true;
  }

  // 4. Direct session token check for requested role:
  if (sessions[role] && sessions[role].token) {
    if (cleanTargetBizId && sessions[role].businessId && sessions[role].businessId !== cleanTargetBizId) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Retrieve active session data for a specific role (strictly isolated by tab session)
 */
export function getSession(role) {
  const sessions = getStoredSessions();
  if (!sessions || !sessions[role]) return null;
  return sessions[role];
}

/**
 * Authenticate and issue a new session for a role
 */
export function authenticateRole(role, credentials) {
  if (import.meta.env.PROD && role !== ROLES.CUSTOMER) {
    return { success: false, error: 'A verified online staff account is required.' };
  }
  const config = ROLE_CONFIGS[role];
  if (!config) {
    return { success: false, error: `Invalid role: ${role}` };
  }

  const validation = config.validate(credentials);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const session = config.createSession(credentials, validation);
  const currentSessions = getStoredSessions();
  currentSessions[role] = session;

  // When directly logging into counter POS, strictly clear any admin session and switched-from-admin state
  if (role === ROLES.COUNTER) {
    currentSessions[ROLES.ADMIN] = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('flowscape_switched_from_admin');
    }
  }

  saveStoredSessions(currentSessions);

  // Sync auth state to HTTP cookies for server-side route middleware
  setAuthCookie(session.token || `auth_${Date.now()}`, role, session.businessId || '');

  return { success: true, session, business: validation.business };
}

/**
 * Complete Session Invalidation & Logout:
 * 1. Revokes session/token in memory and sessionStorage
 * 2. Revokes session on Firebase backend auth provider (signOut)
 * 3. Clears all auth cookies (SameSite=Strict, Secure)
 * 4. Wipes local tokens and BFCache keys
 */
export function logoutRole(role) {
  if (getApps().length) signOut(getAuth(getApp())).catch(() => {});
  const currentSessions = getStoredSessions();
  if (currentSessions && currentSessions[role]) {
    currentSessions[role] = null;
    saveStoredSessions(currentSessions);
  }

  // Clear HTTP cookies so server-side route middleware immediately rejects protected requests
  clearAuthCookies();

  if (role === ROLES.DEVELOPER) {
    logoutDeveloper();
  }
  if (role === ROLES.COUNTER) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('counter_active_staff_id');
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('counter_active_staff_id');
      }
    } catch {}
  }

  // Complete Backend Invalidation: Sign out from Firebase Auth
  try {
    import('./firebaseAuth.js').then(({ getFirebaseAuth }) => {
      const auth = getFirebaseAuth();
      if (auth && auth.currentUser) {
        import('firebase/auth').then(({ signOut }) => {
          signOut(auth).catch((err) => console.debug('[Auth Logout] Firebase signOut notice:', err));
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  // Server-Side Edge Session Revocation
  if (typeof fetch !== 'undefined') {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }

  // Broadcast logout event so all other tabs drop cached state immediately
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('flowscape_auth_logout', { detail: { role } }));
    } catch {}
  }

  return true;
}

/**
 * Reset all role sessions to defaults and invalidate backend credentials completely
 */
export function resetAllSessions() {
  if (getApps().length) signOut(getAuth(getApp())).catch(() => {});
  saveStoredSessions(INITIAL_DEFAULT_SESSIONS);
  clearAuthCookies();

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('counter_active_staff_id');
      sessionStorage.removeItem('flowscape_switched_from_admin');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('counter_active_staff_id');
    }
  } catch {}

  try {
    import('./firebaseAuth.js').then(({ getFirebaseAuth }) => {
      const auth = getFirebaseAuth();
      if (auth && auth.currentUser) {
        import('firebase/auth').then(({ signOut }) => {
          signOut(auth).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  if (typeof fetch !== 'undefined') {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }
}
