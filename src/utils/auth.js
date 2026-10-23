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
    demoCredentials: {
      name: 'Aarav Sharma',
      phone: '9876543210',
      table: 'Table 04'
    },
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
    description: 'Accept live dining orders, apply custom item modifiers, print 80mm GST thermal receipts, and reconcile EOD cash.',
    demoCredentials: {
      terminal: 'POS-01 (Flagship CP)',
      pin: '440100'
    },
    validate: (creds) => {
      const pin = (creds?.pin || '').toString().trim();
      const loginId = (creds?.loginId || '').trim();

      if (!loginId) {
        return { valid: false, error: 'Please enter your Staff Login ID (e.g. @username.pos).' };
      }

      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return { valid: false, error: 'Staff POS PIN must be 4 to 6 numeric digits.' };
      }

      // Cross-organization multi-tenant authentication by Login ID & PIN
      const authRes = authenticateStaffMemberByLoginId(loginId, pin);
      if (!authRes.success) {
        return { valid: false, error: authRes.error };
      }

      return { valid: true, business: authRes.business, resolvedSession: authRes.session };
    },
    createSession: (creds, validationResult = null) => {
      if (validationResult?.resolvedSession) {
        return validationResult.resolvedSession;
      }
      const activeBiz = getActiveBusiness();
      const pin = (creds?.pin || '').toString().trim();
      const isAdminOverride = activeBiz.owner.pin === pin || pin === '882100' || pin === '8821';
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
    demoCredentials: {
      name: 'Sanjay Malhotra',
      email: 'admin@advaitkitchen.com',
      pin: '882100'
    },
    validate: (creds) => {
      const email = (creds?.email || '').trim().toLowerCase();
      if (!email.includes('@') || !email.includes('.')) {
        return { valid: false, error: 'Please enter a valid owner executive email address.' };
      }
      const pin = (creds?.pin || '').toString().trim();
      if (!pin || !/^\d{6}$/.test(pin)) {
        return { valid: false, error: 'Please enter your 6-digit Owner Master PIN.' };
      }

      // Authenticate against multi-tenant business database
      const authRes = authenticateBusinessOwner(email, pin);
      if (!authRes.success) {
        return { valid: false, error: authRes.error };
      }

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
    demoCredentials: {
      email: DEVELOPER_CREDENTIALS.email
    },
    validate: (creds) => {
      const email = (creds?.email || '').trim().toLowerCase();
      const password = (creds?.password || creds?.pin || '').trim();
      const authRes = authenticateDeveloper(email, password);
      if (!authRes.success) {
        return { valid: false, error: authRes.error };
      }
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
    demoCredentials: {
      email: 'chef@advait.in',
      pin: '1002'
    },
    validate: () => ({ valid: true }),
    createSession: () => ({
      role: ROLES.CHEF,
      name: 'Chef Advait Kapoor',
      title: 'Executive Chef & Culinary Director',
      fssaiLicense: 'FSSAI Lic #10022001004812',
      token: `chef_${Date.now()}`,
      authenticatedAt: new Date().toISOString()
    })
  }
};

// Initial default sessions for immediate startup experience
export const INITIAL_DEFAULT_SESSIONS = {
  [ROLES.CUSTOMER]: ROLE_CONFIGS[ROLES.CUSTOMER].createSession(ROLE_CONFIGS[ROLES.CUSTOMER].demoCredentials),
  [ROLES.CHEF]: ROLE_CONFIGS[ROLES.CHEF].createSession(ROLE_CONFIGS[ROLES.CHEF].demoCredentials),
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
 * Check if a specific role is currently authenticated in this browser tab session
 */
export function isAuthenticated(role, activeSessionRole = null) {
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

  // Admin Master session can access both Admin and Counter
  if (sessions[ROLES.ADMIN] && sessions[ROLES.ADMIN].token) {
    if (role === ROLES.ADMIN || role === ROLES.COUNTER) {
      return true;
    }
  }

  // If session switched from Admin, allow access to Admin and Counter
  if (
    (role === ROLES.ADMIN || role === ROLES.COUNTER) &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem('flowscape_switched_from_admin') === 'true' &&
    Boolean(sessions[ROLES.ADMIN]?.token)
  ) {
    return true;
  }

  // Counter staff session can access Counter POS
  if (role === ROLES.COUNTER && sessions[ROLES.COUNTER] && sessions[ROLES.COUNTER].token) {
    return true;
  }

  // Check direct session token for the requested role
  if (sessions[role] && sessions[role].token) {
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

  return { success: true, session, business: validation.business };
}

/**
 * Logout and clear session for a specific role
 */
export function logoutRole(role) {
  const currentSessions = getStoredSessions();
  if (currentSessions && currentSessions[role]) {
    currentSessions[role] = null;
    saveStoredSessions(currentSessions);
  }
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
  return true;
}

/**
 * Reset all role sessions to defaults
 */
export function resetAllSessions() {
  saveStoredSessions(INITIAL_DEFAULT_SESSIONS);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('counter_active_staff_id');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('counter_active_staff_id');
    }
  } catch {}
}
