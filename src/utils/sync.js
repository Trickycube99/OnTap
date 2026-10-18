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
  BUSINESS_DELETED: 'BUSINESS_DELETED'
};

const currentClientId = Math.random().toString(36).substring(2, 9);

/**
 * Broadcast an event to all open tabs, windows and cross-device cloud
 */
export function broadcastSyncEvent(type, payload = {}) {
  const eventMessage = {
    type,
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

  // 3. Cross-Device Cloud Sync (Firebase Firestore)
  if (type === SYNC_EVENTS.NEW_ORDER && payload) {
    syncOrderToCloud(payload).catch(() => {});
  } else if (type === SYNC_EVENTS.ORDER_STATUS_UPDATED && payload && payload.id) {
    syncStatusToCloud(payload.id, payload).catch(() => {});
  } else if (type === SYNC_EVENTS.CALL_SERVER && payload) {
    syncServerCallToCloud(payload).catch(() => {});
  } else if (type === SYNC_EVENTS.OFFERS_UPDATED && Array.isArray(payload)) {
    syncOffersToCloud(payload).catch(() => {});
  } else if (type === SYNC_EVENTS.MENU_UPDATED && Array.isArray(payload)) {
    syncMenuToCloud(payload).catch(() => {});
  } else if (type === SYNC_EVENTS.STAFF_UPDATED && Array.isArray(payload)) {
    syncStaffToCloud(payload).catch(() => {});
  } else if (type === SYNC_EVENTS.CHECKLIST_SUBMITTED && payload) {
    syncChecklistToCloud(payload).catch(() => {});
  }
}

/**
 * Subscribe to real-time events across windows and cross-device cloud
 */
export function subscribeSyncEvents(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleBroadcast = (event) => {
    if (event && event.data && callback) {
      // Don't echo own events if sent locally
      callback(event.data);
    }
  };

  const handleStorage = (e) => {
    if (e.key === 'flowscape_sync_event_ping' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (callback) callback(parsed);
      } catch (err) {
        console.error('Error parsing storage sync message:', err);
      }
    } else if (e.key === 'flowscape_orders_v2' && e.newValue) {
      try {
        const parsedOrders = JSON.parse(e.newValue);
        if (Array.isArray(parsedOrders) && callback) {
          callback({
            type: 'DIRECT_ORDERS_SYNC',
            payload: parsedOrders
          });
        }
      } catch (err) {
        console.error('Error parsing direct orders sync:', err);
      }
    } else if (e.key && e.key.startsWith('flowscape_staff_inr_v2') && e.newValue) {
      try {
        const parsedStaff = JSON.parse(e.newValue);
        if (Array.isArray(parsedStaff) && callback) {
          callback({
            type: SYNC_EVENTS.STAFF_UPDATED,
            payload: parsedStaff
          });
        }
      } catch (err) {
        console.error('Error parsing direct staff storage sync:', err);
      }
    } else if (e.key && e.key.startsWith('flowscape_checklists_inr_v2') && e.newValue) {
      try {
        const parsedChecklists = JSON.parse(e.newValue);
        if (Array.isArray(parsedChecklists) && parsedChecklists.length > 0 && callback) {
          callback({
            type: SYNC_EVENTS.CHECKLIST_SUBMITTED,
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

  // Subscribe to Cloud Sync if configured
  let unsubscribeCloudOrders = null;
  let unsubscribeCloudServerCalls = null;
  let unsubscribeCloudOffers = null;
  let unsubscribeCloudMenu = null;
  let unsubscribeCloudStaff = null;
  let unsubscribeCloudChecklists = null;

  if (isCloudSyncEnabled()) {
    unsubscribeCloudOrders = subscribeToCloudOrders(
      (newOrder, isInitial) => {
        if (callback && newOrder && newOrder.id) {
          callback({
            type: SYNC_EVENTS.NEW_ORDER,
            payload: newOrder,
            isInitial
          });
        }
      },
      (updatedOrder) => {
        if (callback && updatedOrder && updatedOrder.id) {
          callback({
            type: SYNC_EVENTS.ORDER_STATUS_UPDATED,
            payload: updatedOrder
          });
        }
      }
    );

    unsubscribeCloudServerCalls = subscribeToCloudServerCalls((callData) => {
      if (callback && callData) {
        callback({
          type: SYNC_EVENTS.CALL_SERVER,
          payload: callData
        });
      }
    });

    unsubscribeCloudOffers = subscribeToCloudOffers((cloudOffers) => {
      if (callback && Array.isArray(cloudOffers)) {
        callback({
          type: SYNC_EVENTS.OFFERS_UPDATED,
          payload: cloudOffers
        });
      }
    });

    unsubscribeCloudMenu = subscribeToCloudMenu((cloudMenu) => {
      if (callback && Array.isArray(cloudMenu)) {
        callback({
          type: SYNC_EVENTS.MENU_UPDATED,
          payload: cloudMenu
        });
      }
    });

    unsubscribeCloudStaff = subscribeToCloudStaff((cloudStaff) => {
      if (callback && Array.isArray(cloudStaff)) {
        callback({
          type: SYNC_EVENTS.STAFF_UPDATED,
          payload: cloudStaff
        });
      }
    });

    unsubscribeCloudChecklists = subscribeToCloudChecklists((cloudChecklist) => {
      if (callback && cloudChecklist && cloudChecklist.id) {
        callback({
          type: SYNC_EVENTS.CHECKLIST_SUBMITTED,
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
