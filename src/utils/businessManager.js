// Multi-Tenant Business & Developer Account Manager for Restaurant OS
// Enables Developer Admin to manage the entire platform, create/manage multiple business accounts,
// and authenticate distinct business owners with their own credentials.


export const BUSINESSES_STORAGE_KEY = 'flowscape_businesses_v1';
export const ACTIVE_BUSINESS_ID_KEY = 'flowscape_active_business_id_v1';
export const DEV_SESSION_STORAGE_KEY = 'flowscape_dev_session_v1';

// Developer Superadmin Credentials (strictly manual login, zero autofill)
export const DEVELOPER_CREDENTIALS = {
  email: 'dev@platform.com',
  name: 'Platform Lead Developer',
  role: 'developer'
};

// Initial default business accounts configured on platform
export const DEFAULT_BUSINESSES = [
  {
    id: 'biz_advait',
    name: 'Advait Artisanal Kitchen',
    tagline: 'Progressive Indian Table & Craft Kitchen',
    category: 'Fine Dining / Artisanal',
    city: 'Connaught Place, New Delhi',
    plan: 'Enterprise',
    status: 'active',
    emailVerified: true,
    owner: {
      name: 'Sanjay Malhotra',
      email: 'admin@advaitkitchen.com',
      pin: '882100'
    },
    counter: {
      pin: '442100',
      terminalName: 'POS-01 (Flagship CP)'
    },
    upiId: '9119069179@nyes',
    tables: ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05', 'Table 06', 'Takeaway'],
    accentColor: '#007AFF',
    totalOrders: 142,
    gmv: 184500,
    createdAt: '2026-08-15T10:00:00.000Z'
  },
  {
    id: 'biz_copper_chimney',
    name: 'Copper Chimney Grill & Bar',
    tagline: 'Charcoal Tandoor & Mughlai Heritage',
    category: 'Casual Dining & Bar',
    city: 'Bandra West, Mumbai',
    plan: 'Pro',
    status: 'active',
    emailVerified: true,
    owner: {
      name: 'Priya Nair',
      email: 'priya@copperchimney.in',
      pin: '552200'
    },
    counter: {
      pin: '331100',
      terminalName: 'POS-01 (Bandra)'
    },
    upiId: 'copperchimney@upi',
    tables: ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Bar 01', 'Bar 02'],
    accentColor: '#F59E0B',
    totalOrders: 89,
    gmv: 112400,
    createdAt: '2026-09-01T11:30:00.000Z'
  },
  {
    id: 'biz_chai_point',
    name: 'Chai Point Cafe & Bakery',
    tagline: 'Artisanal Teas, Cold Brews & Puffs',
    category: 'QSR / Cafe',
    city: 'Indiranagar, Bengaluru',
    plan: 'Starter',
    status: 'active',
    emailVerified: true,
    owner: {
      name: 'Amit Deshmukh',
      email: 'amit@chaipoint.com',
      pin: '771100'
    },
    counter: {
      pin: '220000',
      terminalName: 'Express Counter 01'
    },
    upiId: 'chaipoint@upi',
    tables: ['Table 01', 'Table 02', 'Table 03', 'Counter Pickup'],
    accentColor: '#10B981',
    totalOrders: 215,
    gmv: 86500,
    createdAt: '2026-09-20T09:15:00.000Z'
  }
];

/**
 * Retrieve all registered business accounts
 */
export function getBusinesses() {
  try {
    const raw = localStorage.getItem(BUSINESSES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(DEFAULT_BUSINESSES));
      return DEFAULT_BUSINESSES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(DEFAULT_BUSINESSES));
      return DEFAULT_BUSINESSES;
    }

    // Automatically migrate any legacy 4-digit PINs to standard 6-digit PINs (e.g. 8821 -> 882100)
    let needsMigration = false;
    const migrated = parsed.map((b) => {
      let updatedOwnerPin = b.owner?.pin ? String(b.owner.pin).trim() : '882100';
      let updatedCounterPin = b.counter?.pin ? String(b.counter.pin).trim() : '442100';
      if (updatedOwnerPin.length < 6) {
        updatedOwnerPin = updatedOwnerPin.padEnd(6, '0');
        needsMigration = true;
      }
      if (updatedCounterPin.length < 6) {
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
    return DEFAULT_BUSINESSES;
  }
}

/**
 * Save businesses list to localStorage and dispatch local event
 */
export function saveBusinesses(businesses) {
  try {
    localStorage.setItem(BUSINESSES_STORAGE_KEY, JSON.stringify(businesses));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowscape_businesses_updated', { detail: businesses }));
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
  const activeId = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY) || 'biz_advait';
  const found = businesses.find((b) => b.id === activeId);
  return found || businesses[0] || DEFAULT_BUSINESSES[0];
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
  const trimmedCounterPin = (data.counterPin || '').toString().trim();

  // Validate exactly 6-digit numeric PINs
  if (!/^\d{6}$/.test(trimmedOwnerPin)) {
    return { success: false, error: 'Owner Admin PIN must be exactly 6 digits.' };
  }
  if (!/^\d{6}$/.test(trimmedCounterPin)) {
    return { success: false, error: 'Counter Staff POS PIN must be exactly 6 digits.' };
  }

  // Validate unique PIN across all businesses
  const pinInUse = businesses.some(
    (b) => b.owner.pin === trimmedOwnerPin ||
           b.counter.pin === trimmedOwnerPin ||
           b.owner.pin === trimmedCounterPin ||
           b.counter.pin === trimmedCounterPin
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
  const newBusiness = {
    id,
    name: (data.name || '').trim() || 'New Craft Restaurant',
    tagline: (data.tagline || '').trim() || 'Artisanal Flavours & Hospitality',
    category: data.category || 'Casual Dining',
    city: (data.city || '').trim() || 'New Delhi, India',
    plan: data.plan || 'Starter',
    status: data.status ? data.status : (data.emailVerified === true ? 'active' : 'suspended'),
    emailVerified: data.emailVerified === true ? true : false,
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
    tables: data.tables && data.tables.length > 0
      ? data.tables
      : ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Counter / Takeaway'],
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
      if (!/^\d{6}$/.test(cleanPin)) {
        return { success: false, error: 'Owner Master PIN must be exactly 6 numeric digits (e.g. 882100).' };
      }
      updates.owner.pin = cleanPin;
    }
  }

  // Validate counter updates if provided
  if (updates.counter && updates.counter.pin !== undefined) {
    const cleanCounterPin = String(updates.counter.pin).trim();
    if (!/^\d{6}$/.test(cleanCounterPin)) {
      return { success: false, error: 'Counter POS PIN must be exactly 6 numeric digits (e.g. 442100).' };
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
  const businesses = getBusinesses();
  if (businesses.length <= 1) {
    return { success: false, error: 'Cannot delete the only remaining business on the platform.' };
  }

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

  // 4. If deleted business was currently active, switch to first available
  const activeId = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY);
  if (activeId === id) {
    setActiveBusiness(filtered[0].id);
  }

  return { success: true, deletedBusiness: targetBiz };
}

/**
 * Authenticate Developer Superadmin credentials
 */
export function authenticateDeveloper(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const masterKey = import.meta.env?.VITE_DEV_PASSWORD || 'dev@root2026';

  if (
    cleanEmail === DEVELOPER_CREDENTIALS.email.toLowerCase() &&
    cleanPass === masterKey
  ) {
    const session = {
      role: 'developer',
      name: DEVELOPER_CREDENTIALS.name,
      email: DEVELOPER_CREDENTIALS.email,
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

  return { success: false, error: 'Invalid Developer credentials. Enter authorized developer email and master access key.' };
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

  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return { success: false, error: 'Please enter a valid owner email address.' };
  }

  if (!/^\d{6}$/.test(cleanPin)) {
    return { success: false, error: 'Owner Master PIN must be exactly 6 numeric digits.' };
  }

  const business = businesses.find(
    (b) => b.owner.email.toLowerCase() === cleanEmail && b.owner.pin === cleanPin
  );

  if (business) {
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
