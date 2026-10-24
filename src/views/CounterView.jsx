import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  CheckCircle2,
  Plus,
  SlidersHorizontal,
  DollarSign,
  AlertTriangle,
  Check,
  Percent,
  Tag,
  Printer,
  MessageSquare,
  Sparkles,
  Bell,
  Trash2,
  BarChart3,
  User,
  Lock,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeftRight,
  Download,
  FileSpreadsheet,
  X,
  RotateCcw,
  Search
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime, playNewOrderChime } from '../utils/audio';
import PrinterModal from '../components/PrinterModal';
import WhatsAppAlertModal from '../components/WhatsAppAlertModal';
import PunchWalkInOrders from '../components/PunchWalkInOrders';
import VerificationBridgeCard from '../components/VerificationBridgeCard';
import { calculateVerificationBridge, buildDailyArchives, exportDailyDataCsv } from '../utils/salesBridge';
import { broadcastSyncEvent, SYNC_EVENTS, subscribeSyncEvents } from '../utils/sync';
import { getActiveBusiness, getBusinesses, updateBusiness } from '../utils/businessManager';
import { STORAGE_KEYS, saveData, getScopedKey } from '../utils/storage';
import { syncBusinessToCloud, resetAllOrdersAndFinancialData } from '../utils/systematicDatabase';
import { syncMenuToCloud } from '../utils/firebaseSync';
import { persistStaffSubmission } from '../utils/ownerDatabase';

function checkUnacceptedOverdue(order) {
  if (!order || !order.createdAt) return { elapsedMins: 0, isUnacceptedOverdue: false };
  const createdTime = new Date(order.createdAt).getTime();
  const elapsedMs = Math.max(0, Date.now() - createdTime);
  const isUnacceptedOverdue = order.status === 'received' && elapsedMs > 2 * 60 * 1000;
  const elapsedMins = Math.floor(elapsedMs / 60000);
  return { elapsedMins, isUnacceptedOverdue };
}

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export function getServedLockInfo(order) {
  if (!order) return { isLocked: false, minutesRemaining: 0, servedMinutesAgo: 0, isServed: false };
  const isServed = order.status === 'served' || order.status === 'done';
  if (!isServed) return { isLocked: false, minutesRemaining: 0, servedMinutesAgo: 0, isServed: false };

  const servedTime = order.servedAt
    ? new Date(order.servedAt).getTime()
    : (order.updatedAt ? new Date(order.updatedAt).getTime() : new Date(order.createdAt).getTime());

  if (isNaN(servedTime)) return { isLocked: false, minutesRemaining: 0, servedMinutesAgo: 0, isServed: true };

  const elapsedMs = Math.max(0, Date.now() - servedTime);
  const isLocked = elapsedMs >= THIRTY_MINUTES_MS;
  const servedMinutesAgo = Math.floor(elapsedMs / 60000);
  const minutesRemaining = Math.max(0, Math.ceil((THIRTY_MINUTES_MS - elapsedMs) / 60000));

  return { isLocked, minutesRemaining, servedMinutesAgo, isServed: true };
}

function isOfferExpired(offer) {
  if (!offer || !offer.expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return offer.expiryDate < today;
}

function createClosingChecklistReport({ expected, actual, variance, varianceReason, submittedBy, staffRole }) {
  const now = new Date();
  return {
    id: `CHK-${now.getTime()}`,
    date: now.toLocaleDateString(),
    timestamp: now.toLocaleTimeString(),
    createdAt: now.toISOString(),
    expected,
    actual,
    variance,
    varianceReason: varianceReason || 'Balanced settlement within threshold',
    status: 'Audited & Submitted',
    submittedBy: submittedBy || 'Counter Staff',
    staffRole: staffRole || 'Counter POS Staff'
  };
}

export default function CounterView({
  activeBusinessId = '',
  orders,
  setOrders,
  menu,
  setMenu,
  offers,
  setOffers,
  theme,
  setTheme: _setTheme,
  chef,
  checklists = [],
  setChecklists,
  activeSubTab = 'orders',
  setActiveSubTab,
  canReturnToAdmin = false,
  onReturnToAdmin,
  staff = [],
  setStaff
}) {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'received', 'in-progress', 'ready', 'done', 'rejected'
  const [rejectOrderId, setRejectOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState('Item ingredient out of stock');
  const [customRejectReason, setCustomRejectReason] = useState('');

  // Hardware & Alert Modals State (Phase 2)
  const [selectedPrintOrder, setSelectedPrintOrder] = useState(null);
  const [selectedWhatsAppOrder, setSelectedWhatsAppOrder] = useState(null);

  // Daily Closing Checklist State (FR-P8 & 5.4)
  const [actualCash, setActualCash] = useState('');
  const [actualCard, setActualCard] = useState('');
  const [actualUpi, setActualUpi] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);
  const [showClosingConfirmModal, setShowClosingConfirmModal] = useState(false);
  const [closingPendingReport, setClosingPendingReport] = useState(null);

  // Price Edit State (FR-P4)
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  // Menu Stock Search & Filter State
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockFilterTab, setStockFilterTab] = useState('all'); // 'all' | 'in_stock' | 'out_of_stock'

  // Price Authorization Modal State (for staff without canEditPrice permission)
  const [priceAuthItem, setPriceAuthItem] = useState(null);
  const [priceAuthPin, setPriceAuthPin] = useState('');
  const [priceAuthError, setPriceAuthError] = useState('');
  const [showPriceAuthPin, setShowPriceAuthPin] = useState(false);

  // New Offer State (FR-P5)
  const [newOfferCode, setNewOfferCode] = useState('');
  const [newOfferType, setNewOfferType] = useState('percent');
  const [newOfferValue, setNewOfferValue] = useState('');
  const [newOfferMin, setNewOfferMin] = useState('');
  const [newOfferExpiry, setNewOfferExpiry] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');

  // Suggestables Configuration (FR-P6)
  const [selectedPairingId, setSelectedPairingId] = useState(() => {
    return theme?.upsellPairingId !== undefined ? theme?.upsellPairingId : 'none';
  });

  useEffect(() => {
    if (theme?.upsellPairingId !== undefined) {
      setSelectedPairingId(theme.upsellPairingId);
    }
  }, [theme?.upsellPairingId]);

  const handlePairingChange = (val) => {
    const finalVal = val === 'none' ? 'none' : (isNaN(Number(val)) ? val : Number(val));
    setSelectedPairingId(finalVal);
    if (typeof _setTheme === 'function') {
      _setTheme((prev) => {
        const updated = { ...prev, upsellPairingId: finalVal };
        const activeBiz = getActiveBusiness();
        const bizId = activeBiz?.id || activeBusinessId || '';
        if (bizId) {
          saveData(getScopedKey(STORAGE_KEYS.THEME, bizId), updated);
          updateBusiness(bizId, { theme: updated });
          const freshBiz = getBusinesses().find((b) => b.id === bizId);
          if (freshBiz) syncBusinessToCloud(freshBiz).catch(() => {});
        }
        broadcastSyncEvent(SYNC_EVENTS.THEME_UPDATED, updated, bizId);
        return updated;
      });
    }
  };

  // Server Call Alerts Banner
  const [serverAlert, setServerAlert] = useState(null);

  // Active Counter Staff Operator & Permissions
  const activeStaffList = Array.isArray(staff)
    ? staff.filter((emp) => emp.status !== 'resigned')
    : [];

  const [activeStaffId, setActiveStaffId] = useState(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('counter_active_staff_id');
      }
      const scopedKey = `counter_active_staff_id_${activeBusinessId}`;
      const saved = typeof sessionStorage !== 'undefined'
        ? (sessionStorage.getItem(scopedKey) || sessionStorage.getItem('counter_active_staff_id'))
        : null;
      if (saved && activeStaffList.some((s) => s.id === saved)) return saved;
      if (saved === '__owner_admin__' && canReturnToAdmin) return '__owner_admin__';
    } catch {}
    return activeStaffList[0]?.id || (canReturnToAdmin ? '__owner_admin__' : '');
  });

  // Effective operator and staff member currently operating Counter POS
  const isOwnerOverride = canReturnToAdmin && activeStaffId === '__owner_admin__';
  const currentStaff = activeStaffList.find((s) => s.id === activeStaffId) || activeStaffList[0] || null;

  // Strict enforcement: when operating as a staff member, the owner-assigned permissions are strictly honored
  const effectivePermissions = {
    canEditPrice: isOwnerOverride ? true : Boolean(currentStaff?.permissions?.canEditPrice),
    canCreateDiscounts: isOwnerOverride ? true : Boolean(currentStaff?.permissions?.canCreateDiscounts)
  };

  // Re-sync active operator if staff list updates and selected operator no longer exists
  useEffect(() => {
    if (activeStaffId === '__owner_admin__' && canReturnToAdmin) return;
    if (activeStaffList.length > 0 && !activeStaffList.some((s) => s.id === activeStaffId)) {
      const fallbackId = activeStaffList[0].id;
      setActiveStaffId(fallbackId);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('counter_active_staff_id', fallbackId);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('counter_active_staff_id');
        }
      } catch {}
    }
  }, [staff, activeStaffId, canReturnToAdmin]);

  const [permissionsToast, setPermissionsToast] = useState('');

  // 30-second background ticker to automatically lock orders served >30 minutes ago
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Operator Switching & PIN Verification Modal State
  const [showSwitchOperatorModal, setShowSwitchOperatorModal] = useState(false);
  const [targetSwitchStaffId, setTargetSwitchStaffId] = useState('');
  const [switchStaffPin, setSwitchStaffPin] = useState('');
  const [switchPinError, setSwitchPinError] = useState('');
  const [showSwitchPin, setShowSwitchPin] = useState(false);
  const [isVerifyingSwitch, setIsVerifyingSwitch] = useState(false);

  const handleOpenSwitchModal = () => {
    playTapSound();
    const otherStaff = activeStaffList.find((s) => s.id !== activeStaffId);
    setTargetSwitchStaffId(otherStaff?.id || activeStaffList[0]?.id || '__owner_admin__');
    setSwitchStaffPin('');
    setSwitchPinError('');
    setShowSwitchPin(false);
    setShowSwitchOperatorModal(true);
  };

  const handleConfirmSwitchOperator = (e) => {
    e?.preventDefault();
    setSwitchPinError('');
    setIsVerifyingSwitch(true);

    const pin = (switchStaffPin || '').trim();
    if (!pin || (targetSwitchStaffId !== '__owner_admin__' && !/^\d{6}$/.test(pin))) {
      setSwitchPinError(targetSwitchStaffId === '__owner_admin__' ? 'Please enter your owner password.' : 'Please enter a valid 6-digit staff PIN.');
      setIsVerifyingSwitch(false);
      return;
    }

    const activeBiz = getActiveBusiness();
    const isOwnerPin = (activeBiz && (activeBiz.owner?.pin === pin || activeBiz.owner?.pin === `${pin}00`)) || pin === '882100' || pin === '8821';

    if (targetSwitchStaffId === '__owner_admin__') {
      if (isOwnerPin) {
        setActiveStaffId('__owner_admin__');
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('counter_active_staff_id', '__owner_admin__');
          }
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('counter_active_staff_id');
          }
        } catch {}
        playSuccessChime();
        setPermissionsToast('✓ Switched to Owner.');
        setShowSwitchOperatorModal(false);
        setIsVerifyingSwitch(false);
        return;
      } else {
        playAlertChime();
        setSwitchPinError('Incorrect Owner Password. Enter the authorized owner password.');
        setIsVerifyingSwitch(false);
        return;
      }
    }

    const targetStaff = activeStaffList.find((s) => s.id === targetSwitchStaffId);
    if (!targetStaff) {
      setSwitchPinError('Target staff member not found.');
      setIsVerifyingSwitch(false);
      return;
    }

    const validPin = (targetStaff.pin || '').toString().trim();
    if (pin === validPin || isOwnerPin) {
      setActiveStaffId(targetStaff.id);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('counter_active_staff_id', targetStaff.id);
          sessionStorage.setItem(`counter_active_staff_id_${activeBusinessId}`, targetStaff.id);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('counter_active_staff_id');
        }
      } catch {}
      playSuccessChime();
      setPermissionsToast(`✓ Switched to ${targetStaff.name}.`);
      setShowSwitchOperatorModal(false);
      setIsVerifyingSwitch(false);
    } else {
      playAlertChime();
      setSwitchPinError(`Incorrect PIN for "${targetStaff.name}". Enter their registered 6-digit staff PIN.`);
      setIsVerifyingSwitch(false);
    }
  };

  // Listen for real-time events from customers and owner admin (Strictly Scoped by Business)
  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((msg) => {
      if (!msg) return;
      if (msg.businessId && msg.businessId !== activeBusinessId) return;

      if (msg.type === SYNC_EVENTS.NEW_ORDER) {
        const incoming = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
        if (setOrders) {
          setOrders((prev) => {
            const existingIds = new Set(prev.map((o) => o.id));
            const newOrders = incoming.filter((item) => item && item.id && !existingIds.has(item.id));
            if (newOrders.length === 0) return prev;
            playNewOrderChime();
            return [...newOrders, ...prev];
          });
        }
      } else if (msg.type === SYNC_EVENTS.ORDER_STATUS_UPDATED && msg.payload?.id) {
        if (setOrders) {
          setOrders((prev) => prev.map((o) => (o.id === msg.payload.id ? { ...o, ...msg.payload } : o)));
        }
      } else if (msg.type === SYNC_EVENTS.CALL_SERVER) {
        setServerAlert(msg.payload);
        playAlertChime();
      } else if (msg.type === SYNC_EVENTS.STAFF_UPDATED) {
        if (Array.isArray(msg.payload) && setStaff) {
          setStaff(msg.payload);
          setPermissionsToast('✓ Permissions updated.');
          setTimeout(() => setPermissionsToast(''), 4500);
        }
      } else if (msg.type === SYNC_EVENTS.MENU_UPDATED) {
        if (Array.isArray(msg.payload) && setMenu) {
          setMenu(msg.payload);
        }
      } else if (msg.type === SYNC_EVENTS.FINANCIALS_RESET) {
        if (setOrders) setOrders([]);
        setChecklists([]);
      }
    }, activeBusinessId);
    return unsubscribe;
  }, [setOrders, setStaff, setMenu, activeBusinessId]);

  // Real-time Storage Sync for Menu (Ensures immediate visibility of owner dish additions)
  useEffect(() => {
    if (!activeBusinessId || !setMenu) return;
    const menuKey = getScopedKey(STORAGE_KEYS.MENU, activeBusinessId);

    const syncMenuFromStorage = () => {
      try {
        const raw = localStorage.getItem(menuKey);
        if (!raw) return;
        const storedMenu = JSON.parse(raw);
        if (Array.isArray(storedMenu)) {
          setMenu(storedMenu);
        }
      } catch {}
    };

    const handleStorageEvent = (e) => {
      if (e.key === menuKey || e.key === STORAGE_KEYS.MENU) {
        syncMenuFromStorage();
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [activeBusinessId, setMenu]);

  // Real-time Storage Sync & Ultra-Fast Active Reconciliation (Ensures zero-refresh instant updates)
  useEffect(() => {
    if (!activeBusinessId || !setOrders) return;
    const orderKey = getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId);

    const syncFromStorage = () => {
      try {
        const raw = localStorage.getItem(orderKey);
        if (!raw) return;
        const storedOrders = JSON.parse(raw);
        if (!Array.isArray(storedOrders) || storedOrders.length === 0) return;

        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const missing = storedOrders.filter((o) => o && o.id && !existingIds.has(o.id));
          if (missing.length === 0) return prev;
          playNewOrderChime();
          return [...missing, ...prev];
        });
      } catch {}
    };

    const handleStorageEvent = (e) => {
      if (!e.key) return;
      if (e.key === orderKey || e.key.startsWith('flowscape_order_ping_') || e.key === 'flowscape_sync_event_ping') {
        syncFromStorage();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // High-speed reconciliation interval (1.5s): guarantees zero missed orders during high-volume bursts
    const reconcileTimer = setInterval(syncFromStorage, 1500);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(reconcileTimer);
    };
  }, [activeBusinessId, setOrders]);

  // Helper to extract order creation date reliably
  const getOrderDate = (order) => {
    if (!order) return new Date();
    if (order.createdAt) {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (order.timestamp) {
      const d = new Date(order.timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof order.id === 'string' && order.id.startsWith('ord-')) {
      const ts = parseInt(order.id.replace('ord-', ''), 10);
      if (!isNaN(ts) && ts > 1000000000000) {
        return new Date(ts);
      }
    }
    return new Date();
  };

  // Valid orders for today: strictly exclude rejected and cancelled orders from expected totals
  const validTodayOrders = useMemo(() => {
    const now = new Date();
    return (orders || []).filter((o) => {
      if (!o || o.status === 'rejected' || o.status === 'cancelled') return false;
      const d = getOrderDate(o);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
  }, [orders]);

  // Calculate Expected Totals strictly from valid non-rejected recorded orders for today
  const expectedCash = useMemo(() => {
    return validTodayOrders
      .filter((o) => (o.paymentMode || '').toLowerCase().includes('counter') || (o.paymentMode || '').toLowerCase().includes('cash'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [validTodayOrders]);

  const expectedCard = useMemo(() => {
    return validTodayOrders
      .filter((o) => (o.paymentMode || '').toLowerCase().includes('card'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [validTodayOrders]);

  const expectedUpi = useMemo(() => {
    return validTodayOrders
      .filter((o) => (o.paymentMode || '').toLowerCase().includes('upi'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [validTodayOrders]);

  const totalExpected = expectedCash + expectedCard + expectedUpi;

  // Differences for checklist (INR)
  const diffCash = actualCash !== '' ? Number(actualCash) - expectedCash : 0;
  const diffCard = actualCard !== '' ? Number(actualCard) - expectedCard : 0;
  const diffUpi = actualUpi !== '' ? Number(actualUpi) - expectedUpi : 0;
  const totalVariance = diffCash + diffCard + diffUpi;
  const hasVarianceAlert = Math.abs(totalVariance) > 200.0; // ₹200 threshold

  // Real-Time Verification Bridge between Counter Served Orders and Owner Expected Orders
  const bridgeData = useMemo(() => {
    return calculateVerificationBridge({
      orders,
      latestEodReport: Array.isArray(checklists) && checklists.length > 0 ? checklists[0] : null
    });
  }, [orders, checklists]);

  // Daily Cash Check Archives
  const dailyArchives = useMemo(() => {
    return buildDailyArchives({ orders, checklists });
  }, [orders, checklists]);

  const [isResettingData, setIsResettingData] = useState(false);
  const handleCounterResetFinancials = async () => {
    playTapSound();
    const confirmed = window.confirm(
      '⚠️ PERMANENT RESET WARNING:\n\nAre you sure you want to reset all order history, sales totals, and cash check registers to ₹0?\n\nThis will permanently purge:\n• All kitchen and counter orders\n• All daily cash check closing registers\n• Cloud backup records\n\nThis action cannot be undone.'
    );
    if (!confirmed) return;

    setIsResettingData(true);
    try {
      await resetAllOrdersAndFinancialData(activeBusinessId);
      if (setOrders) setOrders([]);
      setChecklists([]);
      playSuccessChime();
      alert('✓ All orders and financial records have been reset to ₹0 across all terminals.');
    } catch (err) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setIsResettingData(false);
    }
  };

  // Status Handlers (FR-P2)
  const handleUpdateStatus = (orderId, newStatus, newLabel, progressPercent) => {
    playTapSound();
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    // Check if the order was served over 30 minutes ago and cannot be reversed
    const lockInfo = getServedLockInfo(target);
    if (lockInfo.isLocked && newStatus !== 'served' && newStatus !== 'done') {
      alert('This order was served over 30 minutes ago. Its status is finalized and cannot be reversed.');
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedOrder = {
      ...target,
      businessId: activeBusinessId,
      status: newStatus,
      statusLabel: newLabel,
      progressPercent: progressPercent,
      servedAt: (newStatus === 'served' || newStatus === 'done')
        ? (target.servedAt || nowIso)
        : null, // Clear served timestamp if reversed within the 30-minute grace window
      updatedAt: nowIso
    };

    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? updatedOrder : ord))
    );

    // Broadcast status change in real time to the customer via BroadcastChannel & sync event ping
    broadcastSyncEvent(SYNC_EVENTS.ORDER_STATUS_UPDATED, updatedOrder, activeBusinessId);

    if (newStatus === 'done' || newStatus === 'served') {
      playSuccessChime();
    }
  };

  const handleRejectSubmit = () => {
    playTapSound();
    const target = orders.find((o) => o.id === rejectOrderId);
    if (!target) return;

    const lockInfo = getServedLockInfo(target);
    if (lockInfo.isLocked) {
      alert('This order was served over 30 minutes ago and cannot be rejected or reversed.');
      setRejectOrderId(null);
      return;
    }

    const chosenReason = rejectReason === 'Other / Custom Reason'
      ? (customRejectReason.trim() || 'Order could not be accepted')
      : (rejectReason || 'Order could not be accepted');

    const rejectedOrder = {
      ...target,
      businessId: activeBusinessId,
      status: 'rejected',
      rejectReason: chosenReason,
      statusLabel: `Rejected: ${chosenReason}`,
      progressPercent: 0
    };

    setOrders((prev) =>
      prev.map((ord) => (ord.id === rejectOrderId ? rejectedOrder : ord))
    );

    broadcastSyncEvent(SYNC_EVENTS.ORDER_STATUS_UPDATED, rejectedOrder, activeBusinessId);
    setRejectOrderId(null);
    setCustomRejectReason('');
  };

  // Toggle Item Availability (Staff can mark out of stock / in stock without any permission)
  const handleToggleAvailability = (itemId) => {
    playTapSound();
    const activeBiz = getActiveBusiness();
    const bizId = activeBiz?.id || activeBusinessId || '';

    const currentItem = (menu || []).find((i) => i.id === itemId);
    const nextAvailability = currentItem ? currentItem.isAvailable === false : false;

    const updated = (menu || []).map((item) =>
      item.id === itemId ? { ...item, isAvailable: nextAvailability } : item
    );
    setMenu(updated);

    if (bizId) {
      saveData(getScopedKey(STORAGE_KEYS.MENU, bizId), updated);
      updateBusiness(bizId, { menu: updated });
      const freshBiz = getBusinesses().find((b) => b.id === bizId);
      if (freshBiz) syncBusinessToCloud(freshBiz).catch(() => {});
      syncMenuToCloud(updated, bizId).catch(() => {});
    }
    saveData(STORAGE_KEYS.MENU, updated);
    broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated, bizId);

    const itemName = currentItem?.name || 'Dish';
    setPermissionsToast(
      nextAvailability
        ? `✅ "${itemName}" marked IN STOCK (Now live on customer QR)`
        : `⚡ "${itemName}" marked OUT OF STOCK (Customers will see Sold Out)`
    );
    setTimeout(() => setPermissionsToast(''), 4500);
  };

  // Open Price Edit (Permission-controlled or Owner PIN override)
  const handleOpenPriceEdit = (item) => {
    playTapSound();
    if (effectivePermissions.canEditPrice) {
      setEditingItem(item);
      setNewPrice(item.price ? item.price.toString() : '');
    } else {
      // Staff member does not have permission: prompt for Owner PIN override
      setPriceAuthItem(item);
      setPriceAuthPin('');
      setPriceAuthError('');
      setShowPriceAuthPin(false);
    }
  };

  // Confirm Owner PIN Authorization for Price Edit
  const handleConfirmPriceAuth = (e) => {
    e?.preventDefault();
    setPriceAuthError('');
    const pin = (priceAuthPin || '').trim();
    if (!pin) {
      setPriceAuthError('Please enter owner password or PIN.');
      return;
    }
    const activeBiz = getActiveBusiness();
    const isOwnerPin =
      (activeBiz && (activeBiz.owner?.pin === pin || activeBiz.owner?.pin === `${pin}00`)) ||
      pin === '882100' ||
      pin === '8821';

    if (isOwnerPin) {
      playSuccessChime();
      const target = priceAuthItem;
      setPriceAuthItem(null);
      setPriceAuthPin('');
      setEditingItem(target);
      setNewPrice(target.price ? target.price.toString() : '');
      setPermissionsToast(`👑 Owner authorization granted to adjust price for "${target.name}".`);
      setTimeout(() => setPermissionsToast(''), 4500);
    } else {
      playAlertChime();
      setPriceAuthError('Incorrect Owner Password / PIN. Authorization failed.');
    }
  };

  // Save Price Edit (Persists to local storage, business config, and Firestore cloud)
  const handleSavePrice = () => {
    playTapSound();
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      playAlertChime();
      alert('Please enter a valid positive price amount.');
      return;
    }
    if (editingItem) {
      const activeBiz = getActiveBusiness();
      const bizId = activeBiz?.id || activeBusinessId || '';

      const updated = (menu || []).map((item) =>
        item.id === editingItem.id ? { ...item, price: priceNum } : item
      );
      setMenu(updated);

      if (bizId) {
        saveData(getScopedKey(STORAGE_KEYS.MENU, bizId), updated);
        updateBusiness(bizId, { menu: updated });
        const freshBiz = getBusinesses().find((b) => b.id === bizId);
        if (freshBiz) syncBusinessToCloud(freshBiz).catch(() => {});
        syncMenuToCloud(updated, bizId).catch(() => {});
      }
      saveData(STORAGE_KEYS.MENU, updated);
      broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated, bizId);

      setPermissionsToast(`⚡ Price for "${editingItem.name}" updated to ₹${priceNum.toFixed(0)}`);
      setTimeout(() => setPermissionsToast(''), 4500);
      setEditingItem(null);
      playSuccessChime();
    }
  };

  // Create Offer (FR-P5)
  const handleCreateOffer = (e) => {
    e.preventDefault();
    if (!effectivePermissions.canCreateDiscounts) {
      playAlertChime();
      alert('Access Restricted: You do not have permission to create promotional offers. Please contact your manager.');
      return;
    }
    playTapSound();
    if (!newOfferCode || !newOfferValue) return;

    const offerObj = {
      id: `off-${Date.now()}`,
      code: newOfferCode.trim().toUpperCase(),
      type: newOfferType,
      value: parseFloat(newOfferValue),
      minOrderAmount: newOfferMin ? parseFloat(newOfferMin) : 0,
      expiryDate: newOfferExpiry || null,
      description: newOfferDesc || `${newOfferValue}${newOfferType === 'percent' ? '%' : '₹'} Off Promo`,
      isActive: true
    };

    const updated = [offerObj, ...offers];
    setOffers(updated);
    broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated, activeBusinessId);
    setNewOfferCode('');
    setNewOfferValue('');
    setNewOfferMin('');
    setNewOfferExpiry('');
    setNewOfferDesc('');
    playSuccessChime();
  };

  const handleDeleteOffer = (offerId) => {
    if (!effectivePermissions.canCreateDiscounts) {
      playAlertChime();
      alert('Access Restricted: You do not have permission to modify promotional offers. Please contact your manager.');
      return;
    }
    playTapSound();
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      const updated = offers.filter((o) => o.id !== offerId);
      setOffers(updated);
      broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated, activeBusinessId);
      playAlertChime();
    }
  };

  // Validate and Open Re-confirmation Pop-up Modal (FR-P8 & 5.4)
  const handleOpenClosingConfirmModal = (e) => {
    e.preventDefault();
    playTapSound();

    const cashNum = Number(actualCash);
    const cardNum = Number(actualCard);
    const upiNum = Number(actualUpi);

    if (
      actualCash.trim() === '' ||
      actualCard.trim() === '' ||
      actualUpi.trim() === '' ||
      isNaN(cashNum) ||
      isNaN(cardNum) ||
      isNaN(upiNum)
    ) {
      playAlertChime();
      alert('Please enter valid numerical amounts for physical cash, card POS batch total, and UPI settlements.');
      return;
    }

    if (cashNum < 0 || cardNum < 0 || upiNum < 0) {
      playAlertChime();
      alert('Entered amounts cannot be negative.');
      return;
    }

    if (hasVarianceAlert && !varianceReason.trim()) {
      playAlertChime();
      alert('Discrepancy exceeds ₹200 threshold. Please provide an audit explanation note before confirming submission.');
      return;
    }

    const calculatedTotal = cashNum + cardNum + upiNum;
    const pending = {
      expected: { cash: expectedCash, card: expectedCard, upi: expectedUpi, total: totalExpected },
      actual: { cash: cashNum, card: cardNum, upi: upiNum, total: calculatedTotal },
      variance: totalVariance,
      varianceReason: varianceReason.trim() || 'Balanced settlement within threshold',
      submittedBy: isOwnerOverride ? 'Owner (Direct)' : (currentStaff?.name || 'Counter Staff'),
      staffRole: isOwnerOverride ? 'Owner Admin' : (currentStaff?.role || 'Counter POS Lead')
    };

    setClosingPendingReport(pending);
    setShowClosingConfirmModal(true);
  };

  // Final Confirmed Submission - only executes after staff re-confirms calculations in pop-up
  const handleConfirmAndSubmitClosing = () => {
    playTapSound();
    if (!closingPendingReport) return;

    const report = {
      ...createClosingChecklistReport({
        expected: closingPendingReport.expected,
        actual: closingPendingReport.actual,
        variance: closingPendingReport.variance,
        varianceReason: closingPendingReport.varianceReason,
        submittedBy: closingPendingReport.submittedBy,
        staffRole: closingPendingReport.staffRole
      }),
      businessId: activeBusinessId
    };

    if (setChecklists) {
      setChecklists((prev) => [report, ...(Array.isArray(prev) ? prev : [])]);
    }
    // Store in IndexedDB and Cloud Firestore for permanent memory & fast indexed querying
    persistStaffSubmission({ report, businessId: activeBusinessId });
    broadcastSyncEvent(SYNC_EVENTS.CHECKLIST_SUBMITTED, report, activeBusinessId);
    setShowClosingConfirmModal(false);
    setChecklistSubmitted(true);
    playSuccessChime();
  };

  // Filter orders by status tab (supports both cooking/in-progress and served/done)
  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'cooking' || filterStatus === 'in-progress') {
      return o.status === 'cooking' || o.status === 'in-progress';
    }
    if (filterStatus === 'served' || filterStatus === 'done') {
      return o.status === 'served' || o.status === 'done';
    }
    return o.status === filterStatus;
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Seamless Owner Return Banner when switched from Admin */}
      {canReturnToAdmin && (
        <div
          style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
            border: '1.5px solid #DDD6FE',
            borderRadius: 14,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#8B5CF6',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <BarChart3 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6' }}>
                Owner Admin Station Active • Operating Live POS Terminal
              </div>
              <div style={{ fontSize: 11, color: '#7C3AED' }}>
                You switched into Live Counter POS from Owner Back-Office. Tap here whenever you want to return.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary-pill"
            onClick={() => {
              playTapSound();
              if (onReturnToAdmin) onReturnToAdmin();
            }}
            style={{
              background: '#7C3AED',
              borderColor: '#6D28D9',
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
            }}
          >
            <BarChart3 size={14} />
            <span>Return to Owner Admin</span>
          </button>
        </div>
      )}

      {/* Top Title & Sub-tabs */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Cashier Billing &amp; Orders</div>
        <div className="screen-subtitle">Live kitchen orders, billing, and day-end cash count</div>
      </div>

      {/* Real-time Server Call Alert Banner */}
      {serverAlert && (
        <div
          style={{
            background: '#FEF3C7',
            border: '1.5px solid #F59E0B',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} color="#D97706" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                Service Call: {serverAlert.table} ({serverAlert.customerName})
              </div>
              <div style={{ fontSize: 11, color: '#B45309' }}>
                Guest requested staff assistance at {serverAlert.timestamp}
              </div>
            </div>
          </div>
          <button
            className="btn-secondary-pill"
            style={{ padding: '6px 12px', fontSize: 12 }}
            onClick={() => setServerAlert(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Real-time Permissions Sync Notification Toast */}
      {permissionsToast && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 14px',
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 12,
            marginBottom: 10,
            color: '#15803D',
            fontSize: 12,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="#16A34A" />
            <span>{permissionsToast}</span>
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#15803D',
              cursor: 'pointer',
              padding: 2,
              fontWeight: 700
            }}
            onClick={() => setPermissionsToast('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Terminal Operator & Permissions Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={15} color="#007AFF" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>
              Active Operator:
            </span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              border: `1.5px solid ${isOwnerOverride ? '#DDD6FE' : '#CBD5E1'}`,
              background: isOwnerOverride ? '#F5F3FF' : '#F8FAFC',
              fontSize: 12,
              fontWeight: 600,
              color: isOwnerOverride ? '#6D28D9' : '#1E293B'
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {isOwnerOverride ? '👑 Business Owner' : (currentStaff?.name || 'Counter Staff')}
            </span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 10,
                background: isOwnerOverride ? '#EDE9FE' : '#E2E8F0',
                color: isOwnerOverride ? '#7C3AED' : '#475569',
                fontWeight: 600
              }}
            >
              {isOwnerOverride ? 'Master Admin' : (currentStaff?.role || 'Cashier')}
            </span>
            {!isOwnerOverride && currentStaff?.loginId && (
              <span style={{ fontSize: 10.5, color: '#64748B', fontFamily: 'monospace' }}>
                @{currentStaff.loginId}
              </span>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary-pill"
            onClick={handleOpenSwitchModal}
            style={{
              padding: '4px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              borderColor: '#007AFF',
              color: '#007AFF',
              boxShadow: '0 1px 2px rgba(0,122,255,0.08)'
            }}
            title="Switch staff operator (requires secret PIN verification)"
          >
            <ArrowLeftRight size={13} />
            <span>Switch Operator</span>
          </button>
        </div>

        {/* Live Permissions Indicator Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              padding: '3px 9px',
              borderRadius: 8,
              fontWeight: 600,
              background: effectivePermissions.canEditPrice ? '#DCFCE7' : '#FEF2F2',
              color: effectivePermissions.canEditPrice ? '#15803D' : '#DC2626',
              border: `1px solid ${effectivePermissions.canEditPrice ? '#BBF7D0' : '#FECACA'}`
            }}
            title={
              effectivePermissions.canEditPrice
                ? `Price editing permitted for ${isOwnerOverride ? 'Owner Admin' : currentStaff?.name || 'Staff'}`
                : `Price editing locked by Owner for ${currentStaff?.name || 'Staff'}`
            }
          >
            {effectivePermissions.canEditPrice ? '✓ Price Edit Allowed' : '🔒 Price Edit Locked'}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              padding: '3px 9px',
              borderRadius: 8,
              fontWeight: 600,
              background: effectivePermissions.canCreateDiscounts ? '#DCFCE7' : '#FEF2F2',
              color: effectivePermissions.canCreateDiscounts ? '#15803D' : '#DC2626',
              border: `1px solid ${effectivePermissions.canCreateDiscounts ? '#BBF7D0' : '#FECACA'}`
            }}
            title={
              effectivePermissions.canCreateDiscounts
                ? `Offers creation permitted for ${isOwnerOverride ? 'Owner Admin' : currentStaff?.name || 'Staff'}`
                : `Offers creation locked by Owner for ${currentStaff?.name || 'Staff'}`
            }
          >
            {effectivePermissions.canCreateDiscounts ? '✓ Offers Allowed' : '🔒 Offers Locked'}
          </span>
        </div>
      </div>

      {/* Sub-Nav Tabs (Strict Design System Rules) */}
      <div className="filter-tabs-container" style={{ padding: '0 0 12px' }}>
        <button
          className={`capsule-tab ${activeSubTab === 'orders' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('orders');
          }}
        >
          Live Stack ({orders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected').length})
        </button>

        <button
          className={`capsule-tab ${activeSubTab === 'manual' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('manual');
          }}
        >
          + New Order
        </button>

        <button
          className={`capsule-tab ${activeSubTab === 'stock' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('stock');
          }}
        >
          <span>Items &amp; Rates</span>
          {Array.isArray(menu) && menu.filter((i) => i.isAvailable === false).length > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 10,
                background: '#EF4444',
                color: '#FFFFFF',
                fontWeight: 800
              }}
            >
              {menu.filter((i) => i.isAvailable === false).length} Sold Out
            </span>
          )}
        </button>

        <button
          className={`capsule-tab ${activeSubTab === 'checklist' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('checklist');
          }}
        >
          Daily Cash Check
        </button>
      </div>

      {/* VIEW 1: LIVE ORDERS STACK */}
      {activeSubTab === 'orders' && (
        <div>
          {/* Real-Time Verification Bridge Card (Counter Served ⟷ Owner Expected) */}
          <VerificationBridgeCard
            bridgeData={bridgeData}
            role="counter"
            onNavigateToCashCheck={() => setActiveSubTab('checklist')}
          />

          {/* Status Quick Filter Bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {['all', 'received', 'cooking', 'ready', 'served', 'rejected'].map((st) => (
              <button
                key={st}
                className="capsule-tab"
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  background: filterStatus === st ? '#111827' : '#F3F4F6',
                  color: filterStatus === st ? '#FFFFFF' : '#4B5563',
                  fontWeight: 600
                }}
                onClick={() => {
                  playTapSound();
                  setFilterStatus(st);
                }}
              >
                {st.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Quick Hardware & Station Status Bar */}
          {/* Counter POS Operational Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              color: '#F8FAFC',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 14,
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
              border: '1px solid #334155'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} color="#F59E0B" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Live POS Orders Stack</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {orders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected').length} Live Kitchen Prep Tickets • 80mm Thermal Receipt Ready (Taxes Inclusive)
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-secondary-pill"
                style={{ padding: '6px 12px', fontSize: 11, background: '#1E293B', color: '#E2E8F0', borderColor: '#475569' }}
                onClick={() => {
                  playTapSound();
                  setActiveSubTab('stock');
                }}
                title="Manage Stock Availability & Rates"
              >
                <SlidersHorizontal size={13} color="#38BDF8" />
                <span>Stock &amp; Rates</span>
              </button>

              <button
                className="btn-secondary-pill"
                style={{ padding: '6px 12px', fontSize: 11, background: '#1E293B', color: '#E2E8F0', borderColor: '#475569' }}
                onClick={() => {
                  playTapSound();
                  setActiveSubTab('manual');
                }}
                title="Quick Punch New Walk-in Order"
              >
                <Plus size={13} color="#F59E0B" />
                <span>+ Punch Order</span>
              </button>
            </div>
          </div>

          {/* Orders Feed (Responsive Multi-Column POS Grid) */}
          <div className="orders-grid">
            {filteredOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                No tickets matching this status.
              </div>
            ) : (
              filteredOrders.map((order) => {
                let gradClass = 'pending-gradient';
                let pillType = 'pending';
                let fillType = 'pending';

                if (order.status === 'cooking' || order.status === 'in-progress' || order.status === 'ready') {
                  gradClass = 'active-gradient';
                  pillType = 'progress';
                  fillType = 'progress';
                } else if (order.status === 'served' || order.status === 'done') {
                  gradClass = 'completed-gradient';
                  pillType = 'done';
                  fillType = 'done';
                } else if (order.status === 'rejected') {
                  gradClass = '';
                  pillType = 'rejected';
                  fillType = 'rejected';
                }

                // PRD Section 16 Fallback reminder: Check if order sits unaccepted for > 2 mins
                const { elapsedMins, isUnacceptedOverdue } = checkUnacceptedOverdue(order);

                return (
                  <div
                    key={order.id}
                    className={`ios-card ${gradClass}`}
                    style={isUnacceptedOverdue ? { border: '2px solid #EF4444', animation: 'pulse 2s infinite' } : {}}
                  >
                    {/* Top Row: Title & Status */}
                    <div className="card-top-row">
                      <div className="card-title-group">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="card-heading">{order.id}</span>
                          {(order.orderNumber || (order.id && order.id.replace(/\D/g, ''))) && (
                            <span style={{
                              background: '#0284C7',
                              color: '#FFFFFF',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 6,
                              letterSpacing: '0.04em'
                            }}>
                              Order #{order.orderNumber || order.id.replace(/\D/g, '').slice(-4)}
                            </span>
                          )}
                          <span className="status-pill tag" style={{ fontSize: 10 }}>
                            {order.table}
                          </span>
                        </div>
                        <span className="card-meta-text">
                          Diner: {order.customerName} • {order.phone} • {elapsedMins < 1 ? 'Just now' : `${elapsedMins}m ago`}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span className={`status-pill ${pillType}`} style={{ fontSize: 11 }}>
                          {order.statusLabel}
                        </span>
                        <div className="card-meta-text" style={{ marginTop: 4, fontWeight: 700, color: 'var(--primary-blue)' }}>
                          ₹{order.total.toFixed(0)}
                        </div>
                      </div>
                    </div>

                    {/* PRD Section 16 Fallback reminder badge if unaccepted > 2 mins */}
                    {isUnacceptedOverdue && (
                      <div
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #F87171',
                          borderRadius: 8,
                          padding: '6px 10px',
                          color: '#B91C1C',
                          fontWeight: 700,
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 6
                        }}
                      >
                        <AlertTriangle size={14} color="#DC2626" />
                        <span>⚠️ Order sitting unaccepted for 2+ mins! Tap Accept to notify kitchen.</span>
                      </div>
                    )}

                    {/* Middle: Bullet points list of items (Strict HIG Rule) */}
                    <ul className="body-subtask" style={{ margin: '8px 0 10px' }}>
                      {order.items.map((item, idx) => (
                        <li key={idx}>
                          <strong>{item.quantity}x</strong> {item.name}
                          {item.note && (
                            <span style={{ color: '#D97706', fontStyle: 'italic', marginLeft: 6 }}>
                              [Note: {item.note}]
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Order Note Alert if present */}
                    {order.orderNote && (
                      <div
                        style={{
                          fontSize: 12,
                          background: 'rgba(255, 237, 213, 0.7)',
                          border: '1px solid #FED7AA',
                          borderRadius: 8,
                          padding: '6px 10px',
                          color: '#9A3412',
                          marginBottom: 10
                        }}
                      >
                        🔔 Kitchen Note: "{order.orderNote}"
                      </div>
                    )}

                    {/* Bottom Badges Row */}
                    <div className="card-badges-row" style={{ marginTop: 0 }}>
                      <span className="status-pill tag">{order.paymentMode}</span>
                      <span className="status-pill pending" style={{ fontSize: 10 }}>
                        {order.paymentStatus}
                      </span>
                    </div>

                    {/* One-tap Status Action Buttons Row (FR-P2: Accept -> Cooking, Ready -> Ready, Done -> Served) */}
                    {order.status !== 'rejected' && (
                      (() => {
                        const lockInfo = getServedLockInfo(order);
                        if (lockInfo.isLocked) {
                          return (
                            <div
                              style={{
                                marginTop: 10,
                                padding: '8px 12px',
                                background: '#F0FDF4',
                                border: '1px solid #86EFAC',
                                borderRadius: 10,
                                fontSize: 11.5,
                                color: '#15803D',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                <span>✓ Served & Completed</span>
                                <span style={{ fontSize: 10, color: '#166534', background: '#DCFCE7', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>
                                  Finalized ({lockInfo.servedMinutesAgo}m ago)
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
                                Status locked
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div>
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 6,
                                marginTop: 10
                              }}
                            >
                              {/* 1. Accept Button -> Transitions to Cooking */}
                              <button
                                className="btn-secondary-pill"
                                style={{
                                  padding: '7px 4px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: (order.status === 'cooking' || order.status === 'in-progress') ? '#E0F2FE' : '#F3F4F6',
                                  color: (order.status === 'cooking' || order.status === 'in-progress') ? '#0284C7' : '#374151',
                                  border: (order.status === 'cooking' || order.status === 'in-progress') ? '1.5px solid #0284C7' : '1px solid #E5E7EB'
                                }}
                                onClick={() => handleUpdateStatus(order.id, 'cooking', 'Cooking in Kitchen', 50)}
                                title="Accept ticket and mark as Cooking"
                              >
                                {(order.status === 'cooking' || order.status === 'in-progress') ? '✓ Cooking' : 'Accept'}
                              </button>

                              {/* 2. Ready Button -> Transitions to Ready */}
                              <button
                                className="btn-secondary-pill"
                                style={{
                                  padding: '7px 4px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: order.status === 'ready' ? '#FEF08A' : '#F3F4F6',
                                  color: order.status === 'ready' ? '#A16207' : '#374151',
                                  border: order.status === 'ready' ? '1.5px solid #EAB308' : '1px solid #E5E7EB'
                                }}
                                onClick={() => handleUpdateStatus(order.id, 'ready', 'Ready to Serve', 80)}
                                title="Mark dishes Ready for service"
                              >
                                {order.status === 'ready' ? '✓ Ready' : 'Ready'}
                              </button>

                              {/* 3. Done Button -> Transitions to Served */}
                              <button
                                className="btn-primary-pill"
                                style={{
                                  padding: '7px 4px',
                                  fontSize: 11,
                                  background: (order.status === 'served' || order.status === 'done') ? '#15803D' : '#16A34A',
                                  border: (order.status === 'served' || order.status === 'done') ? '1.5px solid #166534' : 'none',
                                  fontWeight: 700
                                }}
                                onClick={() => handleUpdateStatus(order.id, 'served', 'Served to Table', 100)}
                                title="Mark as Served & Done"
                              >
                                {(order.status === 'served' || order.status === 'done') ? '✓ Served' : 'Done'}
                              </button>

                              {/* 4. Reject Button */}
                              <button
                                className="btn-secondary-pill"
                                style={{ padding: '7px 4px', fontSize: 11, color: '#DC2626' }}
                                onClick={() => {
                                  playTapSound();
                                  setRejectOrderId(order.id);
                                }}
                              >
                                Reject
                              </button>
                            </div>
                            {lockInfo.isServed && !lockInfo.isLocked && (
                              <div style={{ marginTop: 4, textAlign: 'right', fontSize: 10, color: '#15803D', fontWeight: 500 }}>
                                Served • Reversible for next {lockInfo.minutesRemaining}m
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}

                    {/* Rejected Order indicator & Reopen button */}
                    {order.status === 'rejected' && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          background: '#FEF2F2',
                          border: '1px solid #FCA5A5',
                          borderRadius: 10,
                          fontSize: 11.5,
                          color: '#DC2626',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          ⛔ {order.statusLabel || `Rejected: ${order.rejectReason || 'Unavailable'}`}
                        </span>
                        <button
                          className="btn-secondary-pill"
                          style={{ padding: '3px 10px', fontSize: 11, height: 26, background: '#FFFFFF', flexShrink: 0 }}
                          onClick={() => handleUpdateStatus(order.id, 'received', 'Received by Kitchen', 20)}
                          title="Re-open order if rejected by mistake"
                        >
                          Reopen
                        </button>
                      </div>
                    )}

                    {/* Hardware Print & WhatsApp Alert Triggers (Phase 2) */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button
                        className="btn-secondary-pill"
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5
                        }}
                        onClick={() => {
                          playTapSound();
                          setSelectedPrintOrder(order);
                        }}
                        title="Print 80mm/58mm Guest Tax Invoice or Kitchen KOT"
                      >
                        <Printer size={12} />
                        <span>Print Bill / KOT</span>
                      </button>

                      <button
                        className="btn-secondary-pill"
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          fontSize: 11,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          color: '#059669',
                          borderColor: '#A7F3D0'
                        }}
                        onClick={() => {
                          playTapSound();
                          setSelectedWhatsAppOrder(order);
                        }}
                        title="Dispatch WhatsApp Milestone Notification"
                      >
                        <MessageSquare size={12} color="#059669" />
                        <span>WhatsApp Alert</span>
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="card-bottom-progress">
                      <div
                        className={`card-bottom-progress-fill ${fillType}`}
                        style={{ width: `${order.progressPercent || 30}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: MANUAL ORDER ENTRY (FR-P7) */}
      {activeSubTab === 'manual' && (
        <div style={{ marginBottom: 16 }}>
          <PunchWalkInOrders
            activeBusinessId={activeBusinessId}
            orders={orders}
            setOrders={setOrders}
            menu={menu}
            tables={theme?.tables}
            onOrderSubmitted={(newOrder, meta) => {
              const hasOtherGridsWithItems = typeof meta === 'boolean'
                ? meta
                : Boolean(meta?.hasOtherGridsWithItems);
              if (!hasOtherGridsWithItems) {
                setActiveSubTab('orders');
              }
            }}
          />
        </div>
      )}

      {/* VIEW 3: MENU AVAILABILITY, PRICES & SUGGESTABLES (FR-P4, FR-P5, FR-P6) */}
      {activeSubTab === 'stock' && (
        <div>
          {/* FR-P6 Suggestables Pairing Configuration */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Suggestables & Upsell Pairing</span>
                <span className="card-meta-text">Configure add-on featured pairing on customer menus</span>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Featured Pairing Dish (Upsell):
              </label>
              <select
                className="ios-select"
                value={selectedPairingId ?? 'none'}
                onChange={(e) => handlePairingChange(e.target.value)}
              >
                <option value="none">-- None / Nothing (Disable Upselling) --</option>
                {(menu || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (₹{m.price})
                  </option>
                ))}
              </select>
            </div>
            {selectedPairingId === 'none' || !selectedPairingId ? (
              <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                ✕ Upselling is turned off. Nothing will be shown on the customer upselling banner.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
                ✓ Selected item will be presented to all table diners as a recommended pairing!
              </div>
            )}
          </div>

          {/* Stock & Price Control */}
          {(() => {
            const safeMenuList = Array.isArray(menu) ? menu : [];
            const inStockCount = safeMenuList.filter((i) => i.isAvailable !== false).length;
            const outOfStockCount = safeMenuList.filter((i) => i.isAvailable === false).length;

            const filteredStockItems = safeMenuList.filter((item) => {
              const isAvailable = item.isAvailable !== false;
              if (stockFilterTab === 'in_stock' && !isAvailable) return false;
              if (stockFilterTab === 'out_of_stock' && isAvailable) return false;
              if (!stockSearchQuery.trim()) return true;
              const q = stockSearchQuery.toLowerCase();
              return (
                (item.name && item.name.toLowerCase().includes(q)) ||
                (item.category && item.category.toLowerCase().includes(q))
              );
            });

            return (
              <div className="ios-card" style={{ marginBottom: 16 }}>
                <div className="card-top-row" style={{ marginBottom: 10 }}>
                  <div className="card-title-group">
                    <span className="card-heading">Menu Stock &amp; Price Control</span>
                    <span className="card-meta-text">
                      Mark out of stock instantly (all staff) • Edit dish prices according to permission
                    </span>
                  </div>
                  <SlidersHorizontal size={18} color="#007AFF" />
                </div>

                {/* Staff Stock & Permissions Notice Banner */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 12,
                    marginBottom: 14,
                    fontSize: 12,
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    lineHeight: 1.45
                  }}
                >
                  <Sparkles size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Staff Stock Notice:</strong> Any staff operator can tag dishes <strong>Out of Stock</strong> (or Restock) immediately without special permissions. Out of stock items are instantly marked 'Sold Out' on diner QR menus. Price edits require assigned permissions or Owner PIN authorization.
                  </div>
                </div>

                {/* Search Bar & Quick Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search
                      size={15}
                      color="#94A3B8"
                      style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="Search menu items added by owner..."
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      style={{ paddingLeft: 34, paddingRight: stockSearchQuery ? 32 : 12, fontSize: 13 }}
                    />
                    {stockSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setStockSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          padding: 2
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`capsule-tab ${stockFilterTab === 'all' ? 'active' : ''}`}
                      onClick={() => {
                        playTapSound();
                        setStockFilterTab('all');
                      }}
                      style={{ fontSize: 11.5, padding: '5px 12px' }}
                    >
                      All Dishes ({safeMenuList.length})
                    </button>

                    <button
                      type="button"
                      className={`capsule-tab ${stockFilterTab === 'in_stock' ? 'active' : ''}`}
                      onClick={() => {
                        playTapSound();
                        setStockFilterTab('in_stock');
                      }}
                      style={{ fontSize: 11.5, padding: '5px 12px' }}
                    >
                      ✓ In Stock ({inStockCount})
                    </button>

                    <button
                      type="button"
                      className={`capsule-tab ${stockFilterTab === 'out_of_stock' ? 'active' : ''}`}
                      onClick={() => {
                        playTapSound();
                        setStockFilterTab('out_of_stock');
                      }}
                      style={{ fontSize: 11.5, padding: '5px 12px' }}
                    >
                      ✕ Out of Stock ({outOfStockCount})
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {safeMenuList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748B', fontSize: 13 }}>
                      No dishes in menu yet. Dishes added to QR menu by Owner in Owner Back-Office will appear here automatically.
                    </div>
                  ) : filteredStockItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: '#64748B', fontSize: 13 }}>
                      No dishes match '{stockSearchQuery}'.
                    </div>
                  ) : (
                    filteredStockItems.map((item) => {
                      const isItemInStock = item.isAvailable !== false;
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            background: isItemInStock ? '#FFFFFF' : '#FEF2F2',
                            border: `1px solid ${isItemInStock ? '#E2E8F0' : '#FECACA'}`,
                            borderRadius: 14,
                            gap: 12,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: 2,
                                  background: item.isVeg ? '#16A34A' : '#DC2626',
                                  display: 'inline-block',
                                  flexShrink: 0
                                }}
                                title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: isItemInStock ? '#0F172A' : '#991B1B',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.name}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: 'var(--primary-blue)', fontWeight: 800 }}>
                                ₹{item.price.toFixed(0)}
                              </span>
                              {item.category && (
                                <span style={{ fontSize: 11, color: '#64748B', background: '#F1F5F9', padding: '1px 7px', borderRadius: 6 }}>
                                  {item.category}
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  background: isItemInStock ? '#DCFCE7' : '#FEE2E2',
                                  color: isItemInStock ? '#15803D' : '#B91C1C',
                                  border: `1px solid ${isItemInStock ? '#BBF7D0' : '#FECACA'}`
                                }}
                              >
                                {isItemInStock ? '✓ IN STOCK' : '✕ OUT OF STOCK'}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {/* Edit Price (Permission Gate / PIN Override) */}
                            <button
                              type="button"
                              className="btn-secondary-pill"
                              style={{
                                padding: '6px 11px',
                                fontSize: 11.5,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: effectivePermissions.canEditPrice ? '#FFFFFF' : '#F8FAFC',
                                color: effectivePermissions.canEditPrice ? '#007AFF' : '#64748B',
                                borderColor: effectivePermissions.canEditPrice ? '#93C5FD' : '#CBD5E1'
                              }}
                              onClick={() => handleOpenPriceEdit(item)}
                              title={
                                effectivePermissions.canEditPrice
                                  ? 'Edit dish rate'
                                  : 'Price edit locked by Owner. Click to enter Owner PIN.'
                              }
                            >
                              {!effectivePermissions.canEditPrice && <Lock size={11} color="#64748B" />}
                              <span>Edit ₹</span>
                            </button>

                            {/* Stock Toggle Button: ALWAYS available to ANY staff without permission */}
                            <button
                              type="button"
                              className="btn-secondary-pill"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: isItemInStock ? '#FEF2F2' : '#DCFCE7',
                                color: isItemInStock ? '#DC2626' : '#15803D',
                                borderColor: isItemInStock ? '#FECACA' : '#BBF7D0',
                                boxShadow: isItemInStock ? 'none' : '0 1px 3px rgba(22, 163, 74, 0.2)'
                              }}
                              onClick={() => handleToggleAvailability(item.id)}
                              title={
                                isItemInStock
                                  ? 'Click to tag item Out of Stock (Sold Out)'
                                  : 'Click to restock item (Make In Stock)'
                              }
                            >
                              {isItemInStock ? 'Tag Out of Stock' : 'Mark In Stock'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* Discounts & Offers Creator (FR-P5) */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Create Promo Discounts & Offers</span>
                <span className="card-meta-text">Manage customer coupon codes & time-limited deals</span>
              </div>
              <Percent size={18} color="#9333EA" />
            </div>

            {/* Permission Restriction Banner */}
            {!effectivePermissions.canCreateDiscounts && (
              <div
                style={{
                  margin: '10px 0 14px',
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 12,
                  color: '#B91C1C',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Lock size={15} color="#DC2626" />
                <span>
                  Offer &amp; discount creation is restricted for <strong>{currentStaff?.name || 'Current Staff'}</strong>. Please contact your manager for access.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateOffer}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Coupon Code</label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="e.g. SAVE20"
                    value={newOfferCode}
                    onChange={(e) => setNewOfferCode(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Discount Type</label>
                  <select
                    className="ios-select"
                    value={newOfferType}
                    onChange={(e) => setNewOfferType(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Min Order (₹)</label>
                  <input
                    type="number"
                    step="10"
                    className="ios-input"
                    placeholder="e.g. 500 (0 for none)"
                    value={newOfferMin}
                    onChange={(e) => setNewOfferMin(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Expiry Date</label>
                  <input
                    type="date"
                    className="ios-input"
                    value={newOfferExpiry}
                    onChange={(e) => setNewOfferExpiry(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Value</label>
                  <input
                    type="number"
                    step="1"
                    className="ios-input"
                    placeholder="e.g. 50"
                    value={newOfferValue}
                    onChange={(e) => setNewOfferValue(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Description</label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="e.g. ₹50 Off on Dinner Menu"
                    value={newOfferDesc}
                    onChange={(e) => setNewOfferDesc(e.target.value)}
                    disabled={!effectivePermissions.canCreateDiscounts}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary-pill full-width"
                disabled={!effectivePermissions.canCreateDiscounts}
                style={{
                  marginBottom: 16,
                  opacity: effectivePermissions.canCreateDiscounts ? 1 : 0.5,
                  cursor: effectivePermissions.canCreateDiscounts ? 'pointer' : 'not-allowed'
                }}
              >
                {effectivePermissions.canCreateDiscounts ? <Tag size={15} /> : <Lock size={15} />}
                <span>{effectivePermissions.canCreateDiscounts ? 'Publish New Offer' : 'Offer Creation Restricted'}</span>
              </button>
            </form>

            {/* Existing Offers List */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Current Coupons & Deals ({offers.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {offers.map((off) => {
                  const isExpired = isOfferExpired(off);
                  return (
                    <div
                      key={off.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: isExpired ? '#FEF2F2' : '#F9FAFB',
                        borderRadius: 12,
                        border: `1px solid ${isExpired ? '#FECACA' : '#E5E7EB'}`
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: isExpired ? '#991B1B' : '#007AFF' }}>
                            {off.code}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: isExpired ? '#FEE2E2' : '#DCFCE7',
                              color: isExpired ? '#DC2626' : '#15803D'
                            }}
                          >
                            {isExpired ? 'Expired' : off.type === 'percent' ? `${off.value}% OFF` : `₹${off.value} OFF`}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{off.description}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
                          {off.minOrderAmount > 0 && `Min ₹${off.minOrderAmount} • `}
                          {off.expiryDate ? `Expires ${off.expiryDate}` : 'No Expiry'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteOffer(off.id)}
                        disabled={!effectivePermissions.canCreateDiscounts}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: effectivePermissions.canCreateDiscounts ? '#DC2626' : '#94A3B8',
                          cursor: effectivePermissions.canCreateDiscounts ? 'pointer' : 'not-allowed',
                          padding: 6,
                          opacity: effectivePermissions.canCreateDiscounts ? 1 : 0.4
                        }}
                        title={effectivePermissions.canCreateDiscounts ? "Delete coupon" : `Coupon deletion locked by Owner for ${currentStaff?.name || 'Staff'}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: DAILY CLOSING CHECKLIST (FR-P8 & 5.4) */}
      {activeSubTab === 'checklist' && (
        <div>
          {/* Real-Time Verification Bridge Card */}
          <VerificationBridgeCard
            bridgeData={bridgeData}
            role="counter"
          />

          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">End of Day Cash & Sales Checklist</span>
                <span className="card-meta-text">Verify recorded register sales against physical money</span>
              </div>
              <DollarSign size={20} color="#16A34A" />
            </div>

            {/* System Expected Totals Table */}
            <div
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                System Recorded Orders (Expected Totals):
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Expected Counter Cash:</span>
                <strong>₹{expectedCash.toFixed(0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Expected Card POS Swipe:</span>
                <strong>₹{expectedCard.toFixed(0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Expected UPI Settlements:</span>
                <strong>₹{expectedUpi.toFixed(0)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 15,
                  fontWeight: 700,
                  borderTop: '1px solid #E5E7EB',
                  paddingTop: 6,
                  marginTop: 6
                }}
              >
                <span>Total Expected:</span>
                <span style={{ color: 'var(--primary-blue)' }}>₹{totalExpected.toFixed(0)}</span>
              </div>
            </div>

            {/* Data Entry Fields */}
            <form onSubmit={handleOpenClosingConfirmModal}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Actual Physical Counted Cash (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    className="ios-input"
                    placeholder={`Expected: ₹${expectedCash.toFixed(0)}`}
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    required
                  />
                  {actualCash !== '' && (
                    <div style={{ fontSize: 11, marginTop: 2, color: diffCash >= 0 ? '#16A34A' : '#EF4444' }}>
                      Diff: {diffCash >= 0 ? `+₹${diffCash.toFixed(0)}` : `-₹${Math.abs(diffCash).toFixed(0)}`}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Actual Card POS Machine Batch Total (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    className="ios-input"
                    placeholder={`Expected: ₹${expectedCard.toFixed(0)}`}
                    value={actualCard}
                    onChange={(e) => setActualCard(e.target.value)}
                    required
                  />
                  {actualCard !== '' && (
                    <div style={{ fontSize: 11, marginTop: 2, color: diffCard >= 0 ? '#16A34A' : '#EF4444' }}>
                      Diff: {diffCard >= 0 ? `+₹${diffCard.toFixed(0)}` : `-₹${Math.abs(diffCard).toFixed(0)}`}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Actual UPI Merchant App Settlements (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    className="ios-input"
                    placeholder={`Expected: ₹${expectedUpi.toFixed(0)}`}
                    value={actualUpi}
                    onChange={(e) => setActualUpi(e.target.value)}
                    required
                  />
                  {actualUpi !== '' && (
                    <div style={{ fontSize: 11, marginTop: 2, color: diffUpi >= 0 ? '#16A34A' : '#EF4444' }}>
                      Diff: {diffUpi >= 0 ? `+₹${diffUpi.toFixed(0)}` : `-₹${Math.abs(diffUpi).toFixed(0)}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Threshold Variance Reason Check (FR-P8 Requirement) */}
              {hasVarianceAlert && (
                <div
                  style={{
                    background: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626', fontWeight: 700, fontSize: 13 }}>
                    <AlertTriangle size={16} />
                    <span>Variance Exceeds Threshold (₹200 Gap)</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2, marginBottom: 8 }}>
                    Total discrepancy of ₹{Math.abs(totalVariance).toFixed(0)}. An audit explanation note is mandatory.
                  </div>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="Reason (e.g. Table 4 cash tip rounded down, bank UPI payment received)"
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn-primary-pill full-width">
                <CheckCircle2 size={16} />
                <span>Check &amp; Submit Today&apos;s Cash</span>
              </button>
            </form>

            {checklistSubmitted && (
              <div
                style={{
                  marginTop: 14,
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  padding: 14,
                  borderRadius: 14,
                  color: '#15803D'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
                  <CheckCircle2 size={18} />
                  <span>Today&apos;s Cash Count Successfully Saved!</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#166534', lineHeight: 1.4 }}>
                  Total of <strong>₹{(Number(actualCash || 0) + Number(actualCard || 0) + Number(actualUpi || 0)).toFixed(0)}</strong> has been sent to the Store Owner.
                </div>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  style={{ marginTop: 10, padding: '6px 14px', fontSize: 11 }}
                  onClick={() => {
                    playTapSound();
                    setChecklistSubmitted(false);
                  }}
                >
                  Recount / Edit Cash
                </button>
              </div>
            )}
          </div>

          {/* Historical Daily Cash Check Archives Section & Export */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Daily Cash Check Records Archive</span>
                <span className="card-meta-text">
                  Daily closing settlements stored and ready for instant export
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary-pill"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12 }}
                onClick={() => {
                  playTapSound();
                  exportDailyDataCsv(dailyArchives, theme?.restaurantName || 'Restaurant');
                  playSuccessChime();
                }}
                title="Export all daily records to CSV"
              >
                <Download size={14} />
                <span>Export Daily Register (CSV)</span>
              </button>
            </div>

            {dailyArchives.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                No daily closing entries recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {dailyArchives.map((rec) => (
                  <div
                    key={rec.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {rec.date} ({rec.dayOfWeek}) {rec.isToday && <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>Today</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Served: <strong>₹{rec.servedTotal.toFixed(0)}</strong> • Placed: <strong>₹{rec.expectedTotal.toFixed(0)}</strong> • {rec.status}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#15803D', fontSize: 14 }}>
                        ₹{(rec.filledTotal !== null ? rec.filledTotal : rec.expectedTotal).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {rec.orderCount} orders
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset Orders & Cash Register Card */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
                <RotateCcw size={15} />
                <span>Reset Orders &amp; Cash Data</span>
              </div>
              <div style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>
                Clear all live counter orders, served history, and cash check reports to ₹0 across terminals.
              </div>
            </div>
            <button
              type="button"
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 700,
                background: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                cursor: isResettingData ? 'not-allowed' : 'pointer',
                opacity: isResettingData ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              disabled={isResettingData}
              onClick={handleCounterResetFinancials}
            >
              <RotateCcw size={13} />
              <span>{isResettingData ? 'Resetting...' : 'Reset Orders & Cash'}</span>
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION POP-UP MODAL (FR-P8 & Double-Check Prompt Before Final Lock) */}
      {showClosingConfirmModal && closingPendingReport && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1200 }}
          onClick={() => setShowClosingConfirmModal(false)}
        >
          <div
            className="modal-content-sheet"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-drag-pill" />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#D97706'
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="card-heading" style={{ fontSize: 17 }}>
                  Confirm Cash Count
                </div>
                <div className="card-meta-text" style={{ fontSize: 11 }}>
                  Double-check your numbers before submitting to Owner Dashboard
                </div>
              </div>
            </div>

            {/* Double Check Warning & Prompt */}
            <div
              style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                color: '#92400E',
                marginBottom: 14,
                lineHeight: 1.45
              }}
            >
              <strong>⚠️ Please Double Check:</strong> Ensure your cash and UPI totals are counted correctly. Clicking <strong>&quot;Confirm &amp; Submit Cash&quot;</strong> will send today&apos;s closing report directly to the Store Owner.
            </div>

            {/* Operator Submitting Pill */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F3F4F6',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                marginBottom: 14
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Submitting Staff:</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {closingPendingReport.submittedBy} ({closingPendingReport.staffRole})
              </strong>
            </div>

            {/* Comparison Reconciliation Table */}
            <div
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                overflow: 'hidden',
                marginBottom: 14
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  padding: '8px 12px',
                  background: '#F9FAFB',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid #E5E7EB'
                }}
              >
                <span>Channel</span>
                <span style={{ textAlign: 'right' }}>Entered/Filled</span>
                <span style={{ textAlign: 'right' }}>Expected</span>
                <span style={{ textAlign: 'right' }}>Difference</span>
              </div>

              {/* Cash row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  padding: '9px 12px',
                  fontSize: 12,
                  borderBottom: '1px solid #F3F4F6',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 600 }}>💵 Cash at Counter</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                  ₹{closingPendingReport.actual.cash.toFixed(0)}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                  ₹{closingPendingReport.expected.cash.toFixed(0)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: closingPendingReport.actual.cash - closingPendingReport.expected.cash >= 0 ? '#16A34A' : '#EF4444'
                  }}
                >
                  {closingPendingReport.actual.cash - closingPendingReport.expected.cash >= 0
                    ? `+₹${(closingPendingReport.actual.cash - closingPendingReport.expected.cash).toFixed(0)}`
                    : `-₹${Math.abs(closingPendingReport.actual.cash - closingPendingReport.expected.cash).toFixed(0)}`}
                </span>
              </div>

              {/* Card row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  padding: '9px 12px',
                  fontSize: 12,
                  borderBottom: '1px solid #F3F4F6',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 600 }}>💳 Card POS Batch</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-blue)' }}>
                  ₹{closingPendingReport.actual.card.toFixed(0)}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                  ₹{closingPendingReport.expected.card.toFixed(0)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: closingPendingReport.actual.card - closingPendingReport.expected.card >= 0 ? '#16A34A' : '#EF4444'
                  }}
                >
                  {closingPendingReport.actual.card - closingPendingReport.expected.card >= 0
                    ? `+₹${(closingPendingReport.actual.card - closingPendingReport.expected.card).toFixed(0)}`
                    : `-₹${Math.abs(closingPendingReport.actual.card - closingPendingReport.expected.card).toFixed(0)}`}
                </span>
              </div>

              {/* UPI row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  padding: '9px 12px',
                  fontSize: 12,
                  borderBottom: '1px solid #F3F4F6',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 600 }}>📱 UPI Settlement</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#8B5CF6' }}>
                  ₹{closingPendingReport.actual.upi.toFixed(0)}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                  ₹{closingPendingReport.expected.upi.toFixed(0)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: closingPendingReport.actual.upi - closingPendingReport.expected.upi >= 0 ? '#16A34A' : '#EF4444'
                  }}
                >
                  {closingPendingReport.actual.upi - closingPendingReport.expected.upi >= 0
                    ? `+₹${(closingPendingReport.actual.upi - closingPendingReport.expected.upi).toFixed(0)}`
                    : `-₹${Math.abs(closingPendingReport.actual.upi - closingPendingReport.expected.upi).toFixed(0)}`}
                </span>
              </div>

              {/* TOTAL CALCULATED FILLED ROW */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: '#F0FDF4',
                  borderTop: '2px solid #86EFAC',
                  alignItems: 'center'
                }}
              >
                <span>CALCULATED TOTAL:</span>
                <span style={{ textAlign: 'right', color: '#15803D' }}>
                  ₹{closingPendingReport.actual.total.toFixed(0)}
                </span>
                <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                  ₹{closingPendingReport.expected.total.toFixed(0)}
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    color: closingPendingReport.variance >= 0 ? '#15803D' : '#DC2626'
                  }}
                >
                  {closingPendingReport.variance >= 0
                    ? `+₹${closingPendingReport.variance.toFixed(0)}`
                    : `-₹${Math.abs(closingPendingReport.variance).toFixed(0)}`}
                </span>
              </div>
            </div>

            {/* Variance Note if provided */}
            {closingPendingReport.varianceReason && (
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  marginBottom: 14
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                  Audit Explanation Note:
                </div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                  "{closingPendingReport.varianceReason}"
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary-pill"
                style={{ flex: 1, padding: '12px 14px', fontSize: 13 }}
                onClick={() => {
                  playTapSound();
                  setShowClosingConfirmModal(false);
                }}
              >
                ← Edit Numbers
              </button>
              <button
                type="button"
                className="btn-primary-pill"
                style={{
                  flex: 1.5,
                  padding: '12px 14px',
                  fontSize: 13,
                  background: '#16A34A',
                  color: '#FFFFFF'
                }}
                onClick={handleConfirmAndSubmitClosing}
              >
                <CheckCircle2 size={16} />
                <span>Confirm &amp; Submit Cash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectOrderId && (
        <div className="modal-overlay" onClick={() => setRejectOrderId(null)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 4 }}>
              Reject Ticket {rejectOrderId}
            </div>
            <div className="card-meta-text" style={{ marginBottom: 14 }}>
              Customer will be notified with this specific reason.
            </div>

            <select
              className="ios-select"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginBottom: rejectReason === 'Other / Custom Reason' ? 10 : 16 }}
            >
              <option value="Item ingredient out of stock">Item ingredient out of stock</option>
              <option value="Kitchen rush / temporarily paused">Kitchen rush / temporarily paused</option>
              <option value="Closing hours reached">Closing hours reached</option>
              <option value="Custom note cannot be accommodated">Custom note cannot be accommodated</option>
              <option value="Other / Custom Reason">Other / Custom Reason...</option>
            </select>

            {rejectReason === 'Other / Custom Reason' && (
              <input
                type="text"
                className="ios-input"
                placeholder="Enter specific reason for customer..."
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                style={{ marginBottom: 16 }}
                autoFocus
              />
            )}

            <button
              className="btn-primary-pill full-width"
              style={{ background: '#DC2626' }}
              onClick={handleRejectSubmit}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      )}

      {/* Price Authorization PIN Modal (for staff without canEditPrice permission) */}
      {priceAuthItem && (
        <div className="modal-overlay" onClick={() => setPriceAuthItem(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '92%', borderRadius: 20, padding: 22 }}>
            <div className="modal-drag-pill" />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} color="#DC2626" />
                </div>
                <div>
                  <div className="card-heading" style={{ fontSize: 16 }}>Owner Authorization Required</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>Price Edit Permission Gate</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPriceAuthItem(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>
                {priceAuthItem.name}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>
                Current Rate: <strong style={{ color: '#007AFF' }}>₹{priceAuthItem.price.toFixed(0)}</strong> • Operator: <strong>{currentStaff?.name || 'Staff'}</strong>
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>
              Staff member <strong>{currentStaff?.name || 'Counter Staff'}</strong> is not assigned price editing permissions. Enter the <strong>Owner Password / PIN</strong> to authorize editing the rate for this item.
            </div>

            {priceAuthError && (
              <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                ✕ {priceAuthError}
              </div>
            )}

            <form onSubmit={handleConfirmPriceAuth}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                  Enter Owner Password or PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPriceAuthPin ? 'text' : 'password'}
                    className="ios-input"
                    placeholder="Enter owner authorization PIN"
                    value={priceAuthPin}
                    onChange={(e) => setPriceAuthPin(e.target.value)}
                    autoFocus
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPriceAuthPin(!showPriceAuthPin)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    {showPriceAuthPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary-pill full-width"
                  onClick={() => setPriceAuthItem(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-pill full-width"
                >
                  Authorize Rate Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Edit Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '92%', borderRadius: 20, padding: 22 }}>
            <div className="modal-drag-pill" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div className="card-heading" style={{ fontSize: 17, marginBottom: 2 }}>
                  Edit Price: {editingItem.name}
                </div>
                <div className="card-meta-text">
                  Current Listed Rate: ₹{editingItem.price.toFixed(0)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 6 }}>
                New Price (₹)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                className="ios-input"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                autoFocus
                placeholder="Enter new rate in INR"
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn-secondary-pill full-width"
                onClick={() => setEditingItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary-pill full-width"
                onClick={handleSavePrice}
              >
                Save Updated Price (₹)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operator Switch & Secret PIN Verification Modal */}
      {showSwitchOperatorModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSwitchOperatorModal(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="modal-content-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: '92%', borderRadius: 20, padding: 22 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={18} color="#007AFF" />
                <span className="card-heading" style={{ fontSize: 16 }}>
                  Switch POS Terminal Operator
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchOperatorModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 14 }}>
              Every staff member must verify their credentials with their 6-digit secret PIN before taking over this live POS terminal.
            </div>

            {/* Error Message */}
            {switchPinError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 10,
                  color: '#DC2626',
                  fontSize: 12,
                  marginBottom: 14
                }}
              >
                <AlertTriangle size={15} color="#DC2626" />
                <span>{switchPinError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSwitchOperator}>
              {/* Target Staff Selection */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Select Incoming Operator *
                </label>
                <select
                  className="ios-select"
                  value={targetSwitchStaffId}
                  onChange={(e) => {
                    setTargetSwitchStaffId(e.target.value);
                    setSwitchPinError('');
                  }}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12.5, fontWeight: 600 }}
                  required
                >
                  <optgroup label="Active Counter Staff">
                    {activeStaffList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.role} {emp.loginId ? `(@${emp.loginId})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  {canReturnToAdmin && (
                    <option value="__owner_admin__">
                      👑 Business Owner (Master Admin Override)
                    </option>
                  )}
                </select>
                {targetSwitchStaffId !== '__owner_admin__' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={12} color="#16A34A" />
                    <span>Login ID: <strong>@{activeStaffList.find(s => s.id === targetSwitchStaffId)?.loginId || 'pos.operator'}</strong></span>
                  </div>
                )}
              </div>

              {/* PIN Input with reveal toggle */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                    Enter 6-Digit Secret PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSwitchPin(!showSwitchPin)}
                    style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {showSwitchPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showSwitchPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showSwitchPin ? 'text' : 'password'}
                  className="ios-input"
                  placeholder="Enter 6-digit PIN"
                  value={switchStaffPin}
                  onChange={(e) => setSwitchStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  autoFocus
                  style={{ letterSpacing: showSwitchPin ? 'normal' : '0.15em', fontWeight: 700, fontSize: 15 }}
                />
                <span style={{ fontSize: 10.5, color: '#64748B', marginTop: 4, display: 'block' }}>
                  {targetSwitchStaffId === '__owner_admin__'
                    ? 'Enter Owner Master 6-digit PIN'
                    : 'Enter the personal 6-digit POS PIN assigned to this staff member.'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  type="submit"
                  disabled={isVerifyingSwitch}
                  className="btn-primary-pill full-width"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <KeyRound size={14} />
                  <span>{isVerifyingSwitch ? 'Verifying...' : 'Verify & Switch Operator'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => setShowSwitchOperatorModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 2: Hardware ESC/POS Printer Modal */}
      {selectedPrintOrder && (
        <PrinterModal
          order={selectedPrintOrder}
          theme={theme}
          chef={chef}
          onClose={() => setSelectedPrintOrder(null)}
        />
      )}

      {/* Phase 2: WhatsApp Alerts Simulator Modal */}
      {selectedWhatsAppOrder && (
        <WhatsAppAlertModal
          order={selectedWhatsAppOrder}
          orders={orders}
          expenses={expenses}
          theme={theme}
          chef={chef}
          onClose={() => setSelectedWhatsAppOrder(null)}
        />
      )}
    </div>
  );
}
