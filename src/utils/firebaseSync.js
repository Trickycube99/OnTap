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
  onSnapshot,
  query,
  limit
} from 'firebase/firestore';

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
 * Upload or sync a new order to Firebase Firestore (Cross-Device)
 */
export async function syncOrderToCloud(order) {
  const database = initFirebase();
  if (!database || !order || !order.id) return false;

  try {
    const cleanOrder = sanitizeForFirestore(order);
    const orderDocRef = doc(database, 'restaurant_orders', order.id);
    await setDoc(orderDocRef, {
      ...cleanOrder,
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
 * Update order status in Firebase Firestore (Cross-Device)
 */
export async function syncStatusToCloud(orderId, updateData) {
  const database = initFirebase();
  if (!database || !orderId) return false;

  try {
    const cleanUpdate = sanitizeForFirestore(updateData);
    const orderDocRef = doc(database, 'restaurant_orders', orderId);
    await updateDoc(orderDocRef, {
      ...cleanUpdate,
      _cloudStatusUpdatedAt: Date.now()
    });

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
export async function syncServerCallToCloud(callData) {
  const database = initFirebase();
  if (!database) return false;

  try {
    const cleanCall = sanitizeForFirestore(callData);
    const alertRef = doc(database, 'restaurant_alerts', 'latest_call_server');
    await setDoc(alertRef, {
      ...cleanCall,
      _cloudAlertAt: Date.now()
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to server call alerts
 */
export function subscribeToCloudServerCalls(onCallReceived) {
  const database = initFirebase();
  if (!database) return () => {};

  try {
    const alertRef = doc(database, 'restaurant_alerts', 'latest_call_server');
    let isInitial = true;
    const unsubscribe = onSnapshot(alertRef, (snapshot) => {
      if (!isInitial && snapshot.exists()) {
        const data = snapshot.data();
        if (onCallReceived) onCallReceived(data);
      }
      isInitial = false;
    });
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Subscribe to real-time order updates from all devices
 */
export function subscribeToCloudOrders(onOrdersUpdated, onStatusUpdated) {
  const database = initFirebase();
  if (!database) {
    updateSyncState({ status: 'local_only' });
    return () => {};
  }

  try {
    const ordersCol = collection(database, 'restaurant_orders');
    const q = query(ordersCol, limit(100));

    let isInitial = true;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        updateSyncState({ status: 'connected', error: null, errorCode: null });
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          if (change.type === 'added') {
            if (onOrdersUpdated) onOrdersUpdated(data, isInitial);
          } else if (change.type === 'modified') {
            if (onStatusUpdated) onStatusUpdated(data);
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
 * Sync coupons & offers to Firebase Firestore (Cross-Device)
 */
export async function syncOffersToCloud(offers) {
  const database = initFirebase();
  if (!database || !Array.isArray(offers)) return false;

  try {
    const configDocRef = doc(database, 'restaurant_config', 'offers');
    await setDoc(configDocRef, {
      offers: sanitizeForFirestore(offers),
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading offers to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to coupons & offers updates across devices
 */
export function subscribeToCloudOffers(onOffersUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', 'offers');
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.offers)) {
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
 * Sync dishes & entire menu to Firebase Firestore (Cross-Device)
 */
export async function syncMenuToCloud(menu) {
  const database = initFirebase();
  if (!database || !Array.isArray(menu)) return false;

  try {
    const configDocRef = doc(database, 'restaurant_config', 'menu');
    await setDoc(configDocRef, {
      menu: sanitizeForFirestore(menu),
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] Menu successfully synced to Firestore (${menu.length} items)`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading menu to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to dishes & menu updates across devices in real time
 */
export function subscribeToCloudMenu(onMenuUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', 'menu');
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.menu)) {
          console.log(`🔥 [Cloud Sync] Received menu update from Firestore (${data.menu.length} items, initial: ${isInitial})`);
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
 * Sync staff and POS terminal permissions to Firebase Firestore (Cross-Device)
 */
export async function syncStaffToCloud(staff) {
  const database = initFirebase();
  if (!database || !Array.isArray(staff)) return false;

  try {
    const configDocRef = doc(database, 'restaurant_config', 'staff');
    await setDoc(configDocRef, {
      staff: sanitizeForFirestore(staff),
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] Staff & Permissions successfully synced to Firestore (${staff.length} staff)`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading staff to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to staff & permissions updates across devices in real time
 */
export function subscribeToCloudStaff(onStaffUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  try {
    const configDocRef = doc(database, 'restaurant_config', 'staff');
    let isInitial = true;
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.staff)) {
          console.log(`🔥 [Cloud Sync] Received staff update from Firestore (${data.staff.length} staff, initial: ${isInitial})`);
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
 * Sync EOD closing checklist reports to Firebase Firestore (Cross-Device)
 */
export async function syncChecklistToCloud(report) {
  const database = initFirebase();
  if (!database || !report || !report.id) return false;

  try {
    const reportDocRef = doc(database, 'restaurant_checklists', report.id);
    await setDoc(reportDocRef, {
      ...sanitizeForFirestore(report),
      _cloudSyncedAt: Date.now()
    }, { merge: true });
    console.log(`🔥 [Cloud Sync] EOD Checklist successfully synced to Firestore (${report.id})`);
    return true;
  } catch (err) {
    console.error('🔥 [Cloud Sync] Error uploading EOD checklist to Firestore:', err);
    return false;
  }
}

/**
 * Subscribe to EOD closing checklist reports across devices in real time
 */
export function subscribeToCloudChecklists(onChecklistUpdated) {
  const database = initFirebase();
  if (!database) return () => {};

  try {
    const colRef = collection(database, 'restaurant_checklists');
    const q = query(colRef, limit(50));
    let isInitial = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.type === 'added' || change.type === 'modified') {
          if (onChecklistUpdated && data && data.id) {
            onChecklistUpdated(data, isInitial);
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



