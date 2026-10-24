/**
 * Customer Interface Session & Lifecycle Manager
 * Ensures all customer interface data is completely wiped:
 * 1. When the tab is closed
 * 2. When the table QR code is scanned again
 * 3. After 2 hours of inactivity
 */

export const CUSTOMER_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

const SESSION_KEYS = {
  SESSION_START: 'ontap_customer_session_start',
  LAST_ACTIVITY: 'ontap_customer_last_activity',
  TAB_INSTANCE: 'ontap_customer_tab_instance',
  LAST_SCANNED_TABLE: 'ontap_last_scanned_table',
  LAST_SCANNED_QR: 'ontap_last_scanned_qr_time'
};

/**
 * Returns customer storage keys scoped by active business
 */
export function getCustomerStorageKeys(bizId) {
  const cleanId = (bizId || 'default').trim().toLowerCase();
  return {
    dinerName: `ontap_${cleanId}_diner_name`,
    dinerPhone: `ontap_${cleanId}_diner_phone`,
    orderIds: `ontap_${cleanId}_customer_order_ids`,
    lastOrderId: `ontap_${cleanId}_last_order_id`,
    orderNote: `ontap_${cleanId}_order_note`,
    appliedPromo: `ontap_${cleanId}_applied_promo`,
    cart: `ontap_${cleanId}_customer_cart`
  };
}

/**
 * Completely wipe all customer interface data from sessionStorage and localStorage
 */
export function wipeAllCustomerData(bizId) {
  if (typeof window === 'undefined') return;

  const scoped = getCustomerStorageKeys(bizId);

  // 1. Clear customer sessionStorage
  const sessionKeysToRemove = [
    scoped.dinerName,
    scoped.dinerPhone,
    scoped.orderIds,
    scoped.lastOrderId,
    scoped.orderNote,
    scoped.appliedPromo,
    scoped.cart,
    'ontap_diner_name',
    'ontap_diner_phone',
    'ontap_customer_last_order_id',
    'flowscape_guest_table',
    'flowscape_table_sig',
    'flowscape_guest_scanned_qr',
    'flowscape_guest_scanned_biz',
    'flowscape_guest_active_tab',
    SESSION_KEYS.SESSION_START,
    SESSION_KEYS.LAST_ACTIVITY,
    SESSION_KEYS.LAST_SCANNED_QR
  ];

  sessionKeysToRemove.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  });

  // 2. Clear any lingering customer keys from localStorage
  const localKeysToRemove = [
    scoped.dinerName,
    scoped.dinerPhone,
    scoped.orderIds,
    scoped.lastOrderId,
    scoped.orderNote,
    scoped.appliedPromo,
    scoped.cart,
    `flowscape_diner_name_${bizId}`,
    `flowscape_diner_phone_${bizId}`,
    'flowscape_diner_name',
    'flowscape_diner_phone'
  ];

  localKeysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });

  // 3. Mark fresh session start and activity timestamp
  const now = Date.now();
  try {
    sessionStorage.setItem(SESSION_KEYS.SESSION_START, String(now));
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, String(now));
  } catch {}
}

/**
 * Check if the customer session has been inactive for more than 2 hours
 */
export function isCustomerSessionExpired() {
  if (typeof window === 'undefined') return false;
  try {
    const rawLastActivity = sessionStorage.getItem(SESSION_KEYS.LAST_ACTIVITY);
    if (!rawLastActivity) {
      // First access or tab closed and reopened -> treat as fresh
      return false;
    }
    const lastActivity = Number(rawLastActivity);
    if (isNaN(lastActivity)) return true;
    return Date.now() - lastActivity >= CUSTOMER_INACTIVITY_LIMIT_MS;
  } catch {
    return false;
  }
}

/**
 * Update the last activity timestamp (throttled to at most once every 5 seconds)
 */
let lastThrottleWrite = 0;
export function updateCustomerActivity() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastThrottleWrite < 5000) return;
  lastThrottleWrite = now;
  try {
    sessionStorage.setItem(SESSION_KEYS.LAST_ACTIVITY, String(now));
  } catch {}
}

/**
 * Get active customer session start timestamp
 */
export function getCustomerSessionStartTime() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(SESSION_KEYS.SESSION_START);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

/**
 * Detect if current load or navigation is a fresh QR scan
 */
export function detectFreshQrScan() {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashQuery);

    const isQrFlag =
      urlParams.get('qr') === 'true' ||
      hashParams.get('qr') === 'true' ||
      urlParams.get('qr') === '1' ||
      hashParams.get('qr') === '1';
    const isScanFlag = Boolean(urlParams.get('scan') || hashParams.get('scan'));
    const sig = urlParams.get('sig') || hashParams.get('sig');
    const table = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');

    // If QR or scan flag is present in URL, it is an explicit fresh QR scan
    if (isQrFlag || isScanFlag) {
      return true;
    }

    // Check if table + signature are present and different from previously recorded scan
    if (table && sig) {
      const lastRecordedTable = sessionStorage.getItem(SESSION_KEYS.LAST_SCANNED_TABLE);
      if (lastRecordedTable && lastRecordedTable !== table) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Mark that the QR scan parameter has been consumed and clean up URL
 */
export function markQrScanConsumed(table = '') {
  if (typeof window === 'undefined') return;
  try {
    if (table) {
      sessionStorage.setItem(SESSION_KEYS.LAST_SCANNED_TABLE, table);
    }
    sessionStorage.setItem(SESSION_KEYS.LAST_SCANNED_QR, String(Date.now()));

    // Clean up ?qr=true and ?scan from BOTH URL search params AND hash params so in-tab refreshes don't re-trigger a wipe
    const currentUrl = new URL(window.location.href);
    let changed = false;

    if (currentUrl.searchParams.has('qr')) {
      currentUrl.searchParams.delete('qr');
      changed = true;
    }
    if (currentUrl.searchParams.has('scan')) {
      currentUrl.searchParams.delete('scan');
      changed = true;
    }

    if (currentUrl.hash && currentUrl.hash.includes('?')) {
      const [hashPath, hashQuery] = currentUrl.hash.split('?');
      const hashParams = new URLSearchParams(hashQuery);
      if (hashParams.has('qr')) {
        hashParams.delete('qr');
        changed = true;
      }
      if (hashParams.has('scan')) {
        hashParams.delete('scan');
        changed = true;
      }
      const newHashQuery = hashParams.toString();
      currentUrl.hash = newHashQuery ? `${hashPath}?${newHashQuery}` : hashPath;
    }

    if (changed) {
      window.history.replaceState(null, '', currentUrl.toString());
    }
  } catch {}
}

/**
 * Initialize 2-hour Inactivity Watcher & Tab Close Wipe
 */
export function initCustomerInactivityWatcher({ onInactivityExpire, bizId }) {
  if (typeof window === 'undefined') return () => {};

  // Check if session was already expired upon initialization
  if (isCustomerSessionExpired()) {
    wipeAllCustomerData(bizId);
    if (typeof onInactivityExpire === 'function') {
      onInactivityExpire();
    }
  } else {
    updateCustomerActivity();
  }

  // Activity events to track user interaction
  const activityEvents = ['pointerdown', 'touchstart', 'click', 'keydown', 'scroll'];
  const handleUserActivity = () => {
    updateCustomerActivity();
  };

  activityEvents.forEach((evt) => {
    window.addEventListener(evt, handleUserActivity, { passive: true });
  });

  // Periodic interval check every 10 seconds
  const intervalId = setInterval(() => {
    if (isCustomerSessionExpired()) {
      wipeAllCustomerData(bizId);
      if (typeof onInactivityExpire === 'function') {
        onInactivityExpire();
      }
    }
  }, 10000);

  // Check on tab visibility change (e.g. diner switches back to tab after leaving phone locked for 2 hours)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (isCustomerSessionExpired()) {
        wipeAllCustomerData(bizId);
        if (typeof onInactivityExpire === 'function') {
          onInactivityExpire();
        }
      } else {
        updateCustomerActivity();
      }
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Note: Tab closure wiping is natively and automatically handled by browser-scoped sessionStorage:
  // When a tab/window is closed, the browser engine automatically destroys all sessionStorage data.
  // We intentionally do not wipe in 'pagehide' or 'beforeunload' to allow normal page reloads
  // and seamless app-switching when paying via external UPI apps (GPay/PhonePe).

  return () => {
    clearInterval(intervalId);
    activityEvents.forEach((evt) => {
      window.removeEventListener(evt, handleUserActivity);
    });
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
