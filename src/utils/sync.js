// Real-Time Cross-Tab, Cross-Window & Cross-Device Event Synchronization
// Connects Customer Table Orders, Counterperson POS Live Queue, and Owner Admin
// Uses Cloud Firestore for multi-device sync + BroadcastChannel for local instant sync (<50ms)

import {
  syncOrderToCloud,
  syncStatusToCloud,
  syncServerCallToCloud,
  syncOffersToCloud,
  syncMenuToCloud,
  syncStaffToCloud,
  syncChecklistToCloud,
  subscribeToCloudOrders,
  subscribeToCloudServerCalls,
  subscribeToCloudOffers,
  subscribeToCloudMenu,
  subscribeToCloudStaff,
  subscribeToCloudChecklists,
  isCloudSyncEnabled,
  getCloudSyncState,
  subscribeCloudSyncState
} from './firebaseSync';
import { getActiveBusiness } from './businessManager';
import { getScopedKey, STORAGE_KEYS } from './storage';

export { getCloudSyncState, subscribeCloudSyncState, isCloudSyncEnabled };

const CHANNEL_NAME = 'flowscape_pos_sync_channel_v1';

let broadcastChannel = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch (err) {
  console.warn('BroadcastChannel not supported in this environment:', err);
}

export const SYNC_EVENTS = {
  NEW_ORDER: 'NEW_ORDER',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
  MENU_UPDATED: 'MENU_UPDATED',
  OFFERS_UPDATED: 'OFFERS_UPDATED',
  EXPENSE_ADDED: 'EXPENSE_ADDED',
  CHECKLIST_SUBMITTED: 'CHECKLIST_SUBMITTED',
  CALL_SERVER: 'CALL_SERVER',
  THEME_UPDATED: 'THEME_UPDATED',
  CHEF_UPDATED: 'CHEF_UPDATED',
  STAFF_UPDATED: 'STAFF_UPDATED',
  BUSINESS_DELETED: 'BUSINESS_DELETED',
  BUSINESSES_UPDATED: 'BUSINESSES_UPDATED',
  CREDENTIALS_UPDATED: 'CREDENTIALS_UPDATED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED'
};

const currentClientId = Math.random().toString(36).substring(2, 9);

/**
 * Broadcast an event to all open tabs, windows and cross-device cloud (Strictly Scoped by Business)
 */
export function broadcastSyncEvent(type, payload = {}, targetBusinessId = null) {
  const currentBizId = targetBusinessId || payload?.businessId || getActiveBusiness()?.id || '';

  const eventMessage = {
    type,
    businessId: currentBizId,
    payload,
    timestamp: Date.now(),
    senderId: currentClientId
  };

  // 1. BroadcastChannel (Local browser instant sync)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(eventMessage);
    } catch (err) {
      console.error('Failed to postMessage on BroadcastChannel:', err);
    }
  }

  // 2. LocalStorage event bus fallback for cross-window reliability on same device
  try {
    localStorage.setItem('flowscape_sync_event_ping', JSON.stringify(eventMessage));
  } catch {
    // Ignore storage quota warnings
  }

  // 3. Cross-Device Cloud Sync (Firebase Firestore - Scoped to Business)
  if (type === SYNC_EVENTS.NEW_ORDER && payload) {
    syncOrderToCloud(payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.ORDER_STATUS_UPDATED && payload && payload.id) {
    syncStatusToCloud(payload.id, payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.CALL_SERVER && payload) {
    syncServerCallToCloud(payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.OFFERS_UPDATED && Array.isArray(payload)) {
    syncOffersToCloud(payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.MENU_UPDATED && Array.isArray(payload)) {
    syncMenuToCloud(payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.STAFF_UPDATED && Array.isArray(payload)) {
    syncStaffToCloud(payload, currentBizId).catch(() => {});
  } else if (type === SYNC_EVENTS.CHECKLIST_SUBMITTED && payload) {
    syncChecklistToCloud(payload, currentBizId).catch(() => {});
  }
}

// Global shared subscriber pool & singleton cloud subscription manager
const activeSubscribers = new Set();
let cloudActiveBizId = null;
let cloudCleanups = [];

function dispatchToSubscribers(msg) {
  if (!msg || !msg.type) return;
  const isPlatformEvent =
    msg.type === SYNC_EVENTS.BUSINESS_DELETED ||
    msg.type === SYNC_EVENTS.BUSINESSES_UPDATED ||
    msg.type === SYNC_EVENTS.CREDENTIALS_UPDATED ||
    msg.type === SYNC_EVENTS.EMAIL_VERIFIED;

  activeSubscribers.forEach((sub) => {
    try {
      if (sub.filterBusinessId && msg.businessId && sub.filterBusinessId !== msg.businessId && !isPlatformEvent) {
        return;
      }
      sub.callback(msg);
    } catch (err) {
      console.warn('Sync subscriber error:', err);
    }
  });
}

// Global BroadcastChannel & storage message listeners (registered once)
if (typeof window !== 'undefined') {
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', (event) => {
      if (event && event.data) {
        dispatchToSubscribers(event.data);
      }
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'flowscape_sync_event_ping' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        dispatchToSubscribers(parsed);
      } catch {}
    }
  });
}

function ensureCloudSync(targetBizId) {
  if (!isCloudSyncEnabled()) return;
  if (cloudActiveBizId === targetBizId && cloudCleanups.length > 0) return;

  // Cleanup old listeners if switching businesses
  cloudCleanups.forEach((unsub) => {
    try { unsub(); } catch {}
  });
  cloudCleanups = [];
  cloudActiveBizId = targetBizId;

  // 1. Orders
  const unOrders = subscribeToCloudOrders(
    targetBizId,
    (newOrder, isInitial) => {
      dispatchToSubscribers({
        type: SYNC_EVENTS.NEW_ORDER,
        businessId: targetBizId,
        payload: newOrder,
        isInitial
      });
    },
    (updatedOrder) => {
      dispatchToSubscribers({
        type: SYNC_EVENTS.ORDER_STATUS_UPDATED,
        businessId: targetBizId,
        payload: updatedOrder
      });
    }
  );
  if (unOrders) cloudCleanups.push(unOrders);

  // 2. Server calls
  const unCalls = subscribeToCloudServerCalls(targetBizId, (callData) => {
    dispatchToSubscribers({
      type: SYNC_EVENTS.CALL_SERVER,
      businessId: targetBizId,
      payload: callData
    });
  });
  if (unCalls) cloudCleanups.push(unCalls);

  // 3. Offers
  const unOffers = subscribeToCloudOffers(targetBizId, (cloudOffers) => {
    dispatchToSubscribers({
      type: SYNC_EVENTS.OFFERS_UPDATED,
      businessId: targetBizId,
      payload: cloudOffers
    });
  });
  if (unOffers) cloudCleanups.push(unOffers);

  // 4. Menu
  const unMenu = subscribeToCloudMenu(targetBizId, (cloudMenu) => {
    dispatchToSubscribers({
      type: SYNC_EVENTS.MENU_UPDATED,
      businessId: targetBizId,
      payload: cloudMenu
    });
  });
  if (unMenu) cloudCleanups.push(unMenu);

  // 5. Staff
  const unStaff = subscribeToCloudStaff(targetBizId, (cloudStaff) => {
    dispatchToSubscribers({
      type: SYNC_EVENTS.STAFF_UPDATED,
      businessId: targetBizId,
      payload: cloudStaff
    });
  });
  if (unStaff) cloudCleanups.push(unStaff);

  // 6. Checklists
  const unChecklists = subscribeToCloudChecklists(targetBizId, (cloudChecklist) => {
    dispatchToSubscribers({
      type: SYNC_EVENTS.CHECKLIST_SUBMITTED,
      businessId: targetBizId,
      payload: cloudChecklist
    });
  });
  if (unChecklists) cloudCleanups.push(unChecklists);
}

/**
 * Subscribe to real-time events across windows and cross-device cloud for a specific business
 * Uses a single shared Cloud Firestore connection to eliminate duplicate listeners and prevent quota exhaustion.
 */
export function subscribeSyncEvents(callback, filterBusinessId = null) {
  if (typeof window === 'undefined') return () => {};

  const sub = { callback, filterBusinessId };
  activeSubscribers.add(sub);

  const targetBizId = filterBusinessId || getActiveBusiness()?.id || '';
  if (targetBizId) {
    ensureCloudSync(targetBizId);
  }

  return () => {
    activeSubscribers.delete(sub);
    if (activeSubscribers.size === 0) {
      cloudCleanups.forEach((unsub) => {
        try { unsub(); } catch {}
      });
      cloudCleanups = [];
      cloudActiveBizId = null;
    }
  };
}
