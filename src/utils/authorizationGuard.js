// Object-Level Ownership & IDOR Protection Guard
// Enforces strict tenant isolation and prevents Broken Object-Level Authorization (BOLA/IDOR)
// Ensures users can NEVER access, mutate, or subscribe to another business's data by tampering with parameter IDs

import { getStoredSessions, ROLES } from './auth';
import { isDeveloperAuthenticated } from './businessManager';

export class AuthorizationError extends Error {
  constructor(message, code = 'IDOR_VIOLATION') {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
  }
}

/**
 * Validate that the current session owns or has authorized access to targetBusinessId
 * @param {string} targetBusinessId - The business ID being accessed
 * @param {string} requiredRole - The role context ('admin', 'counter', 'customer', 'developer')
 * @returns {{ authorized: boolean, reason?: string, resolvedBusinessId: string }}
 */
export function validateTenantOwnership(targetBusinessId, requiredRole = null) {
  const cleanTargetId = (targetBusinessId || '').trim();

  // 1. Developer Superadmin has root access across all tenants ONLY when verified
  if (isDeveloperAuthenticated()) {
    return {
      authorized: true,
      resolvedBusinessId: cleanTargetId,
      actorRole: ROLES.DEVELOPER
    };
  }

  const sessions = getStoredSessions();

  // 2. Customer context: Customers order through verified table QR sessions
  if (requiredRole === ROLES.CUSTOMER || (!requiredRole && !sessions.admin && !sessions.counter)) {
    return {
      authorized: Boolean(cleanTargetId),
      resolvedBusinessId: cleanTargetId,
      actorRole: ROLES.CUSTOMER
    };
  }

  // 3. Admin Owner context: Strictly validate that active admin session businessId matches target
  if (requiredRole === ROLES.ADMIN || sessions.admin?.token) {
    const adminBizId = sessions.admin?.businessId;
    if (!adminBizId) {
      return {
        authorized: false,
        reason: 'Unauthenticated: No active admin session found.',
        resolvedBusinessId: ''
      };
    }

    if (cleanTargetId && adminBizId !== cleanTargetId) {
      console.error(
        `🚨 [SECURITY ALERT] IDOR Attempt Blocked: Admin user (owned biz: "${adminBizId}") attempted unauthorized access to tenant: "${cleanTargetId}"`
      );
      return {
        authorized: false,
        reason: `IDOR_FORBIDDEN: You do not have ownership permission to access tenant "${cleanTargetId}".`,
        resolvedBusinessId: adminBizId // Lock down to owned business only
      };
    }

    return {
      authorized: true,
      resolvedBusinessId: adminBizId,
      actorRole: ROLES.ADMIN
    };
  }

  // 4. Counter Staff POS context: Strictly validate that counter session businessId matches target
  if (requiredRole === ROLES.COUNTER || sessions.counter?.token) {
    const counterBizId = sessions.counter?.businessId;
    if (!counterBizId) {
      return {
        authorized: false,
        reason: 'Unauthenticated: No active counter staff session found.',
        resolvedBusinessId: ''
      };
    }

    if (cleanTargetId && counterBizId !== cleanTargetId) {
      console.error(
        `🚨 [SECURITY ALERT] IDOR Attempt Blocked: Counter staff (terminal biz: "${counterBizId}") attempted unauthorized access to tenant: "${cleanTargetId}"`
      );
      return {
        authorized: false,
        reason: `IDOR_FORBIDDEN: You do not have staff authorization to access tenant "${cleanTargetId}".`,
        resolvedBusinessId: counterBizId // Lock down to authorized terminal business only
      };
    }

    return {
      authorized: true,
      resolvedBusinessId: counterBizId,
      actorRole: ROLES.COUNTER
    };
  }

  return {
    authorized: false,
    reason: 'Unauthenticated session: Access rejected.',
    resolvedBusinessId: ''
  };
}

/**
 * Strict Assertion: Throws AuthorizationError if ownership check fails
 */
export function assertTenantOwnership(targetBusinessId, requiredRole = null) {
  const check = validateTenantOwnership(targetBusinessId, requiredRole);
  if (!check.authorized) {
    throw new AuthorizationError(check.reason || 'Forbidden: Object ownership mismatch.');
  }
  return check.resolvedBusinessId;
}

/**
 * Sanitize URL / Request parameter business ID against active authenticated session.
 * Prevents URL tampering like `?biz=victim_restaurant` from overriding authenticated session.
 */
export function sanitizeTenantParameter(paramBizId, fallbackDefaultId = '') {
  if (isDeveloperAuthenticated()) {
    return paramBizId || fallbackDefaultId;
  }

  const sessions = getStoredSessions();
  const activeSessionBizId = sessions.admin?.businessId || sessions.counter?.businessId;

  // If user is authenticated as owner or counter staff, FORCE their own business ID
  if (activeSessionBizId) {
    if (paramBizId && paramBizId !== activeSessionBizId) {
      console.warn(
        `🛡️ [IDOR Defense] Overriding tampered URL parameter "${paramBizId}" with authenticated session tenant "${activeSessionBizId}".`
      );
    }
    return activeSessionBizId;
  }

  // For unauthenticated guest diners scanning QR codes:
  return paramBizId || fallbackDefaultId;
}
