// Multi-Tenant Business & Developer Account Manager for Restaurant OS
// Enables Developer Admin to manage the entire platform, create/manage multiple business accounts,
// and authenticate distinct business owners with their own credentials.


import { initialStaff, initialStaffByBusiness } from '../data/initialData';
import { timingSafeEqual } from './passwordSecurity';
import { validateEmail, validatePin } from './securityValidator';

export const BUSINESSES_STORAGE_KEY = 'flowscape_businesses_v1';
export const ACTIVE_BUSINESS_ID_KEY = 'flowscape_active_business_id_v1';
export const DEV_SESSION_STORAGE_KEY = 'flowscape_dev_session_v1';
export const DEV_CREDENTIALS_STORAGE_KEY = 'flowscape_dev_credentials_v2';
export const DEV_RESET_CODE_STORAGE_KEY = 'flowscape_dev_reset_code_v1';

export const DEFAULT_DEVELOPER_EMAIL = 'pranjalmk62@gmail.com';

// Developer Superadmin Credentials (strictly manual login, zero autofill)
export const DEVELOPER_CREDENTIALS = {
  get email() {
    return getDeveloperCredentials().email;
  },
  name: 'Platform Lead Developer',
  role: 'developer'
};

/**
 * Check whether a master developer password has been retained in the database
 */
export function hasDeveloperPassword() {
  const pass = getDeveloperPassword();
  return Boolean(pass && pass.length >= 6);
}

/**
 * Retrieve saved developer superadmin credentials or default
 */
export function getDeveloperCredentials() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DEV_CREDENTIALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            email: parsed.email || DEFAULT_DEVELOPER_EMAIL,
            name: parsed.name || 'Platform Lead Developer',
            role: 'developer'
          };
        }
      }
    }
  } catch (err) {
    console.error('Error loading developer credentials:', err);
  }
  return {
    email: DEFAULT_DEVELOPER_EMAIL,
    name: 'Platform Lead Developer',
    role: 'developer'
  };
}

/**
 * Retrieve current master developer password from database (returns empty string if none set yet)
 */
export function getDeveloperPassword() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DEV_CREDENTIALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.password) {
          return String(parsed.password).trim();
        }
      }
    }
  } catch (err) {
    console.error('Error loading developer password from database:', err);
  }
  return '';
}

/**
 * Update and retain the developer superadmin password in the database (local + cloud sync)
 * Supports both authenticated updates and verified reset/recovery updates
 */
export function updateDeveloperPassword(newPassword, oldPassword = null, options = {}) {
  const cleanNew = String(newPassword || '').trim();
  if (!cleanNew || cleanNew.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  const currentPass = getDeveloperPassword();

  // If oldPassword is required (only when a current password exists in database, and not resetting)
  if (currentPass && !options.isReset && !options.bypassOldCheck) {
    const cleanOld = String(oldPassword || '').trim();
    if (!cleanOld) {
      return { success: false, error: 'Current master password is required.' };
    }
    if (!timingSafeEqual(cleanOld, currentPass)) {
      return { success: false, error: 'Current master password does not match database record.' };
    }
  }

  try {
    const creds = getDeveloperCredentials();
    const updated = {
      ...creds,
      password: cleanNew,
      updatedAt: new Date().toISOString()
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_CREDENTIALS_STORAGE_KEY, JSON.stringify(updated));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowscape_dev_credentials_updated', { detail: updated }));
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('flowscape_pos_sync_channel_v1');
          bc.postMessage({
            type: 'DEV_CREDENTIALS_UPDATED',
            payload: { email: updated.email, timestamp: Date.now() },
            timestamp: Date.now()
          });
          bc.close();
        }
      } catch {}
    }

    // Persist to cloud Firestore database as well if initialized
    try {
      import('./systematicDatabase.js').then((mod) => {
        if (typeof mod.syncDeveloperCredentialsToCloud === 'function') {
          mod.syncDeveloperCredentialsToCloud(updated).catch(() => {});
        }
      }).catch(() => {});
    } catch {}

    return {
      success: true,
      message: 'Developer Dashboard password retained in database successfully.'
    };
  } catch (err) {
    console.error('Error saving developer password to database:', err);
    return { success: false, error: 'Failed to update developer password: ' + err.message };
  }
}

/**
 * Request Developer Password Reset (Forgot Password)
 * Generates an instant 6-digit recovery code and attempts Firebase Auth dispatch
 */
export async function requestDeveloperPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const currentCreds = getDeveloperCredentials();

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Please enter a valid developer email address.' };
  }

  if (cleanEmail !== currentCreds.email.toLowerCase()) {
    return {
      success: false,
      error: `Access Denied: Email "${cleanEmail}" does not match the authorized Developer Dashboard ID (${currentCreds.email}).`
    };
  }

  // Generate a secure 6-digit verification code
  const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15-minute validity window

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEV_RESET_CODE_STORAGE_KEY, JSON.stringify({
        code: recoveryCode,
        email: cleanEmail,
        expiresAt
      }));
    }
  } catch (e) {
    console.error('Error saving developer reset code:', e);
  }

  // Also attempt Firebase Auth reset email if available
  let firebaseDispatched = false;
  try {
    const { getFirebaseAuth } = await import('./firebaseAuth.js');
    const auth = getFirebaseAuth();
    if (auth) {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, cleanEmail);
      firebaseDispatched = true;
    }
  } catch (fbErr) {
    console.log('Firebase Auth dev reset notice:', fbErr?.message || fbErr);
  }

  return {
    success: true,
    email: cleanEmail,
    recoveryCode,
    expiresInMinutes: 15,
    firebaseDispatched,
    message: `Password reset verification code dispatched for ${cleanEmail}! Enter the 6-digit verification code to set a new password.`
  };
}

/**
 * Confirm Developer Password Reset using the 6-digit verification code
 */
export function confirmDeveloperPasswordReset(email, recoveryCode, newPassword) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanCode = String(recoveryCode || '').trim();
  const cleanNew = String(newPassword || '').trim();

  if (!cleanNew || cleanNew.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  let storedReset = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DEV_RESET_CODE_STORAGE_KEY);
      if (raw) storedReset = JSON.parse(raw);
    }
  } catch {}

  if (!storedReset || !storedReset.code) {
    return { success: false, error: 'No active reset request found. Please request a new verification code.' };
  }

  if (Date.now() > storedReset.expiresAt) {
    return { success: false, error: 'Verification code has expired. Please request a new verification code.' };
  }

  if (cleanEmail !== storedReset.email.toLowerCase()) {
    return { success: false, error: 'Email does not match the active reset request.' };
  }

  if (!timingSafeEqual(cleanCode, String(storedReset.code))) {
    return { success: false, error: 'Invalid 6-digit verification code. Please check and try again.' };
  }

  // Update password with bypassOldCheck
  const updateRes = updateDeveloperPassword(cleanNew, null, { isReset: true, bypassOldCheck: true });
  if (updateRes.success) {
    try {
      localStorage.removeItem(DEV_RESET_CODE_STORAGE_KEY);
    } catch {}
  }
  return updateRes;
}

// Initial default business accounts configured on platform (Clean Zero-State for real use)
export const DEFAULT_BUSINESSES = [];

/**
 * Retrieve all registered business accounts
 */
export function getBusinesses() {
  try {
    const raw = localStorage.getItem(BUSINESSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    // Automatically filter out any legacy pre-made mock demo accounts
    let needsMigration = false;
    const cleaned = parsed.filter(
      (b) => b && b.id !== 'biz_advait' && b.id !== 'biz_copper_chimney' && b.id !== 'biz_chai_point'
    );
    if (cleaned.length !== parsed.length) {
      needsMigration = true;
    }

    const migrated = cleaned.map((b) => {
      let updatedOwnerPin = b.owner?.pin ? String(b.owner.pin).trim() : '';
      let updatedCounterPin = b.counter?.pin ? String(b.counter.pin).trim() : '';
      if (updatedOwnerPin && updatedOwnerPin.length < 6) {
        updatedOwnerPin = updatedOwnerPin.padEnd(6, '0');
        needsMigration = true;
      }
      if (updatedCounterPin && updatedCounterPin.length < 6) {
        updatedCounterPin = updatedCounterPin.padEnd(6, '0');
        needsMigration = true;
      }
      return {
        ...b,
        owner: { ...b.owner, pin: updatedOwnerPin },
        counter: { ...b.counter, pin: updatedCounterPin }
      };
    });

    if (needsMigration) {
      localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch (err) {
    console.error('Error loading businesses:', err);
    return [];
  }
}

/**
 * Save businesses list to localStorage and dispatch local & broadcast events
 */
export function saveBusinesses(businesses) {
  try {
    localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(businesses));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowscape_businesses_updated', { detail: businesses }));
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('flowscape_pos_sync_channel_v1');
          bc.postMessage({
            type: 'BUSINESSES_UPDATED',
            payload: businesses,
            timestamp: Date.now()
          });
          bc.close();
        }
      } catch {}
    }
  } catch (err) {
    console.error('Error saving businesses:', err);
  }
}

/**
 * Get active business object
 */
export function getActiveBusiness() {
  const businesses = getBusinesses();
  if (!businesses || businesses.length === 0) return null;
  let activeId = null;

  // 1. Prioritize active tab session in sessionStorage (isolated per tab, preserved across refreshes)
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('flowscape_auth_sessions_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.admin?.businessId) {
          activeId = parsed.admin.businessId;
        } else if (parsed?.counter?.businessId) {
          activeId = parsed.counter.businessId;
        }
      }
    } catch {}
  }

  // 2. Fall back to localStorage if set
  if (!activeId && typeof localStorage !== 'undefined') {
    activeId = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY);
  }

  const found = businesses.find((b) => b.id === activeId);
  return found || businesses[0] || null;
}

/**
 * Switch active business context
 */
export function setActiveBusiness(businessId) {
  try {
    localStorage.setItem(ACTIVE_BUSINESS_ID_KEY, businessId);
  } catch (err) {
    console.error('Error setting active business:', err);
  }
}

/**
 * Create a new business account
 */
export function createBusiness(data) {
  const businesses = getBusinesses();
  const cleanEmail = (data.ownerEmail || '').trim().toLowerCase();
  const trimmedOwnerPin = (data.ownerPin || '').toString().trim();
  let trimmedCounterPin = (data.counterPin || '').toString().trim();

  // Validate owner password: min 6 chars (characters, numbers, or both)
  if (!trimmedOwnerPin || trimmedOwnerPin.length < 6) {
    return { success: false, error: 'Owner Password must be at least 6 characters (characters, digits, or both).' };
  }
  // Safe default for Counter PIN if omitted by internal provisioners
  if (!/^\d{6}$/.test(trimmedCounterPin)) {
    trimmedCounterPin = /^\d{6}$/.test(trimmedOwnerPin) ? `${trimmedOwnerPin.slice(0, 4)}00` : '442100';
  }

  // Validate unique PIN across all businesses (allowing matching PIN only if it was this record)
  const pinInUse = businesses.some(
    (b) => (b.owner?.pin === trimmedOwnerPin && b.owner?.email?.toLowerCase() !== cleanEmail) ||
           (b.counter?.pin === trimmedOwnerPin && b.owner?.email?.toLowerCase() !== cleanEmail) ||
           (b.owner?.pin === trimmedCounterPin && b.owner?.email?.toLowerCase() !== cleanEmail) ||
           (b.counter?.pin === trimmedCounterPin && b.owner?.email?.toLowerCase() !== cleanEmail)
  );
  if (pinInUse) {
    return { success: false, error: 'Specified Owner PIN or Counter PIN is already in use by another business. Please choose unique 6-digit PINs.' };
  }

  // Validate duplicate email
  const existing = businesses.find((b) => b.owner.email.toLowerCase() === cleanEmail);
  if (existing) {
    return { success: false, error: `An account with email "${cleanEmail}" already exists for business "${existing.name}".` };
  }

  const id = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const serviceType = data.serviceType === 'stall' ? 'stall' : 'dine_in';
  let tableCount = serviceType === 'stall' ? 0 : (data.tableCount !== undefined ? (parseInt(data.tableCount, 10) || 6) : 6);
  if (serviceType === 'dine_in' && tableCount < 1) tableCount = 1;

  let computedTables = [];
  if (data.tables && Array.isArray(data.tables) && data.tables.length > 0) {
    computedTables = data.tables;
  } else if (serviceType === 'stall') {
    computedTables = ['Counter / Stand & Eat'];
  } else {
    computedTables = Array.from({ length: tableCount }, (_, i) => `Table ${String(i + 1).padStart(2, '0')}`);
    computedTables.push('Counter / Takeaway');
  }

  const newBusiness = {
    id,
    name: (data.name || '').trim() || 'New Craft Restaurant',
    tagline: (data.tagline || '').trim() || 'Artisanal Flavours & Hospitality',
    category: data.category || 'Casual Dining',
    city: (data.city || '').trim() || 'New Delhi, India',
    plan: data.plan || 'Starter',
    status: data.status ? data.status : (data.emailVerified === true ? 'active' : 'suspended'),
    emailVerified: data.emailVerified === true ? true : false,
    serviceType,
    tableCount,
    owner: {
      name: (data.ownerName || '').trim() || 'Business Owner',
      email: cleanEmail,
      pin: trimmedOwnerPin
    },
    counter: {
      pin: trimmedCounterPin,
      terminalName: `${(data.name || 'POS').split(' ')[0]} Terminal 01`
    },
    upiId: (data.upiId || '').trim() || 'payment@upi',
    tables: computedTables,
    accentColor: data.accentColor || '#007AFF',
    totalOrders: 0,
    gmv: 0,
    createdAt: new Date().toISOString()
  };

  const updated = [newBusiness, ...businesses];
  saveBusinesses(updated);

  return { success: true, business: newBusiness };
}

/**
 * Update an existing business
 */
export function updateBusiness(id, updates) {
  // IDOR & Object-Level Ownership Validation:
  if (!isDeveloperAuthenticated()) {
    let authorized = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('flowscape_auth_sessions_v3');
        if (raw) {
          const sessions = JSON.parse(raw);
          if (sessions?.admin?.businessId === id) {
            authorized = true;
          }
        }
      }
    } catch {}
    if (!authorized) {
      console.error(`🚨 [IDOR Attempt Blocked] Unauthorized update attempt on business "${id}"`);
      return { success: false, error: 'Unauthorized: IDOR violation. You do not possess ownership authorization for this business account.' };
    }
  }

  const businesses = getBusinesses();
  const index = businesses.findIndex((b) => b.id === id);
  if (index === -1) return { success: false, error: 'Business account not found' };

  // Validate owner updates if provided
  if (updates.owner) {
    if (updates.owner.email) {
      const cleanEmail = updates.owner.email.trim().toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return { success: false, error: 'A valid owner email address is required.' };
      }
      const duplicate = businesses.find((b) => b.id !== id && b.owner?.email?.toLowerCase() === cleanEmail);
      if (duplicate) {
        return { success: false, error: `Email "${cleanEmail}" is already registered to business "${duplicate.name}".` };
      }
      updates.owner.email = cleanEmail;
    }
    if (updates.owner.pin !== undefined) {
      const cleanPin = String(updates.owner.pin).trim();
      if (!cleanPin || cleanPin.length < 6) {
        return { success: false, error: 'Owner password must be at least 6 characters long.' };
      }
      updates.owner.pin = cleanPin;
    }
  }

  // Validate counter updates if provided
  if (updates.counter && updates.counter.pin !== undefined) {
    const cleanCounterPin = String(updates.counter.pin).trim();
    if (!/^\d{6}$/.test(cleanCounterPin)) {
      return { success: false, error: 'Counter POS PIN must be exactly 6 numeric digits.' };
    }
    updates.counter.pin = cleanCounterPin;
  }

  businesses[index] = {
    ...businesses[index],
    ...updates,
    owner: { ...businesses[index].owner, ...(updates.owner || {}) },
    counter: { ...businesses[index].counter, ...(updates.counter || {}) }
  };

  saveBusinesses(businesses);
  return { success: true, business: businesses[index] };
}

/**
 * Delete a business account
 */
/**
 * Permanently delete a business account and wipe all its info, order history,
 * menu items, staff, checklists, and local database partitions.
 */
export function deleteBusiness(id) {
  // IDOR & Object-Level Ownership Validation:
  if (!isDeveloperAuthenticated()) {
    let authorized = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('flowscape_auth_sessions_v3');
        if (raw) {
          const sessions = JSON.parse(raw);
          if (sessions?.admin?.businessId === id) {
            authorized = true;
          }
        }
      }
    } catch {}
    if (!authorized) {
      console.error(`🚨 [IDOR Attempt Blocked] Unauthorized deletion attempt on business "${id}"`);
      return { success: false, error: 'Unauthorized: IDOR violation. You do not possess ownership authorization to delete this business account.' };
    }
  }

  const businesses = getBusinesses();
  const targetBiz = businesses.find((b) => b.id === id);
  if (!targetBiz) {
    return { success: false, error: 'Business account not found.' };
  }

  // 1. Purge all scoped database records, order history, menu, staff, and settings from localStorage
  if (typeof localStorage !== 'undefined') {
    const keysToRemove = new Set();

    // Standard scoped storage base keys
    const standardKeys = [
      'flowscape_menu_inr_v2',
      'flowscape_chef_inr_v2',
      'flowscape_orders_inr_v2',
      'flowscape_expenses_inr_v2',
      'flowscape_staff_inr_v2',
      'flowscape_offers_inr_v2',
      'flowscape_theme_inr_v2',
      'flowscape_checklists_inr_v2',
      'flowscape_orders_v2'
    ];

    standardKeys.forEach((baseKey) => {
      keysToRemove.add(`${baseKey}_${id}`);
    });

    // Scan all localStorage keys for any partition or history containing business ID
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes(id) || k.endsWith(`_${id}`))) {
          keysToRemove.add(k);
        }
      }
    } catch {}

    // Special case for default seed partition 'biz_advait' if deleted
    if (id === 'biz_advait') {
      standardKeys.forEach((baseKey) => keysToRemove.add(baseKey));
    }

    // Execute deletion of all collected keys
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn(`[Tenant Cleanup] Could not delete key ${key}:`, err);
      }
    });

    // Purge terminal staff tracking
    try {
      localStorage.removeItem(`counter_active_staff_id_${id}`);
      localStorage.removeItem(`counter_active_staff_id`);
    } catch {}
  }

  // 2. Invalidate active session if it belonged to this deleted business
  if (typeof sessionStorage !== 'undefined') {
    try {
      const sessionsRaw = sessionStorage.getItem('flowscape_sessions_v1');
      if (sessionsRaw) {
        const sess = JSON.parse(sessionsRaw);
        if (sess?.admin?.businessId === id || sess?.counter?.businessId === id) {
          sessionStorage.removeItem('flowscape_sessions_v1');
        }
      }
    } catch {}
  }

  // 3. Remove business from the registered business directory
  const filtered = businesses.filter((b) => b.id !== id);
  saveBusinesses(filtered);

  // 4. If deleted business was currently active, switch to first available or clear
  const activeId = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY);
  if (activeId === id) {
    if (filtered.length > 0) {
      setActiveBusiness(filtered[0].id);
    } else {
      localStorage.removeItem(ACTIVE_BUSINESS_ID_KEY);
    }
  }

  return { success: true, deletedBusiness: targetBiz };
}

/**
 * Authenticate Developer Superadmin credentials
 */
export function authenticateDeveloper(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const currentCreds = getDeveloperCredentials();
  const currentPassword = getDeveloperPassword();

  if (cleanEmail !== currentCreds.email.toLowerCase()) {
    return { success: false, error: `Invalid Developer ID. Enter authorized developer email (${currentCreds.email}) and master access key.` };
  }

  // If no password configured in database yet, initialize and retain this password in database
  if (!currentPassword) {
    if (cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long to initialize and retain master developer password in database.' };
    }
    const updateRes = updateDeveloperPassword(cleanPass, null, { isReset: true, bypassOldCheck: true });
    if (!updateRes.success) {
      return { success: false, error: updateRes.error };
    }
  } else {
    // Constant-time cryptographic verification of master credentials against database
    const isMatch = timingSafeEqual(cleanPass, currentPassword);
    if (!isMatch) {
      return { success: false, error: 'Invalid Developer credentials. Master access key does not match database record.' };
    }
  }

  const session = {
    role: 'developer',
    name: currentCreds.name,
    email: currentCreds.email,
    token: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    authenticatedAt: new Date().toISOString()
  };
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(DEV_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    }
  } catch {}
  return { success: true, session };
}

/**
 * Check if developer is currently authenticated in this browser tab session
 */
export function isDeveloperAuthenticated() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    }
    if (typeof sessionStorage === 'undefined') return false;
    const raw = sessionStorage.getItem(DEV_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    return Boolean(session && session.token && session.role === 'developer');
  } catch {
    return false;
  }
}

/**
 * Logout Developer Superadmin
 */
export function logoutDeveloper() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEV_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * Authenticate a business owner by email and pin against all registered businesses
 */
export function authenticateBusinessOwner(email, pin) {
  const businesses = getBusinesses();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPin = (pin || '').toString().trim();

  const emailCheck = validateEmail(cleanEmail);
  if (!emailCheck.valid) {
    return { success: false, error: emailCheck.error };
  }

  if (!cleanPin || cleanPin.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const business = businesses.find((b) => {
    if ((b.owner?.email || '').toLowerCase() !== cleanEmail) return false;
    const storedPin = String(b.owner?.pin || '').trim();
    return timingSafeEqual(storedPin, cleanPin);
  });

  if (business) {
    if (business.status === 'suspended' && business.emailVerified !== false) {
      return {
        success: false,
        isSuspended: true,
        business,
        error: `Access Denied: Business account "${business.name}" has been suspended by the platform administrator. Please contact developer support.`
      };
    }
    if (business.emailVerified === false || business.status === 'suspended') {
      return {
        success: false,
        isUnverified: true,
        business,
        error: `Business account "${business.name}" is suspended pending email verification. Please verify your email with Firebase before logging in.`
      };
    }
    if (business.status !== 'active') {
      return { success: false, error: `Business account "${business.name}" is currently ${business.status}. Contact Developer Support.` };
    }
    // Set this business as active
    setActiveBusiness(business.id);
    return {
      success: true,
      business,
      session: {
        role: 'admin',
        businessId: business.id,
        businessName: business.name,
        name: business.owner.name,
        email: business.owner.email,
        branch: business.city,
        token: `admin_${business.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: 'admin'
      }
    };
  }

  return { success: false, error: 'Incorrect Owner credentials or PIN for this business.' };
}

/**
 * Authenticate counterperson against active or matching business by PIN
 */
export function authenticateCounterByPin(pin, cashierName, activeBusinessId = null) {
  const businesses = getBusinesses();
  const cleanPin = (pin || '').toString().trim();
  const name = (cashierName || '').trim() || 'Counter Staff';

  // Check strictly against active business or explicitly selected business
  const targetBiz = activeBusinessId
    ? businesses.find((b) => b.id === activeBusinessId)
    : getActiveBusiness();

  if (!targetBiz) {
    return { success: false, error: 'Target business account not found.' };
  }

  if (targetBiz.status !== 'active') {
    return { success: false, error: `Business account "${targetBiz.name}" is currently ${targetBiz.status}. Contact Administrator.` };
  }

  if (targetBiz.counter.pin === cleanPin || targetBiz.owner.pin === cleanPin) {
    const isAdminOverride = targetBiz.owner.pin === cleanPin;
    return {
      success: true,
      business: targetBiz,
      session: {
        role: 'counter',
        businessId: targetBiz.id,
        businessName: targetBiz.name,
        name: isAdminOverride ? `${targetBiz.owner.name} (Admin Override)` : name,
        terminal: targetBiz.counter.terminalName,
        token: `pos_${targetBiz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: isAdminOverride ? 'admin' : 'counter'
      }
    };
  }

  return { success: false, error: 'Invalid POS PIN. Enter the 6-digit PIN for your business counter terminal.' };
}

/**
 * Authenticate counter staff member by manual Login ID (e.g. @sunil.pos) and 6-digit PIN.
 * Searches across ALL registered businesses and shops on the platform.
 * Automatically resolves and switches to the staff member's respective business account dashboard.
 */
export function authenticateStaffMemberByLoginId(loginId, pin) {
  const cleanLoginId = (loginId || '').replace(/^@/, '').trim().toLowerCase();
  const cleanPin = (pin || '').toString().trim();

  if (!cleanLoginId) {
    return { success: false, error: 'Please enter your Staff Login ID (e.g. @username.pos).' };
  }

  if (!/^\d{4,6}$/.test(cleanPin)) {
    return { success: false, error: 'Staff POS PIN must be 4 to 6 numeric digits.' };
  }

  const businesses = getBusinesses();

  // 1. Iterate across all registered businesses and check their active staff records
  for (const b of businesses) {
    let staffList = [];

    // Source A: Attached directly to business record
    if (Array.isArray(b.staff) && b.staff.length > 0) {
      staffList = b.staff;
    }

    // Source B: Multi-tenant scoped keys in localStorage (checking authoritative ontap_v5 and fallbacks)
    if ((!Array.isArray(staffList) || staffList.length === 0) && typeof localStorage !== 'undefined') {
      const candidateKeys = [
        `ontap_v5_staff_${(b.id || '').toLowerCase()}`,
        `staff_${b.id}`,
        `${b.id}_staff`,
        `flowscape_staff_inr_v2_${b.id}`
      ].filter(Boolean);

      for (const k of candidateKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              staffList = parsed;
              break;
            }
          }
        } catch {}
      }
    }

    // Source C: Initial staff fallback
    if (!Array.isArray(staffList) || staffList.length === 0) {
      staffList = initialStaffByBusiness?.[b.id] || [];
    }

    // Check staff in this business
    for (const emp of staffList) {
      const empLoginRaw = String(emp.loginId || '').replace(/^@/, '').trim().toLowerCase();
      const empNameSlug = (emp.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const empPosSlug = empNameSlug ? `${empNameSlug}.pos` : '';
      const empLoginFull = empLoginRaw || empPosSlug;

      const cleanBase = cleanLoginId.replace(/\.pos$/, '');
      const empBase = empLoginRaw.replace(/\.pos$/, '');

      const isLoginMatch =
        cleanLoginId === empLoginFull ||
        cleanLoginId === empLoginRaw ||
        cleanLoginId === empPosSlug ||
        (cleanBase && cleanBase === empBase) ||
        (cleanBase && cleanBase === empNameSlug);

      if (isLoginMatch) {
        if (b.status === 'suspended' && b.emailVerified !== false) {
          return {
            success: false,
            error: `Access Denied: Business "${b.name}" has been suspended by the platform administrator. Please contact developer support.`
          };
        }
        if (b.status === 'suspended' || b.emailVerified === false) {
          return {
            success: false,
            error: `Access Denied: Business "${b.name}" is currently suspended pending email verification.`
          };
        }

        if (emp.status === 'resigned' || emp.status === 'inactive') {
          return {
            success: false,
            error: `Staff account "@${emp.loginId || cleanLoginId}" is marked as inactive or resigned. Please contact your store manager.`
          };
        }

        const storedPin = String(emp.pin || '').trim();
        const ownerPin = String(b.owner?.pin || '').trim();
        const counterPin = String(b.counter?.pin || '').trim();

        const isPinMatch =
          timingSafeEqual(storedPin, cleanPin) ||
          (cleanPin.length === 6 && timingSafeEqual(storedPin, cleanPin.slice(0, 4))) ||
          (storedPin.length === 6 && timingSafeEqual(storedPin.slice(0, 4), cleanPin)) ||
          timingSafeEqual(ownerPin, cleanPin) ||
          timingSafeEqual(counterPin, cleanPin);

        if (isPinMatch) {
          setActiveBusiness(b.id);
          return {
            success: true,
            business: b,
            session: {
              role: 'counter',
              businessId: b.id,
              businessName: b.name,
              staffId: emp.id,
              name: emp.name,
              staffRole: emp.role || 'POS Associate',
              loginId: emp.loginId || cleanLoginId,
              terminal: b.counter?.terminalName || 'POS Terminal 01',
              permissions: emp.permissions || { canEditPrice: false, canCreateDiscounts: false },
              token: `pos_${b.id}_${Date.now()}`,
              authenticatedAt: new Date().toISOString(),
              authenticatedBy: 'counter'
            }
          };
        } else {
          return {
            success: false,
            error: `Incorrect PIN for staff member "@${emp.loginId || cleanLoginId}". Check with your store owner for the correct PIN.`
          };
        }
      }
    }

    // 2. Also check if login ID matches the business terminal name or owner override
    const terminalSlug = (b.counter?.terminalName || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.pos';
    const bizSlug = (b.id || '').replace(/^biz_/, '') + '.pos';
    const bizNameSlug = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '.pos';
    const ownerEmail = (b.owner?.email || '').toLowerCase();

    if (
      cleanLoginId === terminalSlug ||
      cleanLoginId === bizSlug ||
      cleanLoginId === bizNameSlug ||
      cleanLoginId === 'pos'
    ) {
      if (String(b.counter?.pin || '').trim() === cleanPin || String(b.owner?.pin || '').trim() === cleanPin) {
        setActiveBusiness(b.id);
        return {
          success: true,
          business: b,
          session: {
            role: 'counter',
            businessId: b.id,
            businessName: b.name,
            staffId: `terminal_${b.id}`,
            name: `${b.name} Counter`,
            staffRole: 'Station Terminal',
            loginId: cleanLoginId,
            terminal: b.counter?.terminalName || 'POS Terminal 01',
            token: `pos_${b.id}_${Date.now()}`,
            authenticatedAt: new Date().toISOString(),
            authenticatedBy: 'terminal'
          }
        };
      }
    }

    if (cleanLoginId === 'admin.owner' || cleanLoginId === ownerEmail || cleanLoginId === 'owner') {
      if (String(b.owner?.pin || '').trim() === cleanPin) {
        setActiveBusiness(b.id);
        return {
          success: true,
          business: b,
          session: {
            role: 'counter',
            businessId: b.id,
            businessName: b.name,
            staffId: '__owner_admin__',
            name: `${b.owner.name} (Owner)`,
            staffRole: 'Owner',
            loginId: 'admin.owner',
            terminal: b.counter?.terminalName || 'POS Terminal 01',
            token: `pos_${b.id}_${Date.now()}`,
            authenticatedAt: new Date().toISOString(),
            authenticatedBy: 'admin'
          }
        };
      }
    }
  }

  return {
    success: false,
    error: `No staff member or terminal found with Login ID "@${cleanLoginId}". Check your Staff Login ID or consult your shop manager.`
  };
}
