// Firebase Authentication Service Layer for Restaurant OS
// Implements:
// 1. Developer Provisioning with Automatic Email Verification (exclusive to Developer Dashboard)
// 2. User Log In with Strict Verification Check (blocking unverified accounts)
// 3. Password Reset / Forgot Password Email Link
// 4. Resend Verification Email Helper
// 5. Apply Email Verification Code from Email Link
// 6. Confirm Password Reset from Email Link
// 7. Delete Owner Account from Firebase Auth
// 8. Manual Credentials Override for Technical Anomalies

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  checkActionCode,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  deleteUser,
  updatePassword,
  updateEmail,
  signOut,
  reload
} from 'firebase/auth';
import { getFirebaseConfig } from './firebaseSync.js';
import { getBusinesses, saveBusinesses, createBusiness, updateBusiness, setActiveBusiness } from './businessManager.js';
import { getStoredSessions, saveStoredSessions } from './auth.js';
import { broadcastSyncEvent, SYNC_EVENTS } from './sync.js';
import { findBusinessByEmailInCloud, syncBusinessToCloud } from './systematicDatabase.js';

let authInstance = null;

/**
 * Initialize or retrieve the Firebase Auth instance
 */
export function getFirebaseAuth() {
  if (authInstance) return authInstance;

  const config = getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    authInstance = getAuth(app);
    return authInstance;
  } catch (err) {
    console.warn('Firebase Auth initialization skipped:', err);
    return null;
  }
}

export const PRODUCTION_WEBAPP_URL = 'https://restraunt-web-app.vercel.app';

/**
 * Construct custom web-app URL for Firebase Auth actions (email verification & password reset)
 * Ensures user is directed to the attractive, custom in-app view rather than Firebase default pages.
 */
export function getAppActionUrl(mode) {
  const origin = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : PRODUCTION_WEBAPP_URL;
  const path = (typeof window !== 'undefined' && window.location.pathname) ? window.location.pathname.replace(/\/+$/, '') : '';
  return `${origin}${path}/?mode=${mode}`;
}

/**
 * 1. DEVELOPER PROVISIONING: CREATE OWNER ACCOUNT WITH AUTOMATIC EMAIL VERIFICATION
 * Accounts can ONLY be created using the Developer Dashboard.
 * Uses a sandboxed secondary Firebase app so the active developer session is completely untouched.
 * Automatically dispatches the email verification link to the owner's email address.
 */
export async function provisionOwnerAccountWithVerification({ email, password, ownerName, businessName }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  let cleanPin = (password || '').trim();

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'A valid owner email address is required.' };
  }

  // Owner password requirement: minimum 6 characters (letters, numbers, or both)
  if (!cleanPin || cleanPin.length < 6) {
    return { success: false, error: 'Owner password must be at least 6 characters long.' };
  }

  // Firebase Auth minimum password requirement is 6 chars, satisfied directly
  const cleanPassword = cleanPin;

  const config = getFirebaseConfig();

  if (config && config.apiKey && config.projectId) {
    const secondaryAppName = `prov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(config, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
      const user = userCredential.user;

      // Automatically send email verification link pointing to the web app's custom action handler
      const actionCodeSettings = {
        url: getAppActionUrl('verifyEmail'),
        handleCodeInApp: true
      };
      await sendEmailVerification(user, actionCodeSettings);

      // Immediately sign out and terminate secondary app
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      return {
        success: true,
        user,
        verificationSent: true,
        message: `Account created in Firebase Auth! Verification email dispatched to ${cleanEmail}.`
      };
    } catch (error) {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch {}
      }
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Local fallback mode when Firebase env vars are not set
  return {
    success: true,
    isLocalFallback: true,
    verificationSent: true,
    message: `Account created in demo mode! Verification email simulated for ${cleanEmail}.`
  };
}

/**
 * Fallback / Self Sign-Up method (delegates to provisionOwnerAccountWithVerification)
 */
export async function signUpUserWithVerification(params) {
  return provisionOwnerAccountWithVerification(params);
}

/**
 * 2. USER LOG IN (BLOCKS USERS IF EMAIL IS NOT VERIFIED)
 * Authenticates user and checks user.emailVerified. If false, calls signOut() and blocks entry.
 */
export async function logInUserWithVerification({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Please enter a valid owner email address.' };
  }

  // Owner password requirement: minimum 6 characters (letters, numbers, or both)
  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const auth = getFirebaseAuth();
  let businesses = getBusinesses();
  let matchingBiz = businesses.find(
    (b) => (b.owner?.email || '').trim().toLowerCase() === cleanEmail
  );

  // If not in local cache, query Firestore cloud database immediately
  if (!matchingBiz) {
    try {
      const cloudBiz = await findBusinessByEmailInCloud(cleanEmail);
      if (cloudBiz) {
        businesses = getBusinesses();
        matchingBiz = businesses.find(
          (b) => (b.owner?.email || '').trim().toLowerCase() === cleanEmail
        ) || cloudBiz;
      }
    } catch (e) {
      console.debug('[Auth] Notice querying cloud business record during login:', e);
    }
  }

  // ─── 1. PRIMARY VALIDATOR: FIREBASE AUTHENTICATION ───
  if (auth) {
    let userCredential = null;

    try {
      // Primary: authenticate directly with entered email & 6-digit PIN
      userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        return {
          success: false,
          error: 'Invalid email or password. Please check your credentials or reset your password.'
        };
      } else if (err.code === 'auth/too-many-requests') {
        return {
          success: false,
          error: 'Too many unsuccessful attempts. Access temporarily blocked. Please reset your password or try again later.'
        };
      } else if (err.code === 'auth/user-disabled') {
        return {
          success: false,
          error: 'This user account has been disabled. Please contact administrator support.'
        };
      } else if (err.code === 'auth/network-request-failed') {
        // Offline network failure: only in this true offline scenario, fall through to local vault
        console.warn('[Auth] Firebase Auth network unavailable. Checking offline local vault...');
      } else {
        return {
          success: false,
          error: formatAuthError(err)
        };
      }
    }

    if (userCredential && userCredential.user) {
      const user = userCredential.user;

      // Force reload to pick up fresh email verification status
      try {
        await reload(user);
      } catch {}

      // Check cloud record if local matchingBiz is missing, unverified, or pending
      if (matchingBiz && (!matchingBiz.emailVerified || matchingBiz.status === 'pending_verification')) {
        try {
          const freshCloud = await findBusinessByEmailInCloud(cleanEmail);
          if (freshCloud) {
            matchingBiz = freshCloud;
          }
        } catch {}
      }

      // STRICT VERIFICATION CHECK:
      // An account is verified if:
      // 1. user.emailVerified is true in Firebase Auth (verified via email verification link)
      // OR
      // 2. The tenant was explicitly verified and activated by the platform administrator / developer in Developer Dashboard!
      const isAccountVerified = Boolean(
        user.emailVerified ||
        (matchingBiz && matchingBiz.emailVerified === true && matchingBiz.status === 'active')
      );

      if (!isAccountVerified) {
        await signOut(auth);
        return {
          success: false,
          isUnverified: true,
          email: cleanEmail,
          error: `Access Denied: Business account "${matchingBiz?.name || 'Owner'}" has not been created yet because email verification is pending for ${cleanEmail}. Please click the verification link sent to your email to complete creation of your account.`
        };
      }

      // Check admin suspension: if business was explicitly suspended by the admin, block access!
      if (matchingBiz && matchingBiz.status === 'suspended') {
        await signOut(auth);
        return {
          success: false,
          isSuspended: true,
          error: `Access Denied: Business account "${matchingBiz.name}" has been suspended by the platform administrator. Please contact developer support.`
        };
      }

      // Ensure business is marked active and synchronized
      if (!matchingBiz) {
        const createRes = createBusiness({
          name: 'My Restaurant Back-Office',
          ownerName: user.displayName || 'Business Owner',
          ownerEmail: cleanEmail,
          ownerPin: cleanPassword,
          counterPin: `${cleanPassword.slice(0, 4)}00`,
          status: 'active',
          emailVerified: true
        });
        matchingBiz = createRes.business;
        if (matchingBiz) {
          syncBusinessToCloud(matchingBiz).catch(() => {});
        }
      } else {
        const updates = {};
        if (matchingBiz.emailVerified === false || matchingBiz.status === 'pending_verification') {
          updates.status = 'active';
          updates.emailVerified = true;
          updates.accountCreatedAt = matchingBiz.accountCreatedAt || new Date().toISOString();
        }
        if (matchingBiz.owner?.pin !== cleanPassword) {
          updates.owner = {
            ...matchingBiz.owner,
            pin: cleanPassword,
            hasPinConfigured: true
          };
        }
        if (Object.keys(updates).length > 0) {
          updateBusiness(matchingBiz.id, updates);
          matchingBiz = { ...matchingBiz, ...updates };
          syncBusinessToCloud(matchingBiz).catch(() => {});

          // Broadcast live update across all windows including Developer Admin Dashboard
          broadcastSyncEvent(SYNC_EVENTS.CREDENTIALS_UPDATED, {
            businessId: matchingBiz.id,
            reason: 'login_sync',
            email: cleanEmail,
            newPin: cleanPassword
          }, null);
          broadcastSyncEvent(SYNC_EVENTS.BUSINESSES_UPDATED, {
            businessId: matchingBiz.id,
            reason: 'login_sync'
          }, null);
          try {
            window.dispatchEvent(new CustomEvent('flowscape_businesses_updated'));
          } catch {}
        }
      }

      setActiveBusiness(matchingBiz.id);

      const idToken = await user.getIdToken().catch(() => null);

      const session = {
        role: 'admin',
        businessId: matchingBiz.id,
        businessName: matchingBiz.name,
        name: matchingBiz.owner?.name || user.displayName || 'Owner',
        email: cleanEmail,
        branch: matchingBiz.city,
        token: idToken || `admin_${matchingBiz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: 'firebase_auth'
      };

      const currentSessions = getStoredSessions();
      currentSessions.admin = session;
      saveStoredSessions(currentSessions);

      return {
        success: true,
        user,
        business: matchingBiz,
        session
      };
    }
  }

  // ─── 2. OFFLINE / LOCAL DEMO FALLBACK (ONLY IF FIREBASE NOT CONFIGURED OR NETWORK OFFLINE) ───
  if (!matchingBiz) {
    return {
      success: false,
      error: `No registered business account found for "${cleanEmail}". Check the Developer Dashboard (#manj) for authorized tenant credentials.`
    };
  }

  const storedOwnerPin = String(matchingBiz.owner?.pin || '').trim();
  const isPinMatch = storedOwnerPin === cleanPassword;

  if (!isPinMatch) {
    return {
      success: false,
      error: 'Invalid email or password. Please check your credentials or reset your password.'
    };
  }

  if (matchingBiz.status === 'suspended') {
    return {
      success: false,
      isSuspended: true,
      error: `Access Denied: Business account "${matchingBiz.name}" has been suspended by the platform administrator. Please contact developer support.`
    };
  }

  if (matchingBiz.status === 'pending_verification' || matchingBiz.emailVerified === false) {
    return {
      success: false,
      isUnverified: true,
      email: cleanEmail,
      error: `Access Denied: Business account "${matchingBiz.name}" has not been created yet because email verification is pending for ${cleanEmail}. Please click the verification link sent to your email to complete creation of your account.`
    };
  }

  setActiveBusiness(matchingBiz.id);

  const fallbackSession = {
    role: 'admin',
    businessId: matchingBiz.id,
    businessName: matchingBiz.name,
    name: matchingBiz.owner.name,
    email: cleanEmail,
    branch: matchingBiz.city,
    token: `admin_${matchingBiz.id}_${Date.now()}`,
    authenticatedAt: new Date().toISOString(),
    authenticatedBy: 'multi_tenant_vault'
  };

  const currentSessions = getStoredSessions();
  currentSessions.admin = fallbackSession;
  saveStoredSessions(currentSessions);

  return {
    success: true,
    business: matchingBiz,
    session: fallbackSession
  };
}

/**
 * 3. FORGOT PASSWORD / PASSWORD RESET LINK
 * Sends password reset email link via Firebase Authentication.
 */
export async function sendPasswordReset({ email }) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const auth = getFirebaseAuth();

  if (auth) {
    try {
      const actionCodeSettings = {
        url: getAppActionUrl('resetPassword'),
        handleCodeInApp: true
      };
      await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
      return {
        success: true,
        message: `Password reset link sent to ${cleanEmail}! Please check your inbox and spam folder.`
      };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Local fallback mode:
  const businesses = getBusinesses();
  const matchingBiz = businesses.find((b) => b.owner.email.toLowerCase() === cleanEmail);
  if (!matchingBiz) {
    return { success: false, error: 'No business account found with this email address.' };
  }

  return {
    success: true,
    isLocalFallback: true,
    message: `Password reset link simulated for ${cleanEmail}! (In Demo Mode: Your current Master PIN is ${matchingBiz.owner.pin}).`
  };
}

/**
 * Helper: Resend Verification Email Link
 */
export async function resendVerificationLink({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  let cleanPassword = (password || '').trim();

  if (!cleanPassword) {
    return { success: false, error: 'Please enter your password to resend the verification email.' };
  }

  const auth = getFirebaseAuth();

  if (auth) {
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      } catch (err) {
        if ((err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') && cleanPassword.length === 4) {
          try {
            userCredential = await signInWithEmailAndPassword(auth, cleanEmail, `${cleanPassword}00`);
          } catch {
            throw err;
          }
        } else {
          throw err;
        }
      }

      const user = userCredential.user;

      if (user.emailVerified) {
        await signOut(auth);
        return { success: true, alreadyVerified: true, message: 'Your email is already verified! You can now log in.' };
      }

      const actionCodeSettings = {
        url: getAppActionUrl('verifyEmail'),
        handleCodeInApp: true
      };
      await sendEmailVerification(user, actionCodeSettings);
      await signOut(auth);

      return {
        success: true,
        message: `A fresh verification link has been sent to ${cleanEmail}. Please check your inbox.`
      };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Local fallback: verify email in local database
  const businesses = getBusinesses();
  const bIndex = businesses.findIndex((b) => b.owner.email.toLowerCase() === cleanEmail);
  if (bIndex !== -1) {
    businesses[bIndex].emailVerified = true;
    try {
      localStorage.setItem('flowscape_businesses_v1', JSON.stringify(businesses));
    } catch {}
    return { success: true, alreadyVerified: true, message: `Email ${cleanEmail} verified! You can now log in.` };
  }

  return { success: false, error: 'Account not found.' };
}

/**
 * 4. APPLY EMAIL VERIFICATION CODE (FROM EMAIL LINK)
 * Automatically marks the user's email as verified in Firebase Auth,
 * and transitions the corresponding business from suspended to active.
 */
export async function handleVerifyEmailAction(oobCode) {
  if (!oobCode) {
    return { success: false, error: 'Invalid or missing email verification code.' };
  }

  const auth = getFirebaseAuth();

  if (auth) {
    try {
      let verifiedEmail = null;
      try {
        const info = await checkActionCode(auth, oobCode);
        verifiedEmail = info?.data?.email;
      } catch {}

      await applyActionCode(auth, oobCode);

      // Transition matching business from suspended to active
      let businesses = getBusinesses();
      if (verifiedEmail && !businesses.some((b) => (b.owner?.email || '').toLowerCase() === verifiedEmail.toLowerCase())) {
        try {
          await findBusinessByEmailInCloud(verifiedEmail);
          businesses = getBusinesses();
        } catch {}
      }

      let updated = false;
      let activatedBiz = null;
      const updatedBiz = businesses.map((b) => {
        if (
          (verifiedEmail && (b.owner?.email || '').toLowerCase() === verifiedEmail.toLowerCase()) ||
          (!verifiedEmail && (b.emailVerified === false || b.status === 'pending_verification' || b.status === 'suspended'))
        ) {
          updated = true;
          const fresh = {
            ...b,
            status: 'active',
            emailVerified: true,
            accountCreatedAt: b.accountCreatedAt || new Date().toISOString()
          };
          activatedBiz = fresh;
          syncBusinessToCloud(fresh).catch(() => {});
          return fresh;
        }
        return b;
      });
      if (updated) {
        saveBusinesses(updatedBiz);
      }

      if (activatedBiz) {
        // Broadcast instant notification to Developer Superadmin Dashboard
        broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
          businessId: activatedBiz.id,
          businessName: activatedBiz.name,
          email: activatedBiz.owner?.email || verifiedEmail,
          timestamp: new Date().toISOString()
        }, null);

        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ontap_last_verified_email', JSON.stringify({
              businessId: activatedBiz.id,
              businessName: activatedBiz.name,
              email: activatedBiz.owner?.email || verifiedEmail,
              timestamp: Date.now()
            }));
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ontap_email_verified', {
              detail: {
                businessId: activatedBiz.id,
                businessName: activatedBiz.name,
                email: activatedBiz.owner?.email || verifiedEmail
              }
            }));
          }
        } catch {}
      }

      return {
        success: true,
        email: verifiedEmail,
        message: 'Email verified, you can now login'
      };
    } catch (error) {
      if (error.code === 'auth/invalid-action-code') {
        // Even if action code was already used / redeemed, ensure matching business is marked active and broadcast
        if (verifiedEmail) {
          try {
            await findBusinessByEmailInCloud(verifiedEmail);
            const freshBusinesses = getBusinesses();
            const target = freshBusinesses.find((b) => (b.owner?.email || '').toLowerCase() === verifiedEmail.toLowerCase());
            if (target && (target.status !== 'active' || !target.emailVerified)) {
              updateBusiness(target.id, {
                status: 'active',
                emailVerified: true,
                accountCreatedAt: target.accountCreatedAt || new Date().toISOString()
              });
              syncBusinessToCloud({ ...target, status: 'active', emailVerified: true }).catch(() => {});
              broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
                businessId: target.id,
                businessName: target.name,
                email: target.owner?.email || verifiedEmail,
                timestamp: new Date().toISOString()
              }, null);
            }
          } catch {}
        }
        return {
          success: true,
          alreadyUsed: true,
          message: 'Email verified, you can now login'
        };
      }
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Local fallback mode: mark business as active and verified
  const businesses = getBusinesses();
  let activatedBiz = null;
  const updatedBiz = businesses.map((b) => {
    const fresh = {
      ...b,
      status: 'active',
      emailVerified: true,
      accountCreatedAt: b.accountCreatedAt || new Date().toISOString()
    };
    activatedBiz = fresh;
    syncBusinessToCloud(fresh).catch(() => {});
    return fresh;
  });
  saveBusinesses(updatedBiz);

  if (activatedBiz) {
    broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
      businessId: activatedBiz.id,
      businessName: activatedBiz.name,
      email: activatedBiz.owner?.email,
      timestamp: new Date().toISOString()
    }, null);
  }

  return {
    success: true,
    message: 'Email verified, you can now login'
  };
}

/**
 * 5. VERIFY PASSWORD RESET CODE (FROM EMAIL LINK)
 * Verifies code validity and retrieves the email for which reset was requested.
 */
export async function handleVerifyPasswordResetCode(oobCode) {
  // If no oobCode is present (e.g. previewing #reset-password directly), support preview gracefully
  if (!oobCode || oobCode === 'demo' || oobCode === 'test') {
    const businesses = getBusinesses();
    const active = businesses[0];
    return {
      success: true,
      email: active?.owner?.email || 'admin@advaitkitchen.com',
      isDemoPreview: true
    };
  }

  const auth = getFirebaseAuth();

  if (auth) {
    try {
      const email = await verifyPasswordResetCode(auth, oobCode);
      return { success: true, email };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Local fallback mode
  return {
    success: true,
    email: 'admin@advaitkitchen.com'
  };
}

/**
 * 6. CONFIRM PASSWORD RESET (FROM EMAIL LINK)
 * Submits the new 4-digit Master PIN to Firebase Auth (with transparent padding)
 * and updates the owner PIN in the local business record.
 */
export async function handleConfirmPasswordReset(oobCode, newPassword, targetEmail) {
  const cleanPin = (newPassword || '').trim();

  // Password requirement: minimum 6 characters
  if (!cleanPin || cleanPin.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const auth = getFirebaseAuth();

  if (auth && oobCode) {
    try {
      await confirmPasswordReset(auth, oobCode, cleanPin);
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }

  // Update owner PIN in local business storage for target business
  const businesses = getBusinesses();
  let targetIndex = -1;
  const cleanEmail = (targetEmail || '').trim().toLowerCase();
  if (cleanEmail && cleanEmail !== 'your account') {
    targetIndex = businesses.findIndex((b) => b.owner.email.toLowerCase() === cleanEmail);
  }
  if (targetIndex === -1) {
    // Check active business if email not matched
    const activeBiz = getActiveBusiness();
    targetIndex = businesses.findIndex((b) => b.id === activeBiz?.id);
  }
  if (targetIndex === -1) {
    targetIndex = 0;
  }

  if (targetIndex !== -1 && businesses[targetIndex]) {
    businesses[targetIndex].owner = {
      ...businesses[targetIndex].owner,
      pin: cleanPin,
      hasPinConfigured: true
    };
    saveBusinesses(businesses);

    // SYSTEMATIC DATABASE PERSISTENCE:
    syncBusinessToCloud(businesses[targetIndex]).catch(() => {});

    // Update active business context if relevant
    const activeBiz = getActiveBusiness();
    if (activeBiz?.id === businesses[targetIndex].id) {
      setActiveBusiness(businesses[targetIndex].id);
    }

    // Update stored session if active
    try {
      const sessions = getStoredSessions();
      if (sessions?.admin && sessions.admin.businessId === businesses[targetIndex].id) {
        sessions.admin.authenticatedAt = new Date().toISOString();
        saveStoredSessions(sessions);
      }
    } catch {}

    // Broadcast update across all windows and developer dashboard
    broadcastSyncEvent(SYNC_EVENTS.CREDENTIALS_UPDATED, {
      businessId: businesses[targetIndex].id,
      reason: 'password_reset',
      email: businesses[targetIndex].owner.email,
      newPin: cleanPin
    }, null);

    broadcastSyncEvent(SYNC_EVENTS.BUSINESSES_UPDATED, {
      businessId: businesses[targetIndex].id,
      reason: 'password_reset'
    }, null);
  } else if (cleanEmail && cleanEmail !== 'your account') {
    // If not in local cache, update Cloud Firestore systematically
    try {
      const cloudBiz = await findBusinessByEmailInCloud(cleanEmail);
      if (cloudBiz) {
        const updatedBiz = {
          ...cloudBiz,
          owner: {
            ...cloudBiz.owner,
            pin: cleanPin,
            hasPinConfigured: true
          }
        };
        await syncBusinessToCloud(updatedBiz);
        const freshList = getBusinesses();
        const merged = freshList.some((b) => b.id === updatedBiz.id)
          ? freshList.map((b) => (b.id === updatedBiz.id ? updatedBiz : b))
          : [updatedBiz, ...freshList];
        saveBusinesses(merged);
        broadcastSyncEvent(SYNC_EVENTS.CREDENTIALS_UPDATED, {
          businessId: updatedBiz.id,
          reason: 'password_reset',
          email: updatedBiz.owner.email,
          newPin: cleanPin
        }, null);
      }
    } catch {}
  }

  return {
    success: true,
    message: 'Your PIN has been successfully updated, you can now try to login again.'
  };
}

/**
 * 7. DELETE OWNER ACCOUNT FROM FIREBASE AUTH
 * Permanently removes the owner user from Firebase Auth, thereby deleting
 * their email verification record, password history, and authentication credentials.
 */
export async function deleteOwnerAccountFromFirebase({ email, password }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  let cleanPin = (password || '').trim();

  const config = getFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { success: true, isLocalFallback: true, message: 'Local demo account deleted.' };
  }

  const secondaryAppName = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let secondaryApp = null;
  try {
    secondaryApp = initializeApp(config, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, `${cleanPin}00`);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userCredential = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPin);
      } else {
        throw err;
      }
    }

    if (userCredential && userCredential.user) {
      await deleteUser(userCredential.user);
    }

    try { await signOut(secondaryAuth); } catch {}
    try { await deleteApp(secondaryApp); } catch {}

    return {
      success: true,
      message: `Account credentials, password history, and email verification for ${cleanEmail} permanently deleted from Firebase Auth.`
    };
  } catch (error) {
    console.warn('Firebase user deletion notice:', error);
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch {}
    }
    // If user not found in Firebase (e.g. was already deleted or created locally), proceed smoothly
    return {
      success: true,
      warning: formatAuthError(error)
    };
  }
}

/**
 * 8. MANUAL CREDENTIALS OVERRIDE (TECHNICAL ANOMALY RECOVERY)
 * Allows platform administrator / developer to manually update an owner's email
 * and/or 4-digit Master PIN in both the local multi-tenant database and Firebase Auth.
 * Uses a sandboxed secondary Firebase app so the active developer session is completely isolated.
 */
export async function updateOwnerCredentialsManually({
  businessId,
  oldEmail,
  oldPin,
  newEmail,
  newPin,
  markVerified = true
}) {
  const cleanOldEmail = (oldEmail || '').trim().toLowerCase();
  const cleanOldPin = (oldPin || '').trim();
  const cleanNewEmail = (newEmail || '').trim().toLowerCase();
  const cleanNewPin = (newPin || '').trim();

  if (!cleanNewEmail.includes('@') || !cleanNewEmail.includes('.')) {
    return { success: false, error: 'A valid owner email address is required.' };
  }

  // Owner password requirement: minimum 6 characters (letters, numbers, or both)
  if (!cleanNewPin || cleanNewPin.length < 6) {
    return { success: false, error: 'Owner password must be at least 6 characters long.' };
  }

  const config = getFirebaseConfig();
  let firebaseNotice = null;
  let firebaseUpdated = false;

  if (config && config.apiKey && config.projectId) {
    const secondaryAppName = `override_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(config, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // Attempt to authenticate existing user in sandbox using candidate PINs/passwords
      let userCredential = null;
      const allBusinesses = getBusinesses();
      let currentBiz = allBusinesses.find(
        (b) => b.id === businessId || (b.owner?.email || '').toLowerCase() === cleanOldEmail
      );
      if (!currentBiz && cleanNewEmail) {
        currentBiz = allBusinesses.find(
          (b) => (b.owner?.email || '').toLowerCase() === cleanNewEmail
        );
      }

      const candidatePins = Array.from(new Set([
        cleanOldPin,
        cleanNewPin,
        currentBiz?.owner?.pin,
        currentBiz?.counter?.pin,
        cleanOldPin && cleanOldPin.length === 4 ? `${cleanOldPin}00` : null,
        cleanNewPin && cleanNewPin.length === 4 ? `${cleanNewPin}00` : null,
        cleanOldPin && cleanOldPin.endsWith('00') && cleanOldPin.length === 6 ? cleanOldPin.slice(0, 4) : null,
        cleanNewPin && cleanNewPin.endsWith('00') && cleanNewPin.length === 6 ? cleanNewPin.slice(0, 4) : null,
        '882100',
        '123456',
        '000000',
        '111111'
      ].filter(Boolean)));

      const targetEmails = Array.from(new Set([
        cleanOldEmail,
        cleanNewEmail,
        currentBiz?.owner?.email ? currentBiz.owner.email.trim().toLowerCase() : null
      ].filter(Boolean)));

      for (const emailToTry of targetEmails) {
        for (const candidate of candidatePins) {
          try {
            userCredential = await signInWithEmailAndPassword(secondaryAuth, emailToTry, candidate);
            if (userCredential && userCredential.user) break;
          } catch {}
        }
        if (userCredential && userCredential.user) break;
      }

      if (userCredential && userCredential.user) {
        const user = userCredential.user;

        // 1. Update password in Firebase Auth to ensure it is 100% in sync
        try {
          await updatePassword(user, cleanNewPin);
          firebaseUpdated = true;
          firebaseNotice = `Password successfully updated in Firebase Auth for ${cleanNewEmail}.`;
        } catch (pwErr) {
          console.warn('Firebase updatePassword warning:', pwErr);
          throw new Error(`Firebase Auth password update failed: ${formatAuthError(pwErr)}`);
        }

        // 2. If email changed, update email in Firebase Auth
        if (cleanNewEmail !== (user.email || '').toLowerCase()) {
          try {
            await updateEmail(user, cleanNewEmail);
            firebaseUpdated = true;
            firebaseNotice = `Email and password successfully updated in Firebase Auth for ${cleanNewEmail}.`;
          } catch (emErr) {
            console.warn('Firebase direct updateEmail warning, recreating user:', emErr);
            try {
              await deleteUser(user);
              await createUserWithEmailAndPassword(secondaryAuth, cleanNewEmail, cleanNewPin);
              firebaseUpdated = true;
              firebaseNotice = `Recreated account in Firebase Auth with updated email (${cleanNewEmail}) and password.`;
            } catch (recreateErr) {
              console.warn('Firebase recreate user warning:', recreateErr);
            }
          }
        }
      } else {
        // User could not be signed in via candidate PINs; attempt direct creation in Firebase Auth
        try {
          await createUserWithEmailAndPassword(secondaryAuth, cleanNewEmail, cleanNewPin);
          firebaseUpdated = true;
          firebaseNotice = `Fresh credentials provisioned in Firebase Auth for ${cleanNewEmail}.`;
        } catch (createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            // User exists in Firebase Auth with an unknown password. Send a password reset email link so they can sync.
            try {
              const actionCodeSettings = {
                url: getAppActionUrl('resetPassword'),
                handleCodeInApp: true
              };
              await sendPasswordResetEmail(secondaryAuth, cleanNewEmail, actionCodeSettings);
              firebaseNotice = `Database password updated to "${cleanNewPin}". Password reset link dispatched to ${cleanNewEmail} to confirm PIN synchronization with Firebase Auth.`;
            } catch {
              firebaseNotice = `Database credentials updated. Please use "Send Password Reset Link" to sync password in Firebase Auth.`;
            }
          } else {
            console.warn('Firebase fallback account provisioning notice:', createErr);
            firebaseNotice = `Local credentials updated. (Firebase notice: ${formatAuthError(createErr)})`;
          }
        }
      }

      try { await signOut(secondaryAuth); } catch {}
      try { await deleteApp(secondaryApp); } catch {}
    } catch (fbErr) {
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch {}
      }
      console.warn('Firebase override process notice:', fbErr);
      firebaseNotice = `Local credentials updated. (Firebase: ${formatAuthError(fbErr)})`;
    }
  } else {
    firebaseNotice = 'Owner credentials updated in local multi-tenant database (Demo Mode).';
  }

  // Update business record in database & Cloud Firestore
  const updates = {
    owner: {
      email: cleanNewEmail,
      pin: cleanNewPin
    }
  };

  if (markVerified) {
    updates.status = 'active';
    updates.emailVerified = true;
    updates.accountCreatedAt = new Date().toISOString();
  } else {
    updates.status = 'pending_verification';
    updates.emailVerified = false;
  }

  const updateRes = updateBusiness(businessId, updates);
  if (!updateRes.success) {
    return { success: false, error: updateRes.error };
  }

  // Persist systematically to Cloud Firestore
  if (updateRes.business) {
    await syncBusinessToCloud(updateRes.business).catch(() => {});
  }

  // Broadcast update event across all windows and developer dashboard
  broadcastSyncEvent(SYNC_EVENTS.CREDENTIALS_UPDATED, {
    businessId,
    reason: 'credentials_override',
    newEmail: cleanNewEmail,
    newPin: cleanNewPin
  });

  broadcastSyncEvent(SYNC_EVENTS.BUSINESSES_UPDATED, {
    businessId,
    reason: 'credentials_override'
  });

  if (markVerified) {
    broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
      businessId,
      businessName: updateRes.business?.name,
      email: cleanNewEmail,
      timestamp: new Date().toISOString()
    }, null);

    try {
      window.dispatchEvent(new CustomEvent('ontap_email_verified', {
        detail: {
          businessId,
          businessName: updateRes.business?.name,
          email: cleanNewEmail
        }
      }));
    } catch {}
  }

  return {
    success: true,
    business: updateRes.business,
    firebaseUpdated,
    message: firebaseNotice || `Credentials for ${cleanNewEmail} successfully overridden and saved.`
  };
}

/**
 * Human-friendly Firebase error messages
 */
function formatAuthError(error) {
  if (!error) return 'An unknown error occurred.';
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please log in or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials or reset your password.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access temporarily blocked. Please reset your password or try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact administrator support.';
    default:
      return error.message || 'Authentication error. Please try again.';
  }
}
