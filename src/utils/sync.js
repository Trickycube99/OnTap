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

const CHANNEL_NAME = 'advait_restaurant_pos_channel_v1';

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
  CREDENTIALS_UPDATED: 'CREDENTIALS_UPDATED'
};

const currentClientId = Math.random().toString(36).substring(2, 9);

/**
 * Broadcast an event to all open tabs, windows and cross-device cloud (Strictly Scoped by Business)
 */
export function broadcastSyncEvent(type, payload = {}, targetBusinessId = null) {
  const currentBizId = targetBusinessId || payload?.businessId || getActiveBusiness()?.id || 'biz_advait';

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

/**
 * Subscribe to real-time events across windows and cross-device cloud for a specific business
 */
export function subscribeSyncEvents(callback, filterBusinessId = null) {
  if (typeof window === 'undefined') return () => {};

  const isPlatformEvent = (type) =>
    type === SYNC_EVENTS.BUSINESS_DELETED ||
    type === SYNC_EVENTS.BUSINESSES_UPDATED ||
    type === SYNC_EVENTS.CREDENTIALS_UPDATED;

  const handleBroadcast = (event) => {
    if (event && event.data && callback) {
      const msg = event.data;
      const targetBizId = filterBusinessId || getActiveBusiness()?.id;

      // STRICT MULTI-TENANT ISOLATION:
      // Drop any event originating from a different business account (unless platform-wide event)!
      if (msg.businessId && targetBizId && msg.businessId !== targetBizId && !isPlatformEvent(msg.type)) {
        return;
      }
      callback(msg);
    }
  };

  const handleStorage = (e) => {
    const targetBizId = filterBusinessId || getActiveBusiness()?.id;

    if (e.key === 'flowscape_sync_event_ping' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed.businessId && targetBizId && parsed.businessId !== targetBizId && !isPlatformEvent(parsed.type)) {
          return;
        }
        if (callback) callback(parsed);
      } catch (err) {
        console.error('Error parsing storage sync message:', err);
      }
    } else if (targetBizId && e.key === getScopedKey(STORAGE_KEYS.STAFF, targetBizId) && e.newValue) {
      try {
        const parsedStaff = JSON.parse(e.newValue);
        if (Array.isArray(parsedStaff) && callback) {
          callback({
            type: SYNC_EVENTS.STAFF_UPDATED,
            businessId: targetBizId,
            payload: parsedStaff
          });
        }
      } catch (err) {
        console.error('Error parsing direct staff storage sync:', err);
      }
    } else if (targetBizId && e.key === getScopedKey(STORAGE_KEYS.CHECKLISTS, targetBizId) && e.newValue) {
      try {
        const parsedChecklists = JSON.parse(e.newValue);
        if (Array.isArray(parsedChecklists) && parsedChecklists.length > 0 && callback) {
          callback({
            type: SYNC_EVENTS.CHECKLIST_SUBMITTED,
            businessId: targetBizId,
            payload: parsedChecklists[0]
          });
        }
      } catch (err) {
        console.error('Error parsing direct checklist storage sync:', err);
      }
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }
  window.addEventListener('storage', handleStorage);

  // Subscribe to Cloud Sync if configured (strictly for the active business)
  let unsubscribeCloudOrders = null;
  let unsubscribeCloudServerCalls = null;
  let unsubscribeCloudOffers = null;
  let unsubscribeCloudMenu = null;
  let unsubscribeCloudStaff = null;
  let unsubscribeCloudChecklists = null;

  const activeBizId = filterBusinessId || getActiveBusiness()?.id || 'biz_advait';

  if (isCloudSyncEnabled()) {
    unsubscribeCloudOrders = subscribeToCloudOrders(
      activeBizId,
      (newOrder, isInitial) => {
        if (callback && newOrder && newOrder.id) {
          callback({
            type: SYNC_EVENTS.NEW_ORDER,
            businessId: activeBizId,
            payload: newOrder,
            isInitial
          });
        }
      },
      (updatedOrder) => {
        if (callback && updatedOrder && updatedOrder.id) {
          callback({
            type: SYNC_EVENTS.ORDER_STATUS_UPDATED,
            businessId: activeBizId,
            payload: updatedOrder
          });
        }
      }
    );

    unsubscribeCloudServerCalls = subscribeToCloudServerCalls(activeBizId, (callData) => {
      if (callback && callData) {
        callback({
          type: SYNC_EVENTS.CALL_SERVER,
          businessId: activeBizId,
          payload: callData
        });
      }
    });

    unsubscribeCloudOffers = subscribeToCloudOffers(activeBizId, (cloudOffers) => {
      if (callback && Array.isArray(cloudOffers)) {
        callback({
          type: SYNC_EVENTS.OFFERS_UPDATED,
          businessId: activeBizId,
          payload: cloudOffers
        });
      }
    });

    unsubscribeCloudMenu = subscribeToCloudMenu(activeBizId, (cloudMenu) => {
      if (callback && Array.isArray(cloudMenu)) {
        callback({
          type: SYNC_EVENTS.MENU_UPDATED,
          businessId: activeBizId,
          payload: cloudMenu
        });
      }
    });

    unsubscribeCloudStaff = subscribeToCloudStaff(activeBizId, (cloudStaff) => {
      if (callback && Array.isArray(cloudStaff)) {
        callback({
          type: SYNC_EVENTS.STAFF_UPDATED,
          businessId: activeBizId,
          payload: cloudStaff
        });
      }
    });

    unsubscribeCloudChecklists = subscribeToCloudChecklists(activeBizId, (cloudChecklist) => {
      if (callback && cloudChecklist && cloudChecklist.id) {
        callback({
          type: SYNC_EVENTS.CHECKLIST_SUBMITTED,
          businessId: activeBizId,
          payload: cloudChecklist
        });
      }
    });
  }

  // Return unsubscribe cleanup function
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
    if (unsubscribeCloudOrders) {
      unsubscribeCloudOrders();
    }
    if (unsubscribeCloudServerCalls) {
      unsubscribeCloudServerCalls();
    }
    if (unsubscribeCloudOffers) {
      unsubscribeCloudOffers();
    }
    if (unsubscribeCloudMenu) {
      unsubscribeCloudMenu();
    }
    if (unsubscribeCloudStaff) {
      unsubscribeCloudStaff();
    }
    if (unsubscribeCloudChecklists) {
      unsubscribeCloudChecklists();
    }
  };
}
