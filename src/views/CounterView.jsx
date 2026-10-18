import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import PrinterModal from '../components/PrinterModal';
import WhatsAppAlertModal from '../components/WhatsAppAlertModal';
import PunchWalkInOrders from '../components/PunchWalkInOrders';
import { broadcastSyncEvent, SYNC_EVENTS, subscribeSyncEvents } from '../utils/sync';

function checkUnacceptedOverdue(order) {
  if (!order || !order.createdAt) return { elapsedMins: 0, isUnacceptedOverdue: false };
  const createdTime = new Date(order.createdAt).getTime();
  const elapsedMs = Math.max(0, Date.now() - createdTime);
  const isUnacceptedOverdue = order.status === 'received' && elapsedMs > 2 * 60 * 1000;
  const elapsedMins = Math.floor(elapsedMs / 60000);
  return { elapsedMins, isUnacceptedOverdue };
}

function isOfferExpired(offer) {
  if (!offer || !offer.expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return offer.expiryDate < today;
}

function createClosingChecklistReport({ expected, actual, variance, varianceReason }) {
  const now = new Date();
  return {
    id: `CHK-${now.getTime()}`,
    date: now.toLocaleDateString(),
    timestamp: now.toLocaleTimeString(),
    expected,
    actual,
    variance,
    varianceReason: varianceReason || 'Balanced settlement within threshold',
    status: 'Audited & Submitted'
  };
}

export default function CounterView({
  orders,
  setOrders,
  menu,
  setMenu,
  offers,
  setOffers,
  theme,
  setTheme: _setTheme,
  chef,
  checklists: _checklists,
  setChecklists,
  activeSubTab = 'orders',
  setActiveSubTab,
  canReturnToAdmin = false,
  onReturnToAdmin,
  staff = [],
  setStaff
}) {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'received', 'in-progress', 'ready', 'done'
  const [rejectOrderId, setRejectOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState('Item ingredient out of stock');

  // Hardware & Alert Modals State (Phase 2)
  const [selectedPrintOrder, setSelectedPrintOrder] = useState(null);
  const [selectedWhatsAppOrder, setSelectedWhatsAppOrder] = useState(null);

  // Daily Closing Checklist State (FR-P8 & 5.4)
  const [actualCash, setActualCash] = useState('');
  const [actualCard, setActualCard] = useState('');
  const [actualUpi, setActualUpi] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);

  // Price Edit State (FR-P4)
  const [editingItem, setEditingItem] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  // New Offer State (FR-P5)
  const [newOfferCode, setNewOfferCode] = useState('');
  const [newOfferType, setNewOfferType] = useState('percent');
  const [newOfferValue, setNewOfferValue] = useState('');
  const [newOfferMin, setNewOfferMin] = useState('');
  const [newOfferExpiry, setNewOfferExpiry] = useState('');
  const [newOfferDesc, setNewOfferDesc] = useState('');

  // Suggestables Configuration (FR-P6)
  const [selectedPairingId, setSelectedPairingId] = useState(3);

  // Server Call Alerts Banner
  const [serverAlert, setServerAlert] = useState(null);

  // Active Counter Staff Operator & Permissions
  const activeStaffList = Array.isArray(staff)
    ? staff.filter((emp) => emp.status !== 'resigned')
    : [];

  const [activeStaffId, setActiveStaffId] = useState(() => {
    try {
      const saved = localStorage.getItem('counter_active_staff_id');
      if (saved && activeStaffList.some((s) => s.id === saved)) return saved;
    } catch {}
    return activeStaffList[0]?.id || '';
  });

  // Effective staff member currently operating Counter POS
  const currentStaff = activeStaffList.find((s) => s.id === activeStaffId) || activeStaffList[0];

  const effectivePermissions = {
    canEditPrice: canReturnToAdmin ? true : Boolean(currentStaff?.permissions?.canEditPrice),
    canCreateDiscounts: canReturnToAdmin ? true : Boolean(currentStaff?.permissions?.canCreateDiscounts)
  };

  // Listen for real-time events from customers and owner admin
  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((msg) => {
      if (msg.type === SYNC_EVENTS.CALL_SERVER) {
        setServerAlert(msg.payload);
        playAlertChime();
      } else if (msg.type === SYNC_EVENTS.STAFF_UPDATED) {
        if (Array.isArray(msg.payload) && setStaff) {
          setStaff(msg.payload);
        }
      }
    });
    return unsubscribe;
  }, [setStaff]);

  // Calculate Expected Totals from recorded orders for today
  const expectedCash = orders
    .filter((o) => o.paymentMode.toLowerCase().includes('counter') || o.paymentMode.toLowerCase().includes('cash'))
    .reduce((sum, o) => sum + o.total, 0);

  const expectedCard = orders
    .filter((o) => o.paymentMode.toLowerCase().includes('card'))
    .reduce((sum, o) => sum + o.total, 0);

  const expectedUpi = orders
    .filter((o) => o.paymentMode.toLowerCase().includes('upi'))
    .reduce((sum, o) => sum + o.total, 0);

  const totalExpected = expectedCash + expectedCard + expectedUpi;

  // Differences for checklist (INR)
  const diffCash = actualCash !== '' ? Number(actualCash) - expectedCash : 0;
  const diffCard = actualCard !== '' ? Number(actualCard) - expectedCard : 0;
  const diffUpi = actualUpi !== '' ? Number(actualUpi) - expectedUpi : 0;
  const totalVariance = diffCash + diffCard + diffUpi;
  const hasVarianceAlert = Math.abs(totalVariance) > 200.0; // ₹200 threshold

  // Status Handlers (FR-P2)
  const handleUpdateStatus = (orderId, newStatus, newLabel, progressPercent) => {
    playTapSound();
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const updatedOrder = {
      ...target,
      status: newStatus,
      statusLabel: newLabel,
      progressPercent: progressPercent
    };

    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? updatedOrder : ord))
    );

    // Save directly to localStorage immediately so cross-window and storage listeners fire instantly
    try {
      const currentOrders = JSON.parse(localStorage.getItem('flowscape_orders_v2') || '[]');
      const updatedList = currentOrders.map((ord) => (ord.id === orderId ? updatedOrder : ord));
      localStorage.setItem('flowscape_orders_v2', JSON.stringify(updatedList));
    } catch {
      // ignore
    }

    // Broadcast status change in real time to the customer via BroadcastChannel & sync event ping
    broadcastSyncEvent(SYNC_EVENTS.ORDER_STATUS_UPDATED, updatedOrder);

    if (newStatus === 'done' || newStatus === 'served') {
      playSuccessChime();
    }
  };

  const handleRejectSubmit = () => {
    playTapSound();
    const target = orders.find((o) => o.id === rejectOrderId);
    if (!target) return;

    const rejectedOrder = {
      ...target,
      status: 'rejected',
      statusLabel: `Rejected: ${rejectReason}`,
      progressPercent: 0
    };

    setOrders((prev) =>
      prev.map((ord) => (ord.id === rejectOrderId ? rejectedOrder : ord))
    );

    try {
      const currentOrders = JSON.parse(localStorage.getItem('flowscape_orders_v2') || '[]');
      const updatedList = currentOrders.map((ord) => (ord.id === rejectOrderId ? rejectedOrder : ord));
      localStorage.setItem('flowscape_orders_v2', JSON.stringify(updatedList));
    } catch {
      // ignore
    }

    broadcastSyncEvent(SYNC_EVENTS.ORDER_STATUS_UPDATED, rejectedOrder);
    setRejectOrderId(null);
  };

  // Toggle Item Availability (FR-P4)
  const handleToggleAvailability = (itemId) => {
    playTapSound();
    const updated = menu.map((item) => (item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item));
    setMenu(updated);
    broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated);
  };

  // Save Price Edit (FR-P4)
  const handleSavePrice = () => {
    if (!effectivePermissions.canEditPrice) {
      playAlertChime();
      alert(`Access Restricted: Staff member "${currentStaff?.name || 'Operator'}" does not have permission to edit dish prices. The owner can grant this in Staff & Payroll.`);
      return;
    }
    playTapSound();
    const priceNum = parseFloat(newPrice);
    if (!isNaN(priceNum) && priceNum > 0 && editingItem) {
      const updated = menu.map((item) => (item.id === editingItem.id ? { ...item, price: priceNum } : item));
      setMenu(updated);
      broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated);
      setEditingItem(null);
      playSuccessChime();
    }
  };

  // Create Offer (FR-P5)
  const handleCreateOffer = (e) => {
    e.preventDefault();
    if (!effectivePermissions.canCreateDiscounts) {
      playAlertChime();
      alert(`Access Restricted: Staff member "${currentStaff?.name || 'Operator'}" does not have permission to issue promotional offers. The owner can grant this in Staff & Payroll.`);
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
    saveData(STORAGE_KEYS.OFFERS, updated);
    broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated);
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
      alert(`Access Restricted: Staff member "${currentStaff?.name || 'Operator'}" does not have permission to modify promotional offers.`);
      return;
    }
    playTapSound();
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      const updated = offers.filter((o) => o.id !== offerId);
      setOffers(updated);
      saveData(STORAGE_KEYS.OFFERS, updated);
      broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated);
      playAlertChime();
    }
  };

  // Submit Daily Closing Checklist (FR-P8 & 5.4)
  const handleSubmitClosingChecklist = (e) => {
    e.preventDefault();
    playTapSound();

    if (hasVarianceAlert && !varianceReason.trim()) {
      playAlertChime();
      alert('Variance exceeds ₹200 threshold. Please provide an audit explanation note.');
      return;
    }

    const report = createClosingChecklistReport({
      expected: { cash: expectedCash, card: expectedCard, upi: expectedUpi, total: totalExpected },
      actual: {
        cash: Number(actualCash || 0),
        card: Number(actualCard || 0),
        upi: Number(actualUpi || 0),
        total: Number(actualCash || 0) + Number(actualCard || 0) + Number(actualUpi || 0)
      },
      variance: totalVariance,
      varianceReason
    });

    setChecklists((prev) => [report, ...prev]);
    broadcastSyncEvent(SYNC_EVENTS.CHECKLIST_SUBMITTED, report);
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
        <div className="screen-title">Counter Order Queue</div>
        <div className="screen-subtitle">Live Kitchen Stack, POS Punching & EOD Cash Checklist</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <User size={15} color="#007AFF" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>
            Terminal Operator:
          </span>
          {canReturnToAdmin ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#7C3AED',
                background: '#F5F3FF',
                padding: '2px 8px',
                borderRadius: 8,
                border: '1px solid #DDD6FE'
              }}
            >
              Owner Admin (Full Permissions)
            </span>
          ) : activeStaffList.length > 0 ? (
            <select
              className="ios-select"
              value={activeStaffId || activeStaffList[0]?.id}
              onChange={(e) => {
                setActiveStaffId(e.target.value);
                try {
                  localStorage.setItem('counter_active_staff_id', e.target.value);
                } catch {}
                playTapSound();
              }}
              style={{ padding: '3px 8px', fontSize: 11.5, fontWeight: 600, minWidth: 150 }}
            >
              {activeStaffList.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 11.5, color: '#64748B' }}>Default Floor Staff</span>
          )}
        </div>

        {/* Live Permissions Indicator Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              padding: '2px 8px',
              borderRadius: 8,
              fontWeight: 600,
              background: effectivePermissions.canEditPrice ? '#DCFCE7' : '#F1F5F9',
              color: effectivePermissions.canEditPrice ? '#15803D' : '#94A3B8',
              border: `1px solid ${effectivePermissions.canEditPrice ? '#BBF7D0' : '#E2E8F0'}`
            }}
            title={effectivePermissions.canEditPrice ? "Price editing permitted by owner" : "Price editing locked by owner"}
          >
            {effectivePermissions.canEditPrice ? '✓ Price Edit Allowed' : '🔒 Price Edit Locked'}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10.5,
              padding: '2px 8px',
              borderRadius: 8,
              fontWeight: 600,
              background: effectivePermissions.canCreateDiscounts ? '#DCFCE7' : '#F1F5F9',
              color: effectivePermissions.canCreateDiscounts ? '#15803D' : '#94A3B8',
              border: `1px solid ${effectivePermissions.canCreateDiscounts ? '#BBF7D0' : '#E2E8F0'}`
            }}
            title={effectivePermissions.canCreateDiscounts ? "Offers creation permitted by owner" : "Offers creation locked by owner"}
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
          + Punch Walk-in
        </button>

        <button
          className={`capsule-tab ${activeSubTab === 'stock' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('stock');
          }}
        >
          Menu & Rates
        </button>

        <button
          className={`capsule-tab ${activeSubTab === 'checklist' ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setActiveSubTab('checklist');
          }}
        >
          Closing EOD
        </button>
      </div>

      {/* VIEW 1: LIVE ORDERS STACK */}
      {activeSubTab === 'orders' && (
        <div>
          {/* Status Quick Filter Bar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {['all', 'received', 'cooking', 'ready', 'served'].map((st) => (
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
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#10B981', color: '#FFFFFF', fontWeight: 600 }}>Active</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {orders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected').length} Live Kitchen Prep Tickets • 80mm GST Thermal Receipt Ready
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="card-heading">{order.id}</span>
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
                <span className="card-heading">Suggestables & Upsell Pairing (FR-P6)</span>
                <span className="card-meta-text">Configure add-on featured pairing on customer menus</span>
              </div>
              <Sparkles size={18} color="#007AFF" />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                Featured Pairing Dish:
              </label>
              <select
                className="ios-select"
                value={selectedPairingId}
                onChange={(e) => setSelectedPairingId(Number(e.target.value))}
              >
                {menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (₹{m.price})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
              ✓ Selected item will be presented to all table diners as a recommended pairing!
            </div>
          </div>

          {/* Stock & Price Control */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Menu Stock & Price Control</span>
                <span className="card-meta-text">Toggle sold-out items instantly & adjust table prices</span>
              </div>
              <SlidersHorizontal size={18} color="#007AFF" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menu.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: 14
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary-blue)', fontWeight: 600 }}>
                      ₹{item.price.toFixed(0)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn-secondary-pill"
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        opacity: effectivePermissions.canEditPrice ? 1 : 0.6,
                        cursor: effectivePermissions.canEditPrice ? 'pointer' : 'not-allowed',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      onClick={() => {
                        if (!effectivePermissions.canEditPrice) {
                          playAlertChime();
                          alert(`Access Restricted: Staff member "${currentStaff?.name || 'Operator'}" is not authorized by the owner to edit item prices.`);
                          return;
                        }
                        setEditingItem(item);
                        setNewPrice(item.price.toString());
                      }}
                      title={effectivePermissions.canEditPrice ? "Edit Item Price" : "Price editing locked by Owner"}
                    >
                      {!effectivePermissions.canEditPrice && <Lock size={10} color="#94A3B8" />}
                      <span>Edit ₹</span>
                    </button>

                    <button
                      className="btn-secondary-pill"
                      style={{
                        padding: '6px 10px',
                        fontSize: 11,
                        background: item.isAvailable ? '#DCFCE7' : '#FEE2E2',
                        color: item.isAvailable ? '#16A34A' : '#DC2626'
                      }}
                      onClick={() => handleToggleAvailability(item.id)}
                    >
                      {item.isAvailable ? 'In Stock' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                  Offers &amp; Discounts Creation Locked for <strong>{currentStaff?.name || 'Current Staff'}</strong>. The restaurant owner can grant "Can Issue Offers" in the Owner Admin Staff &amp; Payroll section.
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
                    placeholder="e.g. ADVAIT20"
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
                <span>{effectivePermissions.canCreateDiscounts ? 'Publish New Offer' : 'Offer Creation Locked by Owner'}</span>
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
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: 6
                        }}
                        title="Delete coupon"
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
            <form onSubmit={handleSubmitClosingChecklist}>
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
                    placeholder="Reason (e.g. Table 4 cash tip rounded down, bank UPI delayed sync)"
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn-primary-pill full-width">
                <CheckCircle2 size={16} />
                <span>Submit Closing Report & Save to Owner P&L</span>
              </button>
            </form>

            {checklistSubmitted && (
              <div
                style={{
                  marginTop: 14,
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  padding: 12,
                  borderRadius: 14,
                  color: '#16A34A',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Check size={16} strokeWidth={3} />
                <span>Daily Sales Closing Report successfully recorded for Owner!</span>
              </div>
            )}
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
              style={{ marginBottom: 16 }}
            >
              <option value="Item ingredient out of stock">Item ingredient out of stock</option>
              <option value="Kitchen rush / temporarily paused">Kitchen rush / temporarily paused</option>
              <option value="Closing hours reached">Closing hours reached</option>
              <option value="Custom note cannot be accommodated">Custom note cannot be accommodated</option>
            </select>

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

      {/* Price Edit Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />
            <div className="card-heading" style={{ marginBottom: 4 }}>
              Edit Price: {editingItem.name}
            </div>
            <div className="card-meta-text" style={{ marginBottom: 14 }}>
              Current Price: ₹{editingItem.price.toFixed(0)}
            </div>

            <input
              type="number"
              step="5"
              className="ios-input"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              style={{ marginBottom: 16 }}
              autoFocus
            />

            <button className="btn-primary-pill full-width" onClick={handleSavePrice}>
              Save Updated Price (₹)
            </button>
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
          theme={theme}
          chef={chef}
          onClose={() => setSelectedWhatsAppOrder(null)}
        />
      )}
    </div>
  );
}
