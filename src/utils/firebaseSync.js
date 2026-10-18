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
  status: 'initializing', // 'connected' | 'error' | 'local_only'
  error: null,
  errorCode: null,
  projectId: null,
  lastSyncTime: null
};

const stateListeners = new Set();

export function getCloudSyncState() {
  const config = getFirebaseConfig();
  if (!config) {
    return {
      status: 'local_only',
      error: 'Firebase environment variables not detected. Local network sync active.',
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

/**
 * Upload or sync a new order to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncOrderToCloud(order, businessId = null) {
  const database = initFirebase();
  if (!database || !order || !order.id) return false;

  const targetBizId = businessId || order.businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const cleanOrder = sanitizeForFirestore(order);
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
    console.error('🔥 [Cloud Sync] Error uploading order to Firestore:', err);
    let errorMsg = err.message;
    if (err.code === 'permission-denied') {
      errorMsg = 'Firestore Security Rules are locked. Please set rules to allow read, write in Firebase Console.';
    }
    updateSyncState({
      status: 'error',
      error: errorMsg,
      errorCode: err.code || 'WRITE_ERROR'
    });
    return false;
  }
}

/**
 * Update order status in Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncStatusToCloud(orderId, updateData, businessId = null) {
  const database = initFirebase();
  if (!database || !orderId) return false;

  const targetBizId = businessId || updateData?.businessId || getActiveBusiness()?.id || 'biz_advait';

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
    console.error('🔥 [Cloud Sync] Error updating status in Firestore:', err);
    let errorMsg = err.message;
    if (err.code === 'permission-denied') {
      errorMsg = 'Firestore Security Rules are locked. Please set rules to allow read, write in Firebase Console.';
    }
    updateSyncState({
      status: 'error',
      error: errorMsg,
      errorCode: err.code || 'UPDATE_ERROR'
    });
    return false;
  }
}

/**
 * Sync server call alert (e.g. customer requesting assistance)
 */
export async function syncServerCallToCloud(callData, businessId = null) {
  const database = initFirebase();
  if (!database) return false;

  const targetBizId = businessId || callData?.businessId || getActiveBusiness()?.id || 'biz_advait';

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

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

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
  const database = initFirebase();
  if (!database) {
    updateSyncState({ status: 'local_only' });
    return () => {};
  }

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const ordersCol = collection(database, 'restaurant_orders');
    // STRICT MULTI-TENANT QUERY: Only fetch orders for target business
    const q = query(ordersCol, where('businessId', '==', targetBizId), limit(100));

    let isInitial = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        updateSyncState({ status: 'connected', error: null, errorCode: null });
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (!data || data.businessId !== targetBizId) return;

          const normalizedOrder = {
            ...data,
            id: data.originalOrderId || data.id
          };

          if (change.type === 'added') {
            if (onOrdersUpdated) onOrdersUpdated(normalizedOrder, isInitial);
          } else if (change.type === 'modified') {
            if (onStatusUpdated) onStatusUpdated(normalizedOrder);
          }
        });
        isInitial = false;
      },
      (error) => {
        console.warn('🔥 [Cloud Sync] Firestore snapshot listener error:', error);
        let errorMsg = error.message;
        const code = error.code || 'UNKNOWN';
        if (code === 'permission-denied') {
          errorMsg = 'Firestore Security Rules are locked. Please set rules to allow read, write in Firebase Console.';
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
 * Sync coupons & offers to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncOffersToCloud(offers, businessId = null) {
  const database = initFirebase();
  if (!database || !Array.isArray(offers)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_offers`);
    await setDoc(configDocRef, {
      offers: sanitizeForFirestore(offers),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading offers to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to coupons & offers updates for a specific business
 */
export function subscribeToCloudOffers(businessId, onOffersUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_offers`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.offers) && (!data.businessId || data.businessId === targetBizId)) {
          if (onOffersUpdated) onOffersUpdated(data.offers, isInitial);
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
 * Sync dishes & entire menu to Firebase Firestore (Cross-Device, Multi-Tenant)
 */
export async function syncMenuToCloud(menu, businessId = null) {
  const database = initFirebase();
  if (!database || !Array.isArray(menu)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_menu`);
    await setDoc(configDocRef, {
      menu: sanitizeForFirestore(menu),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] Menu successfully synced to Firestore for business ${targetBizId} (${menu.length} items)`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading menu to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to dishes & menu updates for a specific business
 */
export function subscribeToCloudMenu(businessId, onMenuUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_menu`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.menu) && (!data.businessId || data.businessId === targetBizId)) {
          console.log(`🔥 [Cloud Sync] Received menu update from Firestore for ${targetBizId} (${data.menu.length} items, initial: ${isInitial})`);
          if (onMenuUpdated) onMenuUpdated(data.menu, isInitial);
        }
      }
      isInitial = false;
    }, (err) => {
      console.warn('🔥 [Cloud Sync] Error listening to menu changes:', err);
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
  const database = initFirebase();
  if (!database || !Array.isArray(staff)) return false;

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_staff`);
    await setDoc(configDocRef, {
      staff: sanitizeForFirestore(staff),
      businessId: targetBizId,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] Staff & Permissions successfully synced to Firestore for business ${targetBizId} (${staff.length} staff)`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading staff to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to staff & permissions updates for a specific business
 */
export function subscribeToCloudStaff(businessId, onStaffUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const configDocRef = doc(database, 'restaurant_config', `${targetBizId}_staff`);
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.staff) && (!data.businessId || data.businessId === targetBizId)) {
          console.log(`🔥 [Cloud Sync] Received staff update from Firestore for ${targetBizId} (${data.staff.length} staff, initial: ${isInitial})`);
          if (onStaffUpdated) onStaffUpdated(data.staff, isInitial);
        }
      }
      isInitial = false;
    }, (err) => {
      console.warn('🔥 [Cloud Sync] Error listening to staff changes:', err);
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
  const database = initFirebase();
  if (!database || !report || !report.id) return false;

  const targetBizId = businessId || report.businessId || getActiveBusiness()?.id || 'biz_advait';

  try {
    const cloudDocId = `${targetBizId}_${report.id}`;
    const reportDocRef = doc(database, 'restaurant_checklists', cloudDocId);
    await setDoc(reportDocRef, {
      ...sanitizeForFirestore(report),
      businessId: targetBizId,
      originalReportId: report.id,
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] EOD Checklist successfully synced to Firestore (${report.id}) for business ${targetBizId}`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading EOD checklist to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to EOD closing checklist reports across devices for a specific business
 */
export function subscribeToCloudChecklists(businessId, onChecklistUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  const targetBizId = businessId || getActiveBusiness()?.id || 'biz_advait';

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
      console.warn('🔥 [Cloud Sync] Error listening to checklists changes:', err);
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



