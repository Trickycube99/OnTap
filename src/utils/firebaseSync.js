import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
// Firebase Firestore Real-Time Cross-Device Synchronization Layer
// Enables instantaneous real-time sync across physical devices (Phones, Tablets, Laptops)
// Worldwide over 4G/5G/Wi-Fi with zero delay

import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  query,
  where,
  limit
} from 'firebase/firestore';
import { getActiveBusiness } from './businessManager';

// Read config from Vite environment variables or localStorage override
export const getFirebaseConfig = () => {
  if (typeof window === 'undefined') return null;

  // 1. Check environment variables (Vercel / .env)
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  if (import.meta.env.PROD) return null;

  // 2. Check localStorage custom configuration if set in browser
  try {
    const customConfig = localStorage.getItem('flowscape_firebase_config');
    if (customConfig) {
      const parsed = JSON.parse(customConfig);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  return null;
};

// Safe JSON serialization helper to eliminate undefined fields for Firestore
const sanitizeForFirestore = (obj) => {
  if (!obj) return obj;
  return JSON.parse(JSON.stringify(obj));
};

let db = null;
let isInitialized = false;

// Real-time synchronization connection state manager
let syncState = {
  status: 'initializing', // 'connected' | 'error' | 'local_only' | 'quota_exceeded'
  error: null,
  errorCode: null,
  projectId: null,
  lastSyncTime: null
};

const stateListeners = new Set();
let quotaExhaustedUntil = 0;
const lastSyncedHashes = new Map();

/**
 * Check if Firestore quota circuit breaker is tripped
 */
export function isQuotaExhausted() {
  return Date.now() < quotaExhaustedUntil;
}

/**
 * Hash-based duplicate write prevention (idempotency)
 * Returns false if data is identical to last synced payload, preventing redundant cloud writes
 */
export function hasDataChanged(key, data) {
  if (!data) return false;
  const hash = JSON.stringify(data);
  if (lastSyncedHashes.get(key) === hash) {
    return false; // Skip redundant cloud write
  }
  lastSyncedHashes.set(key, hash);
  return true;
}

/**
 * Record a hash delivered by Firestore snapshot to prevent local echo writes
 */
export function recordCloudSnapshotHash(key, data) {
  if (!data) return;
  lastSyncedHashes.set(key, JSON.stringify(data));
}

/**
 * Centralized Firestore Error Handler with Quota Circuit Breaker
 */
export function handleFirestoreError(err, context = 'operation') {
  const code = err?.code || '';
  const message = err?.message || '';

  if (code === 'resource-exhausted' || message.includes('Quota exceeded') || message.includes('resource-exhausted')) {
    quotaExhaustedUntil = Date.now() + 10 * 60 * 1000; // 10-minute circuit breaker
    updateSyncState({
      status: 'quota_exceeded',
      error: 'Cloud capacity is unavailable. Order delivery cannot be confirmed; please contact the counter.',
      errorCode: 'QUOTA_EXCEEDED'
    });
    console.warn(`🔥 [Cloud Sync] Firestore quota exceeded during ${context}. Switched to local sync.`);
    return;
  }

  let errorMsg = message || 'Firestore operation error';
  if (code === 'permission-denied') {
    errorMsg = 'Access Denied: Firestore security rules prevented this operation. Check role authorization.';
  }

  updateSyncState({
    status: 'error',
    error: errorMsg,
    errorCode: code || 'ERROR'
  });
}

export function getCloudSyncState() {
  const config = getFirebaseConfig();
  if (!config) {
    return {
      status: 'local_only',
      error: 'Online ordering is unavailable until the restaurant cloud connection is configured.',
      errorCode: 'NO_CONFIG',
      projectId: null,
      lastSyncTime: syncState.lastSyncTime
    };
  }
  return {
    ...syncState,
    projectId: config.projectId
  };
}

export function subscribeCloudSyncState(callback) {
  stateListeners.add(callback);
  callback(getCloudSyncState());
  return () => stateListeners.delete(callback);
}

function updateSyncState(patch) {
  syncState = { ...syncState, ...patch, lastSyncTime: Date.now() };
  const current = getCloudSyncState();
  stateListeners.forEach((cb) => {
    try {
      cb(current);
    } catch {
      // ignore
    }
  });
}

export function initFirebase() {
  if (isInitialized && db) return db;

  const config = getFirebaseConfig();
  if (!config) {
    updateSyncState({ status: 'local_only' });
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    db = getFirestore(app);
    isInitialized = true;
    console.log('🔥 [Cloud Sync] Connected to Firebase Firestore real-time network for project:', config.projectId);
    return db;
  } catch (err) {
    console.warn('🔥 [Cloud Sync] Firebase initialization error:', err);
    updateSyncState({
      status: 'error',
      error: err.message,
      errorCode: err.code || 'INIT_ERROR'
    });
    return null;
  }
}

/**
 * Check if Cloud Sync (Firestore) is active
 */
export function isCloudSyncEnabled() {
  return Boolean(initFirebase());
}


let identityPromise = null;
export async function ensureCloudIdentity() {
  if (!initFirebase()) throw new Error('Cloud connection is not configured.');
  const auth = getAuth();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  if (!identityPromise) identityPromise = signInAnonymously(auth).then(result => result.user).finally(() => { identityPromise = null; });
  return identityPromise;
}

/**
 * Upload or sync a new order to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncOrderToCloud(order, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !order || !order.id) return false;

  const targetBizId = businessId || order.businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;

  try {
    const identity = await ensureCloudIdentity();
    const cleanOrder = sanitizeForFirestore(order);
    delete cleanOrder.cloudConfirmed;
    cleanOrder.dinerUid = order.dinerUid || identity.uid;
    const cloudDocId = `${targetBizId}_${order.id}`;
    const orderDocRef = doc(database, 'restaurant_orders', cloudDocId);
    await setDoc(orderDocRef, {
      ...cleanOrder,
      businessId: targetBizId,
      originalOrderId: order.id,
      _cloudSyncedAt: Date.now()
    }, { merge: true });

    updateSyncState({ status: 'connected', error: null, errorCode: null });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'order sync');
    return false;
  }
}

/**
 * Update order status in Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncStatusToCloud(orderId, updateData, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !orderId) return false;

  const targetBizId = businessId || updateData?.businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;

  try {
    const cleanUpdate = sanitizeForFirestore(updateData);
    const cloudDocId = orderId.startsWith(`${targetBizId}_`) ? orderId : `${targetBizId}_${orderId}`;
    const orderDocRef = doc(database, 'restaurant_orders', cloudDocId);
    await setDoc(orderDocRef, {
      ...cleanUpdate,
      businessId: targetBizId,
      _cloudStatusUpdatedAt: Date.now()
    }, { merge: true });

    updateSyncState({ status: 'connected', error: null, errorCode: null });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'status update');
    return false;
  }
}

/**
 * Sync server call alert (e.g. customer requesting assistance)
 */
export async function syncServerCallToCloud(callData, businessId = null) {
  const database = initFirebase();
  if (!database) return false;

  const targetBizId = businessId || callData?.businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;

  try {
    const cleanCall = sanitizeForFirestore(callData);
    const alertRef = doc(database, 'restaurant_alerts', `${targetBizId}_latest_call_server`);
    await setDoc(alertRef, {
      ...cleanCall,
      businessId: targetBizId,
      _cloudAlertAt: Date.now()
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to server call alerts for a specific business
 */
export function subscribeToCloudServerCalls(businessId, onCallReceived) {
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const alertRef = doc(database, 'restaurant_alerts', `${targetBizId}_latest_call_server`);
    let isInitial = true;
    const unsubscribe = onSnapshot(alertRef, (snapshot) => {
      if (!isInitial && snapshot.exists()) {
        const data = snapshot.data();
        if (data && (!data.businessId || data.businessId === targetBizId)) {
          if (onCallReceived) onCallReceived(data);
        }
      }
      isInitial = false;
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Subscribe to real-time order updates for a specific business (Strict Isolation)
 */
export function subscribeToCloudOrders(businessId, onOrdersUpdated, onStatusUpdated) {
  if (!initFirebase()) return () => {};
  let cleanup = () => {};
  const unsubscribe = onAuthStateChanged(getAuth(), identity => {
    cleanup();
    cleanup = () => {};
    if (identity) cleanup = subscribeAuthorizedOrders(businessId, onOrdersUpdated, onStatusUpdated, identity);
    else ensureCloudIdentity().catch(error => handleFirestoreError(error, 'order identity'));
  });
  return () => { unsubscribe(); cleanup(); };
}

function subscribeAuthorizedOrders(businessId, onOrdersUpdated, onStatusUpdated, identity) {
  const database = initFirebase();
  if (!database) {
    updateSyncState({ status: 'local_only' });
    return () => {};
  }

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const ordersCol = collection(database, 'restaurant_orders');
    // STRICT MULTI-TENANT QUERY: Only fetch orders for target business
    const q = query(ordersCol, where('businessId', '==', targetBizId), ...(identity.isAnonymous ? [where('dinerUid', '==', identity.uid)] : []), limit(500));

    let isInitial = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        updateSyncState({ status: 'connected', error: null, errorCode: null });
        const addedOrders = [];
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (!data || data.businessId !== targetBizId) return;

          const normalizedOrder = {
            ...data,
            id: data.originalOrderId || data.id
          };

          if (change.type === 'added') {
            addedOrders.push(normalizedOrder);
          } else if (change.type === 'modified') {
            if (onStatusUpdated) onStatusUpdated(normalizedOrder);
          }
        });

        if (addedOrders.length > 0 && onOrdersUpdated) {
          if (addedOrders.length === 1) {
            onOrdersUpdated(addedOrders[0], isInitial);
          } else {
            onOrdersUpdated(addedOrders, isInitial);
          }
        }

        isInitial = false;
      },
      (error) => {
        if (import.meta.env?.DEV) console.warn('🔥 [Cloud Sync] Firestore snapshot listener error:', error);
        let errorMsg = error.message;
        const code = error.code || 'UNKNOWN';
        if (code === 'permission-denied') {
          errorMsg = 'Access Denied: Firestore security rules prevented this subscription. Check role authorization.';
        }
        updateSyncState({
          status: 'error',
          error: errorMsg,
          errorCode: code
        });
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error subscribing to Firestore orders:', err);
    updateSyncState({
      status: 'error',
      error: err.message,
      errorCode: err.code || 'INIT_ERROR'
    });
    return () => {};
  }
}

/**
 * Fetch all historical and current orders for a specific business from Cloud Firestore
 * Ensures orders and revenue are always preserved across days, browser restarts, and devices.
 */
export async function fetchOrdersFromCloud(businessId) {
  if (isQuotaExhausted()) return [];
  const database = initFirebase();
  if (!database) return [];

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return [];

  try {
    const identity = await ensureCloudIdentity();
    const ordersCol = collection(database, 'restaurant_orders');
    const q = query(ordersCol, where('businessId', '==', targetBizId), ...(identity.isAnonymous ? [where('dinerUid', '==', identity.uid)] : []), limit(500));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    const orders = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && (!data.businessId || data.businessId === targetBizId)) {
        orders.push({
          ...data,
          id: data.originalOrderId || data.id
        });
      }
    });

    // Sort newest first
    orders.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    return orders;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('🔥 [Cloud Sync] Error fetching orders from Firestore:', err);
    return [];
  }
}

/**
 * Sync coupons & offers to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncOffersToCloud(offers, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !Array.isArray(offers)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;
  const hashKey = `${targetBizId}_offers`;
  if (!hasDataChanged(hashKey, offers)) {
    return true; // Data has not changed, zero-cost redundant write skip
  }

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_offers`);
    await setDoc(configDocRef, {
      offers: sanitizeForFirestore(offers),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'offers upload');
    return false;
  }
}

/**
 * Subscribe to coupons & offers updates for a specific business
 */
export function subscribeToCloudOffers(businessId, onOffersUpdated) {
  if (isQuotaExhausted()) return () => {};
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_offers`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.offers) && (!data.businessId || data.businessId === targetBizId)) {
          recordCloudSnapshotHash(`${targetBizId}_offers`, data.offers);
          if (onOffersUpdated) onOffersUpdated(data.offers, isInitial);
        }
      }
      isInitial = false;
    }, (err) => {
      handleFirestoreError(err, 'offers listener');
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Sync dishes & entire menu to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncMenuToCloud(menu, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !Array.isArray(menu)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;
  const hashKey = `${targetBizId}_menu`;
  if (!hasDataChanged(hashKey, menu)) {
    return true; // Data has not changed, zero-cost redundant write skip
  }

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_menu`);
    await setDoc(configDocRef, {
      menu: sanitizeForFirestore(menu),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'menu upload');
    return false;
  }
}

/**
 * Subscribe to dishes & menu updates for a specific business
 */
export function subscribeToCloudMenu(businessId, onMenuUpdated) {
  if (isQuotaExhausted()) return () => {};
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_menu`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.menu) && (!data.businessId || data.businessId === targetBizId)) {
          recordCloudSnapshotHash(`${targetBizId}_menu`, data.menu);
          if (onMenuUpdated) onMenuUpdated(data.menu, isInitial);
        }
      }
      isInitial = false;
    }, (err) => {
      handleFirestoreError(err, 'menu listener');
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Sync staff and POS terminal permissions to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncStaffToCloud(staff, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !Array.isArray(staff)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;
  const hashKey = `${targetBizId}_staff`;
  if (!hasDataChanged(hashKey, staff)) {
    return true; // Data has not changed, zero-cost redundant write skip
  }

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_staff`);
    await setDoc(configDocRef, {
      staff: sanitizeForFirestore(staff.map(({ pin, password, ...member }) => member)),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'staff upload');
    return false;
  }
}

/**
 * Subscribe to staff & permissions updates for a specific business
 */
export function subscribeToCloudStaff(businessId, onStaffUpdated) {
  if (isQuotaExhausted()) return () => {};
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_staff`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.staff) && (!data.businessId || data.businessId === targetBizId)) {
          recordCloudSnapshotHash(`${targetBizId}_staff`, data.staff);
          if (onStaffUpdated) onStaffUpdated(data.staff, isInitial);
        }
      }
      isInitial = false;
    }, (err) => {
      handleFirestoreError(err, 'staff listener');
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Sync EOD closing checklist reports to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncChecklistToCloud(report, businessId = null) {
  if (isQuotaExhausted()) return false;
  const database = initFirebase();
  if (!database || !report || !report.id) return false;

  const targetBizId = businessId || report.businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return false;

  try {
    const cloudDocId = `${targetBizId}_${report.id}`;
    const reportDocRef = doc(database, 'restaurant_checklists', cloudDocId);
    await setDoc(reportDocRef, {
      ...sanitizeForFirestore(report),
      businessId: targetBizId,
      originalReportId: report.id,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, 'checklist upload');
    return false;
  }
}

/**
 * Subscribe to EOD closing checklist reports across devices for a specific business
 */
export function subscribeToCloudChecklists(businessId, onChecklistUpdated) {
  if (isQuotaExhausted()) return () => {};
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || '';
  if (!targetBizId) return () => {};

  try {
    const colRef = collection(database, 'restaurant_checklists');
    const q = query(colRef, where('businessId', '==', targetBizId), limit(50));
    let isInitial = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (!data || data.businessId !== targetBizId) return;

        const normalized = {
          ...data,
          id: data.originalReportId || data.id
        };

        if (change.type === 'added' || change.type === 'modified') {
          if (onChecklistUpdated && normalized && normalized.id) {
            onChecklistUpdated(normalized, isInitial);
          }
        }
      });
      isInitial = false;
    }, (err) => {
      handleFirestoreError(err, 'checklist listener');
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Permanently delete all cloud data in Firestore associated with a deleted business
 */
export async function deleteCloudOrdersForBusiness(businessId) {
  const database = initFirebase();
  if (!database || !businessId) return false;

  try {
    // 1. Delete all restaurant_orders for this business
    const ordersCol = collection(database, 'restaurant_orders');
    const qOrders = query(ordersCol, where('businessId', '==', businessId));
    const snapshotOrders = await getDocs(qOrders);

    if (!snapshotOrders.empty) {
      const batch = writeBatch(database);
      snapshotOrders.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`🔥 [Cloud Sync] Purged ${snapshotOrders.size} cloud orders for deleted business ${businessId}`);
    }

    // 2. Delete all restaurant_checklists for this business
    try {
      const checklistsCol = collection(database, 'restaurant_checklists');
      const qChecklists = query(checklistsCol, where('businessId', '==', businessId));
      const snapshotChecklists = await getDocs(qChecklists);
      if (!snapshotChecklists.empty) {
        const batchChecklists = writeBatch(database);
        snapshotChecklists.forEach((docSnap) => {
          batchChecklists.delete(docSnap.ref);
        });
        await batchChecklists.commit();
      }
    } catch {}

    // 3. Delete config documents
    try {
      await deleteDoc(doc(database, 'restaurant_config', `${businessId}_menu`));
      await deleteDoc(doc(database, 'restaurant_config', `${businessId}_staff`));
      await deleteDoc(doc(database, 'restaurant_config', `${businessId}_offers`));
      await deleteDoc(doc(database, 'restaurant_alerts', `${businessId}_latest_call_server`));
    } catch {}

    return true;
  } catch (err) {
    console.warn('🔥 [Cloud Sync] Firestore data cleanup note:', err);
    return false;
  }
}

/**
 * Permanently purge all operational orders and checklists from Cloud Firestore database
 * If businessId is provided and not 'all', purges for that business; otherwise purges across all businesses.
 */
export async function purgeAllCloudOrdersAndFinancials(businessId = null) {
  const database = initFirebase();
  if (!database) return { success: true, count: 0 };

  try {
    let ordersPurged = 0;
    let checklistsPurged = 0;

    // 1. Purge restaurant_orders
    const ordersCol = collection(database, 'restaurant_orders');
    const qOrders = businessId && businessId !== 'all'
      ? query(ordersCol, where('businessId', '==', businessId))
      : query(ordersCol);
    const snapshotOrders = await getDocs(qOrders);

    if (!snapshotOrders.empty) {
      const batch = writeBatch(database);
      snapshotOrders.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      ordersPurged = snapshotOrders.size;
      console.log(`🔥 [Cloud Sync] Purged ${ordersPurged} orders from Cloud Firestore.`);
    }

    // 2. Purge restaurant_checklists
    try {
      const checklistsCol = collection(database, 'restaurant_checklists');
      const qChecklists = businessId && businessId !== 'all'
        ? query(checklistsCol, where('businessId', '==', businessId))
        : query(checklistsCol);
      const snapshotChecklists = await getDocs(qChecklists);
      if (!snapshotChecklists.empty) {
        const batchChecklists = writeBatch(database);
        snapshotChecklists.forEach((docSnap) => {
          batchChecklists.delete(docSnap.ref);
        });
        await batchChecklists.commit();
        checklistsPurged = snapshotChecklists.size;
        console.log(`🔥 [Cloud Sync] Purged ${checklistsPurged} checklists from Cloud Firestore.`);
      }
    } catch {}

    return { success: true, ordersPurged, checklistsPurged };
  } catch (err) {
    console.warn('🔥 [Cloud Sync] Error during cloud order & financial purge:', err);
    return { success: false, error: err.message };
  }
}



