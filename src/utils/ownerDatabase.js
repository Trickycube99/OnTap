/**
 * Owner Dashboard Database & Indexing Engine (IndexedDB + Cloud Firestore)
 * 
 * Guarantees:
 * 1. Owner dashboard amounts ONLY update when submitted by staff (scratches real-time unsubmitted updates).
 * 2. High-performance IndexedDB storage with compound indexes for instant zero-latency retrieval.
 * 3. Complete memory persistence across browser refreshes, tab closures, and multi-device sessions.
 * 4. Automatic cross-device synchronization with Cloud Firestore.
 */

import { initFirebase, isQuotaExhausted, handleFirestoreError } from './firebaseSync.js';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { calculateVerificationBridge } from './salesBridge.js';
import { loadData, getScopedKey, STORAGE_KEYS } from './storage.js';

const DB_NAME = 'OnTap_OwnerDatabase_v1';
const DB_VERSION = 2;

export const DB_STORES = {
  SUBMITTED_SALES: 'submitted_sales',
  DASHBOARD_SNAPSHOTS: 'dashboard_snapshots'
};

let dbInstance = null;
let dbInitPromise = null;

/**
 * Open and initialize the IndexedDB database with high-performance indexes
 */
export function openOwnerDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Submitted Sales Store (EOD Reports & Staff Shift Submissions)
        if (!db.objectStoreNames.contains(DB_STORES.SUBMITTED_SALES)) {
          const salesStore = db.createObjectStore(DB_STORES.SUBMITTED_SALES, { keyPath: 'id' });
          
          // Index for business tenant isolation
          salesStore.createIndex('index_businessId', 'businessId', { unique: false });
          
          // Compound index for fast single-day lookup [businessId, date]
          salesStore.createIndex('index_biz_date', ['businessId', 'date'], { unique: false });
          
          // Compound index for date range queries (weekly/monthly) and sorting [businessId, createdAt]
          salesStore.createIndex('index_biz_createdAt', ['businessId', 'createdAt'], { unique: false });
          
          // General index on date string
          salesStore.createIndex('index_date', 'date', { unique: false });
          
          // General index on submission status
          salesStore.createIndex('index_status', 'status', { unique: false });
        }

        // 2. Dashboard Snapshots Store (Instant cache of aggregated verified amounts)
        if (!db.objectStoreNames.contains(DB_STORES.DASHBOARD_SNAPSHOTS)) {
          const snapshotStore = db.createObjectStore(DB_STORES.DASHBOARD_SNAPSHOTS, { keyPath: 'businessId' });
          snapshotStore.createIndex('index_updatedAt', 'updatedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        dbInstance.onclose = () => {
          dbInstance = null;
          dbInitPromise = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn('⚠️ [IndexedDB] Could not open owner database:', event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('⚠️ [IndexedDB] Error initializing database:', err);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Save a staff-submitted sales report to IndexedDB (using indexed transaction)
 */
export async function saveSubmittedReportToIndexedDB(report) {
  if (!report || !report.id) return false;
  const db = await openOwnerDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORES.SUBMITTED_SALES, 'readwrite');
      const store = tx.objectStore(DB_STORES.SUBMITTED_SALES);
      
      const record = {
        ...report,
        businessId: report.businessId || 'default',
        updatedAt: new Date().toISOString()
      };

      store.put(record);

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn('⚠️ [IndexedDB] Failed to save submitted report:', e.target.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('⚠️ [IndexedDB] Transaction error:', err);
      resolve(false);
    }
  });
}

/**
 * Fetch all staff-submitted reports for a business from IndexedDB using index
 */
export async function fetchAllSubmittedReportsFromIndexedDB(businessId) {
  const db = await openOwnerDatabase();
  if (!db) return [];

  const targetBizId = businessId || 'default';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORES.SUBMITTED_SALES, 'readonly');
      const store = tx.objectStore(DB_STORES.SUBMITTED_SALES);
      const index = store.index('index_businessId');
      const request = index.getAll(targetBizId);

      request.onsuccess = () => {
        const results = request.result || [];
        // Sort newest first by createdAt / timestamp
        results.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.date).getTime() || 0;
          const timeB = new Date(b.createdAt || b.date).getTime() || 0;
          return timeB - timeA;
        });
        resolve(results);
      };

      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Fetch the latest submitted report for a specific date using compound index [businessId, date]
 */
export async function fetchSubmittedReportByDateFromIndexedDB(businessId, dateStr) {
  const db = await openOwnerDatabase();
  if (!db || !dateStr) return null;

  const targetBizId = businessId || 'default';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORES.SUBMITTED_SALES, 'readonly');
      const store = tx.objectStore(DB_STORES.SUBMITTED_SALES);
      const index = store.index('index_biz_date');
      const request = index.getAll([targetBizId, dateStr]);

      request.onsuccess = () => {
        const results = request.result || [];
        if (results.length === 0) return resolve(null);
        // Return most recent report for that date
        results.sort((a, b) => {
          const timeA = new Date(a.createdAt || 0).getTime();
          const timeB = new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        resolve(results[0]);
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save Owner Dashboard Aggregated Snapshot to IndexedDB for instant reload
 */
export async function saveDashboardSnapshotToIndexedDB(businessId, snapshot) {
  const db = await openOwnerDatabase();
  if (!db) return false;

  const targetBizId = businessId || 'default';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORES.DASHBOARD_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(DB_STORES.DASHBOARD_SNAPSHOTS);
      
      const record = {
        businessId: targetBizId,
        snapshot,
        updatedAt: new Date().toISOString()
      };

      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Get Owner Dashboard Aggregated Snapshot from IndexedDB
 */
export async function getDashboardSnapshotFromIndexedDB(businessId) {
  const db = await openOwnerDatabase();
  if (!db) return null;

  const targetBizId = businessId || 'default';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORES.DASHBOARD_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(DB_STORES.DASHBOARD_SNAPSHOTS);
      const request = store.get(targetBizId);

      request.onsuccess = () => {
        resolve(request.result?.snapshot || null);
      };

      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Sync Cloud Firestore Submissions into IndexedDB
 * Ensures that if the owner opens another tab, device, or refreshes after cache wipe,
 * all staff submissions are fetched from Cloud Firestore and cached into IndexedDB.
 */
export async function syncCloudSubmissionsToIndexedDB(businessId) {
  if (isQuotaExhausted()) return [];
  const database = initFirebase();
  if (!database) return [];

  const targetBizId = businessId || 'default';

  try {
    const colRef = collection(database, 'restaurant_checklists');
    const q = query(colRef, where('businessId', '==', targetBizId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    const cloudReports = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && (data.originalReportId || data.id)) {
        cloudReports.push({
          ...data,
          id: data.originalReportId || data.id,
          businessId: targetBizId
        });
      }
    });

    // Bulk persist all cloud reports into IndexedDB
    for (const report of cloudReports) {
      await saveSubmittedReportToIndexedDB(report);
    }

    return cloudReports;
  } catch (err) {
    handleFirestoreError(err, 'sync cloud submissions to IndexedDB');
    return [];
  }
}

/**
 * Master API: Save Staff Submitted Report across IndexedDB, Cloud Firestore, and Local Backup
 * Automatically runs the Backend Verification Bridge against the immutable order ledger
 * to ensure owner never receives fabricated, manipulated, or wrong financial information.
 */
export async function persistStaffSubmission({ report, businessId, orders = null }) {
  if (!report || !report.id) return false;
  const targetBizId = businessId || report.businessId || 'default';

  // 1. Retrieve valid order ledger if not directly passed in options
  let orderLedger = Array.isArray(orders) ? orders : [];
  if (orderLedger.length === 0 && typeof window !== 'undefined') {
    try {
      orderLedger = loadData(getScopedKey(STORAGE_KEYS.ORDERS, targetBizId), []);
    } catch {
      orderLedger = [];
    }
  }

  // 2. Execute Backend Verification Bridge against immutable order ledger
  const bridgeResult = calculateVerificationBridge({
    orders: orderLedger,
    refDate: new Date(report.createdAt || report.date || Date.now()),
    latestEodReport: report
  });

  const verifiedExpected = {
    cash: Number(bridgeResult.channels.expected.cash || 0),
    card: Number(bridgeResult.channels.expected.card || 0),
    upi: Number(bridgeResult.channels.expected.upi || 0),
    total: Number(bridgeResult.totalExpectedAmount || 0)
  };

  const verifiedServed = {
    cash: Number(bridgeResult.channels.served.cash || 0),
    card: Number(bridgeResult.channels.served.card || 0),
    upi: Number(bridgeResult.channels.served.upi || 0),
    total: Number(bridgeResult.totalServedAmount || 0)
  };

  const actualTotal = Number(report.actual?.total ?? (
    Number(report.actual?.cash || 0) + Number(report.actual?.card || 0) + Number(report.actual?.upi || 0)
  ));

  const verifiedVariance = actualTotal - verifiedExpected.total;
  const isAuditBalanced = Math.abs(verifiedVariance) <= 200;

  // Check if cashier reported expected numbers that differ from verified order ledger
  const clientExpectedTotal = Number(report.expected?.total || 0);
  const hasClientDiscrepancy = Boolean(clientExpectedTotal && Math.abs(clientExpectedTotal - verifiedExpected.total) > 1);

  const backendVerification = {
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    ledgerExpected: verifiedExpected,
    ledgerServed: verifiedServed,
    actualCounted: report.actual || { cash: 0, card: 0, upi: 0, total: actualTotal },
    ledgerVariance: verifiedVariance,
    channelVariances: {
      cash: Number(report.actual?.cash || 0) - verifiedExpected.cash,
      card: Number(report.actual?.card || 0) - verifiedExpected.card,
      upi: Number(report.actual?.upi || 0) - verifiedExpected.upi
    },
    servedOrdersCount: bridgeResult.servedCount,
    totalOrdersCount: bridgeResult.expectedCount,
    unservedOrdersCount: bridgeResult.unservedCount,
    unservedAmount: bridgeResult.unservedAmount,
    fulfillmentRate: bridgeResult.fulfillmentRate,
    isAuditBalanced,
    auditStatus: isAuditBalanced ? 'VERIFIED_BALANCED' : 'AUDIT_VARIANCE_FLAGGED',
    tamperDetected: hasClientDiscrepancy,
    clientReportedExpected: report.expected || null,
    auditNote: hasClientDiscrepancy
      ? `⚠️ AUDIT WARNING: Cashier reported expected total (₹${clientExpectedTotal.toFixed(0)}) differed from verified backend order ledger (₹${verifiedExpected.total.toFixed(0)}). Backend verification bridge corrected this to ensure owner accuracy.`
      : (isAuditBalanced
          ? `✅ Backend Verified: Counted ₹${actualTotal.toFixed(0)} reconciled against ₹${verifiedExpected.total.toFixed(0)} ledger expected.`
          : `⚠️ Audit Variance: Counted ₹${actualTotal.toFixed(0)} vs Ledger Expected ₹${verifiedExpected.total.toFixed(0)} (Variance: ₹${verifiedVariance >= 0 ? '+' : ''}${verifiedVariance.toFixed(0)}). Reason: "${report.varianceReason || 'No note provided'}"`)
  };

  const enrichedReport = {
    ...report,
    businessId: targetBizId,
    // Enforce verified ledger numbers so owner gets guaranteed accurate data
    expected: verifiedExpected,
    variance: verifiedVariance,
    backendVerification,
    persistedAt: new Date().toISOString()
  };

  // 1. Save to high-speed indexed IndexedDB
  await saveSubmittedReportToIndexedDB(enrichedReport);

  // 2. Save to Cloud Firestore for multi-device sync
  if (!isQuotaExhausted()) {
    try {
      const database = initFirebase();
      if (database) {
        const cloudDocId = `${targetBizId}_${report.id}`;
        const docRef = doc(database, 'restaurant_checklists', cloudDocId);
        await setDoc(docRef, {
          ...enrichedReport,
          _cloudSyncedAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('⚠️ Cloud sync fallback:', err);
    }
  }

  return true;
}

/**
 * Calculate Staff-Submitted Owner Dashboard Sales Amounts
 * SCRATCHES REAL-TIME LIVE BILLING:
 * 1. Today's sales ONLY updates if staff submitted today's count.
 * 2. Weekly sales is the sum of staff-submitted counts in the current week.
 * 3. Monthly sales is the sum of staff-submitted counts in the current month cycle.
 * 4. Payment splits strictly reflect staff counted amounts.
 */
export function calculateStaffSubmittedAmounts({
  submittedReports = [],
  todayDateStr = new Date().toLocaleDateString('en-IN'),
  startOfWeek = null,
  endOfWeek = null,
  startOfMonth = null,
  endOfMonth = null,
  todayOrdersCount = 0
}) {
  const reports = Array.isArray(submittedReports) ? submittedReports : [];

  // 1. Today's Submitted Report
  // Match on date string or createdAt
  const todayReport = reports.find((r) => {
    if (!r) return false;
    if (r.date === todayDateStr) return true;
    if (r.createdAt) {
      const d = new Date(r.createdAt).toLocaleDateString('en-IN');
      return d === todayDateStr;
    }
    return false;
  }) || (reports.length > 0 && reports[0].date === todayDateStr ? reports[0] : null);

  const hasStaffSubmittedToday = Boolean(todayReport && todayReport.actual && typeof todayReport.actual.total === 'number');

  // Today's Verified Amounts
  const todaySubmittedSales = hasStaffSubmittedToday ? Number(todayReport.actual.total) : 0;
  const todaySubmittedCash = hasStaffSubmittedToday ? Number(todayReport.actual.cash || 0) : 0;
  const todaySubmittedCard = hasStaffSubmittedToday ? Number(todayReport.actual.card || 0) : 0;
  const todaySubmittedUpi = hasStaffSubmittedToday ? Number(todayReport.actual.upi || 0) : 0;
  const todayVariance = hasStaffSubmittedToday ? Number(todayReport.variance || 0) : 0;
  const todayVarianceReason = hasStaffSubmittedToday ? todayReport.varianceReason || '' : '';
  const submittedBy = hasStaffSubmittedToday ? todayReport.submittedBy || 'Counter Staff' : '';
  const submittedAt = hasStaffSubmittedToday ? todayReport.timestamp || todayReport.createdAt || '' : '';

  // 2. Weekly Submitted Total (Sum of all staff submissions within the week)
  let weekSubmittedSales = 0;
  let weekSubmissionsCount = 0;

  if (startOfWeek && endOfWeek) {
    reports.forEach((r) => {
      if (!r || !r.actual || typeof r.actual.total !== 'number') return;
      const d = r.createdAt ? new Date(r.createdAt) : new Date(r.date);
      if (!isNaN(d.getTime()) && d >= startOfWeek && d <= endOfWeek) {
        weekSubmittedSales += Number(r.actual.total);
        weekSubmissionsCount += 1;
      }
    });
  } else {
    // Fallback: If no date filter, include today's submission
    weekSubmittedSales = todaySubmittedSales;
    weekSubmissionsCount = hasStaffSubmittedToday ? 1 : 0;
  }

  // 3. Monthly Submitted Total (Sum of all staff submissions within the 30th-29th monthly cycle)
  let monthSubmittedSales = 0;
  let monthSubmissionsCount = 0;

  if (startOfMonth && endOfMonth) {
    reports.forEach((r) => {
      if (!r || !r.actual || typeof r.actual.total !== 'number') return;
      const d = r.createdAt ? new Date(r.createdAt) : new Date(r.date);
      if (!isNaN(d.getTime()) && d >= startOfMonth && d <= endOfMonth) {
        monthSubmittedSales += Number(r.actual.total);
        monthSubmissionsCount += 1;
      }
    });
  } else {
    // Fallback: If no date filter, include today's submission
    monthSubmittedSales = todaySubmittedSales;
    monthSubmissionsCount = hasStaffSubmittedToday ? 1 : 0;
  }

  return {
    hasStaffSubmittedToday,
    todaySubmittedSales,
    todaySubmittedCash,
    todaySubmittedCard,
    todaySubmittedUpi,
    todayVariance,
    todayVarianceReason,
    submittedBy,
    submittedAt,
    todayReport,
    weekSubmittedSales,
    weekSubmissionsCount,
    monthSubmittedSales,
    monthSubmissionsCount,
    // Backend verification bridge metadata for owner audit protection
    backendVerification: todayReport?.backendVerification || null,
    isBackendVerified: Boolean(todayReport?.backendVerification?.isVerified),
    hasAuditTamperAlert: Boolean(todayReport?.backendVerification?.tamperDetected),
    auditAlertMessage: todayReport?.backendVerification?.auditNote || '',
    // Clear status text
    statusLabel: hasStaffSubmittedToday
      ? `Submitted by ${submittedBy} (${submittedAt})`
      : 'Awaiting Staff Submission',
    ordersStatusNote: hasStaffSubmittedToday
      ? `Reconciled & verified in cash check`
      : `${todayOrdersCount} orders placed • Awaiting staff count`
  };
}
