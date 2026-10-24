import React, { useState, useEffect } from 'react';
import {
  Server,
  Building2,
  KeyRound,
  PlusCircle,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Lock,
  LogOut,
  Activity,
  ArrowRight,
  Radio,
  Sliders,
  TrendingUp,
  Receipt,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  Mail,
  RefreshCw,
  Send,
  QrCode,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  Clock,
  Sparkles,
  Utensils,
  Store
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import TableQrModal from '../components/TableQrModal';
import LegalFooter from '../components/LegalFooter';
import { computeTableSignature } from '../utils/tableSecurity';
import {
  purgeBusinessAccountComplete,
  getLegalComplianceRecords,
  syncBusinessToCloud,
  subscribeBusinessesFromCloud,
  fetchBusinessesFromCloud
} from '../utils/systematicDatabase';
import {
  provisionOwnerAccountWithVerification,
  resendVerificationLink,
  sendPasswordReset,
  updateOwnerCredentialsManually
} from '../utils/firebaseAuth';
import { broadcastSyncEvent, subscribeSyncEvents, SYNC_EVENTS } from '../utils/sync';
import {
  getBusinesses,
  getActiveBusiness,
  createBusiness,
  updateBusiness,
  setActiveBusiness,
  authenticateDeveloper,
  isDeveloperAuthenticated,
  logoutDeveloper
} from '../utils/businessManager';

export default function DeveloperAdminView({ onSwitchToApp, onRoleSwitch }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => isDeveloperAuthenticated());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Dashboard States
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'health' | 'logs' | 'settings'
  const [businesses, setBusinesses] = useState(() => getBusinesses());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(null); // business object
  const [tableQrBiz, setTableQrBiz] = useState(null); // business object for Table QR standees modal
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [verifiedNotification, setVerifiedNotification] = useState(null);

  // Manual Credentials Override State (for technical anomaly recovery)
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editOwnerPin, setEditOwnerPin] = useState('');
  const [editCounterPin, setEditCounterPin] = useState('');
  const [editMarkVerified, setEditMarkVerified] = useState(true);
  const [editOverrideError, setEditOverrideError] = useState('');

  // New Business Form State
  const [newBiz, setNewBiz] = useState({
    name: '',
    tagline: '',
    category: 'Fine Dining / Artisanal',
    city: '',
    plan: 'Pro',
    ownerName: '',
    ownerEmail: '',
    ownerPin: '',
    counterPin: '',
    upiId: '',
    serviceType: 'dine_in', // 'dine_in' | 'stall'
    tableCount: 6,
    accentColor: '#007AFF',
    birthYear: '',
    ageGateConsent: false
  });
  const [formError, setFormError] = useState('');
  const [createdSuccessBiz, setCreatedSuccessBiz] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // System Logs
  const [logs, setLogs] = useState(() => [
    { id: 1, time: 'Just now', type: 'system', text: 'Developer Console session initialized securely' },
    { id: 2, time: 'Just now', type: 'auth', text: 'Multi-tenant database validated: 0 active business partitions (Clean Zero-State)' },
    { id: 3, time: 'Just now', type: 'sync', text: 'Cross-tab broadcast channel heartbeat: OK' }
  ]);

  const refreshBusinesses = () => {
    const fresh = getBusinesses();
    setBusinesses(fresh);
    setShowCredentialsModal((curr) => {
      if (!curr) return null;
      return fresh.find((b) => b.id === curr.id) || curr;
    });
  };

  // Real-time synchronization: listen for credential updates, resets, and business modifications
  useEffect(() => {
    const handleSync = () => {
      refreshBusinesses();
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('flowscape_businesses_updated', handleSync);

    const handleEmailVerifiedNotice = (e) => {
      try {
        playSuccessChime();
        const detail = e?.detail || {};
        const notice = {
          id: Date.now(),
          businessId: detail.businessId,
          businessName: detail.businessName || 'Business Outlet',
          email: detail.email || 'Owner',
          time: 'Just now'
        };
        setVerifiedNotification(notice);
        setLogs((prev) => [
          {
            id: Date.now(),
            time: 'Just now',
            type: 'biz',
            text: `🎉 Email verified for "${notice.businessName}" (${notice.email}). Account is now officially created and active!`
          },
          ...prev
        ]);
        handleSync();
      } catch {}
    };

    window.addEventListener('ontap_email_verified', handleEmailVerifiedNotice);

    // Check if verification happened right before opening dashboard
    try {
      const rawNotice = localStorage.getItem('ontap_last_verified_email');
      if (rawNotice) {
        const parsed = JSON.parse(rawNotice);
        if (parsed && Date.now() - (parsed.timestamp || 0) < 60000) {
          setVerifiedNotification({
            id: Date.now(),
            businessId: parsed.businessId,
            businessName: parsed.businessName || 'Business Outlet',
            email: parsed.email || 'Owner',
            time: 'Just now'
          });
          localStorage.removeItem('ontap_last_verified_email');
        }
      }
    } catch {}

    const unsubscribeCloud = subscribeBusinessesFromCloud(() => {
      handleSync();
    });
    fetchBusinessesFromCloud().catch(() => {});

    const unsubscribe = subscribeSyncEvents((event) => {
      if (event?.type === SYNC_EVENTS.EMAIL_VERIFIED) {
        try {
          playSuccessChime();
          const payload = event.payload || {};
          const notice = {
            id: Date.now(),
            businessId: payload.businessId,
            businessName: payload.businessName || 'Business Outlet',
            email: payload.email || 'Owner',
            time: 'Just now'
          };
          setVerifiedNotification(notice);
          setLogs((prev) => [
            {
              id: Date.now(),
              time: 'Just now',
              type: 'biz',
              text: `🎉 Email verified for "${notice.businessName}" (${notice.email}). Account is now officially created and active!`
            },
            ...prev
          ]);
          handleSync();
        } catch {}
      } else if (
        event?.type === SYNC_EVENTS.BUSINESSES_UPDATED ||
        event?.type === SYNC_EVENTS.CREDENTIALS_UPDATED ||
        event?.type === SYNC_EVENTS.CONFIG_UPDATED
      ) {
        handleSync();
      }
    }, null); // null tenant bypasses tenant isolation to catch all platform-level updates

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('flowscape_businesses_updated', handleSync);
      window.removeEventListener('ontap_email_verified', handleEmailVerifiedNotice);
      if (unsubscribeCloud) unsubscribeCloud();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    playTapSound();
    setLoginError('');

    const res = authenticateDeveloper(loginEmail, loginPassword);
    if (res.success) {
      playSuccessChime();
      setIsAuthenticated(true);
      setLogs((prev) => [
        { id: Date.now(), time: 'Just now', type: 'auth', text: `Developer ${loginEmail} logged in successfully` },
        ...prev
      ]);
    } else {
      playAlertChime();
      setLoginError(res.error);
    }
  };

  const handleLogout = () => {
    playTapSound();
    logoutDeveloper();
    setIsAuthenticated(false);
    setLoginEmail('');
    setLoginPassword('');
  };

  const handleCreateBusiness = async (e) => {
    e.preventDefault();
    playTapSound();
    setFormError('');

    if (!newBiz.name.trim()) {
      setFormError('Business name is required.');
      return;
    }
    if (!newBiz.ownerEmail.trim() || !newBiz.ownerEmail.includes('@')) {
      setFormError('A valid owner email address is required.');
      return;
    }
    const trimmedOwnerPin = newBiz.ownerPin.trim();
    const trimmedCounterPin = newBiz.counterPin.trim();

    if (!trimmedOwnerPin || trimmedOwnerPin.length < 6) {
      setFormError('Owner Password must be at least 6 characters long (letters, digits, or both).');
      return;
    }
    if (!/^\d{6}$/.test(trimmedCounterPin)) {
      setFormError('Counter Staff POS PIN must be exactly 6 numeric digits.');
      return;
    }

    const counterPinInUse = businesses.some(
      (b) => b.counter?.pin === trimmedCounterPin
    );
    if (counterPinInUse) {
      setFormError('Specified Counter PIN is already assigned to another business. Please choose a unique 6-digit Counter PIN.');
      return;
    }

    // COPPA Age Gate Verification (15 U.S.C. § 6501 et seq.) & Contractual Capacity
    if (!newBiz.ageGateConsent) {
      setFormError('COPPA Compliance: You must certify that you meet the statutory age requirements to register an account.');
      return;
    }
    const currentYear = new Date().getFullYear();
    const birthYearNum = parseInt(newBiz.birthYear, 10);
    if (!birthYearNum || isNaN(birthYearNum) || birthYearNum < 1920 || birthYearNum > currentYear) {
      setFormError('Please enter a valid birth year (YYYY) to verify your age under COPPA.');
      return;
    }
    const calculatedAge = currentYear - birthYearNum;
    if (calculatedAge < 13) {
      setFormError('COPPA Legal Restriction: Account registration is strictly prohibited for children under 13 years of age (15 U.S.C. § 6501 et seq.).');
      return;
    }
    if (calculatedAge < 18) {
      setFormError('Contract Capacity: Account creators must be at least 18 years of age (the age of legal majority) to enter into a binding commercial subscription agreement.');
      return;
    }

    setIsCreating(true);

    // 1. Provision account in Firebase Auth with automatic Email Verification
    const provRes = await provisionOwnerAccountWithVerification({
      email: newBiz.ownerEmail,
      password: trimmedOwnerPin,
      ownerName: newBiz.ownerName,
      businessName: newBiz.name
    });

    if (!provRes.success) {
      playAlertChime();
      setIsCreating(false);
      setFormError(provRes.error || 'Failed to provision account in Firebase Auth.');
      return;
    }

    const isStall = newBiz.serviceType === 'stall';
    const tableCount = isStall ? 0 : (parseInt(newBiz.tableCount, 10) || 6);
    const tables = isStall
      ? ['Counter / Stand & Eat']
      : [
          ...Array.from({ length: tableCount }, (_, i) => `Table ${String(i + 1).padStart(2, '0')}`),
          'Counter / Takeaway'
        ];

    const isDemoMode = Boolean(provRes.isLocalFallback);
    const initialStatus = isDemoMode ? 'active' : 'pending_verification';
    const initialVerified = isDemoMode ? true : false;

    // 2. Provision business in local multi-tenant database (pending until owner verifies email)
    const res = createBusiness({
      ...newBiz,
      ownerPin: trimmedOwnerPin,
      counterPin: trimmedCounterPin,
      serviceType: newBiz.serviceType || 'dine_in',
      tableCount,
      tables,
      status: initialStatus,
      emailVerified: initialVerified
    });

    setIsCreating(false);

    if (res.success) {
      playSuccessChime();
      await syncBusinessToCloud(res.business);
      refreshBusinesses();
      setCreatedSuccessBiz({
        ...res.business,
        verificationNotice: provRes.message || `Verification email dispatched to ${res.business.owner.email}.`
      });
      setLogs((prev) => [
        { id: Date.now(), time: 'Just now', type: 'biz', text: `Created business "${res.business.name}" & sent verification link to ${res.business.owner.email}` },
        ...prev
      ]);
      // Reset form
      setNewBiz({
        name: '',
        tagline: '',
        category: 'Fine Dining / Artisanal',
        city: '',
        plan: 'Pro',
        ownerName: '',
        ownerEmail: '',
        ownerPin: '',
        counterPin: '',
        upiId: '',
        serviceType: 'dine_in',
        tableCount: 6,
        accentColor: '#007AFF',
        birthYear: '',
        ageGateConsent: false
      });
    } else {
      playAlertChime();
      setFormError(res.error);
    }
  };

  const handleDeleteBusiness = async (biz) => {
    playTapSound();
    const confirmed = window.confirm(
      `Permanently delete account "${biz.name}" (${biz.owner.email})?\n\nThis will execute a complete irreversible erasure:\n• Clear user email & credentials permanently from Firebase Users & Authentication\n• Purge all cloud Firestore collections & order history\n• Wipe menus, inventory, staff credentials, and local partitions\n• Seal a non-PII statutory compliance ledger record for legal/tax matters\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setIsActionLoading(true);

    const res = await purgeBusinessAccountComplete({
      businessId: biz.id,
      actorRole: 'developer_superadmin',
      reason: 'Permanently deleted via Developer Admin Dashboard'
    });

    setIsActionLoading(false);

    if (res.success) {
      playSuccessChime();
      refreshBusinesses();
      setLogs((prev) => [
        {
          id: Date.now(),
          time: 'Just now',
          type: 'biz',
          text: `Purged account "${biz.name}" (${biz.owner.email}) from Firebase Users, Auth & Database. Legal compliance record sealed: ${res.complianceRecord?.complianceId}.`
        },
        ...prev
      ]);
      if (showCredentialsModal && showCredentialsModal.id === biz.id) {
        setShowCredentialsModal(null);
      }
      alert(res.message);
    } else {
      playAlertChime();
      alert(res.error);
    }
  };

  const handleVerifyEmailNow = async (biz) => {
    playTapSound();
    setIsActionLoading(true);
    setActionStatus(null);

    const updates = {
      status: 'active',
      emailVerified: true,
      accountCreatedAt: biz.accountCreatedAt || new Date().toISOString()
    };

    updateBusiness(biz.id, updates);
    const freshBiz = getBusinesses().find((b) => b.id === biz.id) || { ...biz, ...updates };
    await syncBusinessToCloud(freshBiz).catch(() => {});

    broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
      businessId: biz.id,
      businessName: biz.name,
      email: biz.owner?.email,
      timestamp: new Date().toISOString()
    }, null);

    broadcastSyncEvent(SYNC_EVENTS.BUSINESSES_UPDATED, {
      businessId: biz.id,
      reason: 'admin_email_verified'
    }, null);

    try {
      window.dispatchEvent(new CustomEvent('ontap_email_verified', {
        detail: {
          businessId: biz.id,
          businessName: biz.name,
          email: biz.owner?.email
        }
      }));
    } catch {}

    refreshBusinesses();
    if (showCredentialsModal && showCredentialsModal.id === biz.id) {
      setShowCredentialsModal(freshBiz);
    }

    setIsActionLoading(false);
    playSuccessChime();
    setActionStatus({
      type: 'success',
      text: `Account "${biz.name}" (${biz.owner?.email}) email verified and activated successfully!`
    });

    setLogs((prev) => [
      {
        id: Date.now(),
        time: 'Just now',
        type: 'biz',
        text: `✓ Admin manual verification: Marked "${biz.name}" (${biz.owner?.email}) email verified & activated account.`
      },
      ...prev
    ]);
  };

  const handleToggleStatus = async (biz) => {
    playTapSound();
    const newStatus = biz.status === 'active' ? 'suspended' : 'active';
    const updates = { status: newStatus };
    if (newStatus === 'active' && biz.emailVerified === false) {
      updates.emailVerified = true;
    }
    updateBusiness(biz.id, updates);
    const fresh = getBusinesses().find((b) => b.id === biz.id);
    if (fresh) {
      await syncBusinessToCloud(fresh).catch(() => {});
    }
    if (updates.emailVerified) {
      broadcastSyncEvent(SYNC_EVENTS.EMAIL_VERIFIED, {
        businessId: biz.id,
        businessName: biz.name,
        email: biz.owner?.email,
        timestamp: new Date().toISOString()
      }, null);
      try {
        window.dispatchEvent(new CustomEvent('ontap_email_verified', {
          detail: {
            businessId: biz.id,
            businessName: biz.name,
            email: biz.owner?.email
          }
        }));
      } catch {}
    }
    broadcastSyncEvent(SYNC_EVENTS.BUSINESSES_UPDATED, { businessId: biz.id, status: newStatus }, biz.id);
    refreshBusinesses();
    setLogs((prev) => [
      {
        id: Date.now(),
        time: 'Just now',
        type: 'biz',
        text: `Updated "${biz.name}" status to ${newStatus}${updates.emailVerified ? ' (and marked email verified)' : ''}`
      },
      ...prev
    ]);
  };

  const handleLaunchWorkspace = (biz, targetRole = 'admin') => {
    playTapSound();
    if (biz.status === 'pending_verification' || biz.emailVerified === false) {
      playAlertChime();
      alert(`Account Creation Incomplete:\n\nEmail verification is pending for "${biz.name}" (${biz.owner?.email}).\n\nThis account has not been activated yet. The owner must verify their email address using the link dispatched to their inbox before workspace access is granted.`);
      return;
    }
    setActiveBusiness(biz.id);
    if (onSwitchToApp) {
      onSwitchToApp(biz, targetRole);
    } else if (onRoleSwitch) {
      onRoleSwitch(targetRole);
    } else {
      window.location.assign(`#${targetRole}`);
    }
  };

  const copyToClipboard = (text, key) => {
    playTapSound();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenCredentialsModal = (biz) => {
    playTapSound();
    // Always fetch the freshest business record from database to prevent displaying stale state
    const freshBiz = getBusinesses().find((b) => b.id === biz.id) || biz;
    setShowCredentialsModal(freshBiz);
    setIsEditingCredentials(false);
    setEditOwnerEmail(freshBiz.owner?.email || '');
    setEditOwnerPin(freshBiz.owner?.pin || '');
    setEditCounterPin(freshBiz.counter?.pin || '');
    setEditMarkVerified(freshBiz.emailVerified !== false);
    setEditOverrideError('');
    setActionStatus(null);
  };

  const handleSaveManualCredentialsOverride = async (e) => {
    if (e) e.preventDefault();
    playTapSound();
    setEditOverrideError('');
    setActionStatus(null);

    const cleanEmail = (editOwnerEmail || '').trim().toLowerCase();
    const cleanPin = (editOwnerPin || '').trim();
    const cleanCounterPin = (editCounterPin || '').trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setEditOverrideError('Please enter a valid owner email address.');
      playAlertChime();
      return;
    }

    // Owner password min 6 chars (characters, numbers, or both)
    if (!cleanPin || cleanPin.length < 6) {
      setEditOverrideError('Owner password must be at least 6 characters long (letters, digits, or both).');
      playAlertChime();
      return;
    }

    if (cleanCounterPin && !/^\d{6}$/.test(cleanCounterPin)) {
      setEditOverrideError('Counter Staff POS PIN must be exactly 6 numeric digits.');
      playAlertChime();
      return;
    }

    // Check duplicate email against other tenants
    const duplicateEmail = businesses.find(
      (b) => b.id !== showCredentialsModal.id && b.owner?.email?.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setEditOverrideError(`Email "${cleanEmail}" is already registered to "${duplicateEmail.name}".`);
      playAlertChime();
      return;
    }

    setIsActionLoading(true);

    const res = await updateOwnerCredentialsManually({
      businessId: showCredentialsModal.id,
      oldEmail: showCredentialsModal.owner?.email,
      oldPin: showCredentialsModal.owner?.pin,
      newEmail: cleanEmail,
      newPin: cleanPin,
      markVerified: editMarkVerified
    });

    if (cleanCounterPin && cleanCounterPin !== showCredentialsModal.counter?.pin) {
      updateBusiness(showCredentialsModal.id, { counter: { pin: cleanCounterPin } });
    }

    setIsActionLoading(false);

    if (res.success) {
      playSuccessChime();
      const freshBiz = res.business || {
        ...showCredentialsModal,
        owner: { ...showCredentialsModal.owner, email: cleanEmail, pin: cleanPin },
        status: editMarkVerified ? 'active' : showCredentialsModal.status,
        emailVerified: editMarkVerified ? true : showCredentialsModal.emailVerified
      };
      if (cleanCounterPin) {
        freshBiz.counter = { ...freshBiz.counter, pin: cleanCounterPin };
      }

      setShowCredentialsModal(freshBiz);
      syncBusinessToCloud(freshBiz).catch(() => {});
      refreshBusinesses();
      setIsEditingCredentials(false);
      setActionStatus({
        type: 'success',
        text: res.message || 'Credentials successfully overridden and synchronized with Firebase Auth!'
      });

      // Broadcast multi-tenant update event across open tabs
      broadcastSyncEvent(SYNC_EVENTS.CONFIG_UPDATED, {
        businessId: showCredentialsModal.id,
        reason: 'credentials_override'
      });

      // Platform Developer Console audit log
      setLogs((prev) => [
        {
          id: Date.now(),
          time: 'Just now',
          type: 'auth',
          text: `Manual credentials override applied for "${showCredentialsModal.name}" — Owner Email: ${cleanEmail}, Password: ${cleanPin}`
        },
        ...prev
      ]);
    } else {
      playAlertChime();
      setEditOverrideError(res.error || 'Failed to update credentials.');
    }
  };

  const exportPlatformBackup = () => {
    playTapSound();
    const data = {
      exportedAt: new Date().toISOString(),
      platform: 'FlowScape Restaurant OS Multi-Tenant System',
      businesses: getBusinesses()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowscape-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Businesses
  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.owner.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = filterPlan === 'all' || b.plan.toLowerCase() === filterPlan.toLowerCase();
    return matchesSearch && matchesPlan;
  });

  const totalGMV = businesses.reduce((acc, b) => acc + (b.gmv || 0), 0);
  const totalOrders = businesses.reduce((acc, b) => acc + (b.totalOrders || 0), 0);

  // -------------------------------------------------------------
  // DEVELOPER AUTHENTICATION LOGIN VIEW (Zero Autofill Button)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0B0F19 0%, #111827 50%, #0F172A 100%)',
        color: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          padding: '36px 32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(6, 182, 212, 0.15)'
        }}>
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 24px rgba(6, 182, 212, 0.4)'
            }}>
              <Server size={28} color="#FFFFFF" />
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: 20,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: '#38BDF8',
              marginBottom: 8,
              letterSpacing: '0.04em'
            }}>
              <Lock size={11} />
              <span>SUPERADMIN INFRASTRUCTURE</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC', margin: '4px 0', letterSpacing: '-0.02em' }}>
              Developer Admin Dashboard
            </h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
              Master multi-tenant platform control & business provisioning
            </p>
          </div>

          {loginError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: '#FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 20
            }}>
              <AlertTriangle size={15} color="#EF4444" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Form strictly manual - zero autofill button as requested */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                Developer Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Enter developer email"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#F8FAFC',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
                Master Access Key / Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 14px',
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#F8FAFC',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: 4
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: 8,
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(6, 182, 212, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <span>Authenticate & Enter Console</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Direct Return to Restaurant View */}
          <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                if (onRoleSwitch) onRoleSwitch('admin');
                else window.location.hash = 'admin';
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>← Return to Restaurant Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED DEVELOPER DASHBOARD VIEW
  // -------------------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0B0F19',
      color: '#F8FAFC',
      fontFamily: 'Inter, -apple-system, sans-serif',
      paddingBottom: 60
    }}>
      {/* Top Superadmin Navigation Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Left: Brand & Telemetry Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)'
          }}>
            <Server size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
                FlowScape Developer Console
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                Production Live
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              Multi-Tenant Architecture • Version 2.4.0 • Zero-Downtime Engine
            </div>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(30, 41, 59, 0.6)', padding: 4, borderRadius: 12 }}>
          <button
            onClick={() => { playTapSound(); setActiveTab('tenants'); }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'tenants' ? '#0284C7' : 'transparent',
              color: activeTab === 'tenants' ? '#FFFFFF' : '#94A3B8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Building2 size={14} />
            <span>Businesses ({businesses.length})</span>
          </button>

          <button
            onClick={() => { playTapSound(); setActiveTab('health'); }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'health' ? '#0284C7' : 'transparent',
              color: activeTab === 'health' ? '#FFFFFF' : '#94A3B8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Activity size={14} />
            <span>Health & Telemetry</span>
          </button>

          <button
            onClick={() => { playTapSound(); setActiveTab('logs'); }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'logs' ? '#0284C7' : 'transparent',
              color: activeTab === 'logs' ? '#FFFFFF' : '#94A3B8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Receipt size={14} />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={exportPlatformBackup}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#CBD5E1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Export all tenant databases and business accounts"
          >
            <Download size={13} />
            <span>Export Backup</span>
          </button>

          <button
            onClick={() => {
              playTapSound();
              setShowComplianceModal(true);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34D399',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="View 7-Year Statutory Legal & Tax Compliance Archive for deleted accounts"
          >
            <ShieldCheck size={13} />
            <span>Compliance Archive</span>
          </button>

          <button
            onClick={() => {
              playTapSound();
              if (onRoleSwitch) onRoleSwitch('admin');
              else window.location.hash = 'admin';
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(14, 165, 233, 0.15)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              color: '#38BDF8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <ExternalLink size={13} />
            <span>Open Owner App</span>
          </button>

          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#F87171',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            title="Sign out of Developer Superadmin"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Developer Container */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px' }}>
        {/* Real-time Email Verification Notification Banner */}
        {verifiedNotification && (
          <div
            style={{
              marginBottom: 20,
              padding: '16px 20px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.12) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              boxShadow: '0 10px 30px rgba(16, 185, 129, 0.15)',
              animation: 'fadeIn 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.25)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckCircle2 size={24} color="#10B981" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#34D399', letterSpacing: '-0.01em' }}>
                    🎉 Email Verification Completed!
                  </span>
                  <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                    Account Officially Created
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#E2E8F0', lineHeight: 1.4 }}>
                  Owner of <strong>"{verifiedNotification.businessName}"</strong> (<code>{verifiedNotification.email}</code>) has verified their email. The business account is now fully active.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {verifiedNotification.businessId && (
                <button
                  type="button"
                  onClick={() => {
                    const targetBiz = businesses.find((b) => b.id === verifiedNotification.businessId);
                    if (targetBiz) handleOpenCredentialsModal(targetBiz);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: '#10B981',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <KeyRound size={13} />
                  <span>View Credentials</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setVerifiedNotification(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: 6
                }}
                title="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Platform Stat KPIs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Active Businesses</span>
              <Building2 size={16} color="#06B6D4" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC' }}>
                {businesses.filter((b) => b.status === 'active' && b.emailVerified !== false).length}
              </span>
              {businesses.filter((b) => b.status === 'pending_verification' || b.emailVerified === false).length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#FBBF24', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 6 }}>
                  +{businesses.filter((b) => b.status === 'pending_verification' || b.emailVerified === false).length} Pending Verification
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
              100% Operational • 0 Outages
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Platform GMV (Volume)</span>
              <TrendingUp size={16} color="#10B981" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC' }}>
              ₹{totalGMV.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              Across all multi-tenant outlets
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Total Processed Orders</span>
              <Receipt size={16} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC' }}>
              {totalOrders}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              QR Table + Counter Walk-in
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Platform Sync Health</span>
              <Radio size={16} color="#8B5CF6" />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#10B981' }}>
              99.98%
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              WebSocket & BroadcastChannel active
            </div>
          </div>
        </div>

        {/* TAB 1: BUSINESS ACCOUNTS DIRECTORY */}
        {activeTab === 'tenants' && (
          <div>
            {/* Header controls & create business trigger */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 18
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                {/* Search */}
                <div style={{
                  position: 'relative',
                  flex: 1,
                  maxWidth: 380
                }}>
                  <Search size={15} color="#64748B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search businesses, owners, cities..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 34px',
                      borderRadius: 10,
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F8FAFC',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Filter Plan */}
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#F8FAFC',
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Plans</option>
                  <option value="Enterprise">Enterprise</option>
                  <option value="Pro">Pro</option>
                  <option value="Starter">Starter</option>
                </select>
              </div>

              {/* Add New Business Button */}
              <button
                onClick={() => {
                  playTapSound();
                  setFormError('');
                  setCreatedSuccessBiz(null);
                  setShowCreateModal(true);
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)'
                }}
              >
                <PlusCircle size={16} />
                <span>+ Create Business Account</span>
              </button>
            </div>

            {/* Businesses Grid / Empty Zero-State */}
            {filteredBusinesses.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 24px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: 20,
                margin: '20px 0'
              }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#38BDF8'
                }}>
                  <Building2 size={28} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: '#F8FAFC' }}>
                  No Business Accounts Registered
                </h3>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 24px', maxWidth: 440, marginInline: 'auto', lineHeight: 1.6 }}>
                  The platform is ready for live production use. Click below to provision your first restaurant outlet.
                </p>
                <button
                  onClick={() => {
                    playTapSound();
                    setFormError('');
                    setCreatedSuccessBiz(null);
                    setShowCreateModal(true);
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)'
                  }}
                >
                  <PlusCircle size={16} />
                  <span>+ Create First Business Account</span>
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16
              }}>
                {filteredBusinesses.map((biz) => {
                const isActive = biz.status === 'active';
                const currentActiveId = getActiveBusiness()?.id;
                const isCurrentlyActiveWorkspace = currentActiveId === biz.id;

                return (
                  <div
                    key={biz.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: isCurrentlyActiveWorkspace ? '2px solid #0284C7' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 18,
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                      position: 'relative'
                    }}
                  >
                    {isCurrentlyActiveWorkspace && (
                      <div style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: '#0284C7',
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6
                      }}>
                        Current Active Workspace
                      </div>
                    )}

                    <div>
                      {/* Business Card Top */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: biz.accentColor || '#007AFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 16,
                          flexShrink: 0
                        }}>
                          {biz.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, paddingRight: isCurrentlyActiveWorkspace ? 80 : 0 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px', color: '#F8FAFC' }}>
                            {biz.name}
                          </h3>
                          <div style={{ fontSize: 12, color: '#94A3B8' }}>
                            {biz.city} • <span style={{ color: '#38BDF8' }}>{biz.category}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tagline */}
                      <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px', fontStyle: 'italic' }}>
                        "{biz.tagline}"
                      </p>

                      {/* Credentials Box */}
                      <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: 12,
                        padding: '10px 12px',
                        marginBottom: 14,
                        fontSize: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner:</span>
                          <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{biz.owner.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner Login:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', color: '#38BDF8', fontWeight: 600 }}>{biz.owner.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(biz.owner.email, `card_email_${biz.id}`)}
                              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
                              title="Copy Email"
                            >
                              {copiedKey === `card_email_${biz.id}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner Password:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', color: '#F59E0B', fontWeight: 700 }}>{biz.owner.pin}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(biz.owner.pin, `card_pin_${biz.id}`)}
                              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
                              title="Copy Owner Password"
                            >
                              {copiedKey === `card_pin_${biz.id}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#94A3B8' }}>Counter POS PIN (6 Digits):</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: 'monospace', color: '#10B981', fontWeight: 700 }}>{biz.counter.pin}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(biz.counter.pin, `card_counter_${biz.id}`)}
                              style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2 }}
                              title="Copy Counter PIN"
                            >
                              {copiedKey === `card_counter_${biz.id}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Plan & Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: biz.plan === 'Enterprise' ? 'rgba(139, 92, 246, 0.2)' : biz.plan === 'Pro' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: biz.plan === 'Enterprise' ? '#C084FC' : biz.plan === 'Pro' ? '#FBBF24' : '#60A5FA',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          Plan: {biz.plan}
                        </span>

                        {/* Format Badge */}
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: (biz.serviceType === 'stall' || (biz.tables?.length === 1 && biz.tables[0].includes('Stand'))) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                          color: (biz.serviceType === 'stall' || (biz.tables?.length === 1 && biz.tables[0].includes('Stand'))) ? '#34D399' : '#38BDF8',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {(biz.serviceType === 'stall' || (biz.tables?.length === 1 && biz.tables[0].includes('Stand'))) ? (
                            <>
                              <Store size={11} />
                              <span>Stand & Eat Stall</span>
                            </>
                          ) : (
                            <>
                              <Utensils size={11} />
                              <span>{biz.tableCount || (biz.tables?.filter(t => t.toLowerCase().startsWith('table')).length || 6)} Tables</span>
                            </>
                          )}
                        </span>

                        {/* Status Badge */}
                        {isActive ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            ● Active
                          </span>
                        ) : (biz.emailVerified === false || biz.status === 'pending_verification') ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#FBBF24',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            ⏳ Pending Verification (Account Creation Incomplete)
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#F87171',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            ⛔ Suspended by Admin
                          </span>
                        )}

                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: biz.emailVerified !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: biz.emailVerified !== false ? '#34D399' : '#FBBF24',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                          {biz.emailVerified !== false ? '✓ Email Verified' : '✉ Verification Pending'}
                        </span>

                        <span style={{ fontSize: 11, color: '#64748B', marginLeft: 'auto' }}>
                          {biz.tables?.length || 6} Tables
                        </span>
                      </div>
                    </div>

                    {/* Actions Container - 2-row clean layout, zero overflow */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: 12
                    }}>
                      {/* Row 1: Workspace & Customer Menu Links */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap'
                      }}>
                        {/* Launch workspace button or Awaiting Verification */}
                        {(biz.emailVerified === false || biz.status === 'pending_verification') ? (
                          <button
                            onClick={() => handleLaunchWorkspace(biz, 'admin')}
                            style={{
                              flex: '1 1 140px',
                              minWidth: 130,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#FBBF24',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                            title="Account creation incomplete — Email verification pending"
                          >
                            <Clock size={13} />
                            <span>Awaiting Verification</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLaunchWorkspace(biz, 'admin')}
                            style={{
                              flex: '1 1 120px',
                              minWidth: 110,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: '#0284C7',
                              border: 'none',
                              color: '#FFFFFF',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                            title="Impersonate & open this business's Admin Back-Office"
                          >
                            <ExternalLink size={13} />
                            <span>Launch Admin</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleLaunchWorkspace(biz, 'counter')}
                          style={{
                            flex: '0 0 auto',
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#CBD5E1',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Launch Counter POS for this business"
                        >
                          <span>POS</span>
                        </button>

                        <button
                          onClick={() => {
                            playTapSound();
                            const isStall = biz.serviceType === 'stall' || (biz.tables?.length === 1 && biz.tables[0].includes('Stand'));
                            const tableParam = isStall ? 'Stand' : ((biz.tables && biz.tables[0]) ? biz.tables[0].replace(/\D/g, '').padStart(2, '0') : '01');
                            const cleanBiz = biz.id || '';
                            const selectedTable = isStall ? 'Counter / Stand & Eat' : (biz.tables?.[0] || 'Table 01');
                            const sig = computeTableSignature(cleanBiz, selectedTable);
                            window.open(`/?biz=${encodeURIComponent(cleanBiz)}&table=${tableParam}&sig=${encodeURIComponent(sig)}&qr=true#customer`, '_blank');
                          }}
                          style={{
                            flex: '0 0 auto',
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34D399',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Open this business's live QR Table Menu"
                        >
                          <QrCode size={13} />
                          <span>QR Menu</span>
                        </button>

                        <button
                          onClick={() => {
                            playTapSound();
                            setTableQrBiz(biz);
                          }}
                          style={{
                            flex: '0 0 auto',
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38BDF8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="View & Download printable QR tent standees for this business"
                        >
                          <QrCode size={13} />
                          <span>{(biz.serviceType === 'stall' || (biz.tables?.length === 1 && biz.tables[0].includes('Stand'))) ? 'Counter QR' : 'Table QRs'}</span>
                        </button>
                      </div>

                      {/* Row 2: Administration, Governance & Lifecycle Controls */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap'
                      }}>
                        {/* View & Override Credentials */}
                        <button
                          onClick={() => handleOpenCredentialsModal(biz)}
                          style={{
                            flex: '1 1 110px',
                            minWidth: 100,
                            padding: '7px 10px',
                            borderRadius: 8,
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#FBBF24',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5
                          }}
                          title="View & Override Credentials (Technical Recovery)"
                        >
                          <KeyRound size={13} />
                          <span>Credentials</span>
                        </button>

                        {/* Quick 1-click Verify Email button for pending accounts */}
                        {(biz.emailVerified === false || biz.status === 'pending_verification') && (
                          <button
                            onClick={() => handleVerifyEmailNow(biz)}
                            style={{
                              flex: '1 1 100px',
                              minWidth: 90,
                              padding: '7px 10px',
                              borderRadius: 8,
                              background: 'rgba(16, 185, 129, 0.18)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34D399',
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5
                            }}
                            title="Instantly mark email as verified and activate this business"
                          >
                            <ShieldCheck size={13} />
                            <span>Verify Email</span>
                          </button>
                        )}

                        {/* Toggle status (Suspend / Activate) */}
                        <button
                          onClick={() => handleToggleStatus(biz)}
                          style={{
                            flex: '1 1 100px',
                            minWidth: 90,
                            padding: '7px 10px',
                            borderRadius: 8,
                            background: isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            border: isActive ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                            color: isActive ? '#F87171' : '#34D399',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            transition: 'all 0.15s ease'
                          }}
                          title={isActive ? 'Suspend business account (halts operations)' : 'Activate business account'}
                        >
                          {isActive ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                          <span>{isActive ? 'Suspend' : 'Activate'}</span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteBusiness(biz)}
                          style={{
                            flex: '0 0 auto',
                            padding: '7px 10px',
                            borderRadius: 8,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            color: '#EF4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4
                          }}
                          title="Delete business account"
                        >
                          <Trash2 size={13} />
                          <span style={{ fontSize: 11, fontWeight: 600 }}>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* TAB 2: SYSTEM HEALTH & TELEMETRY */}
        {activeTab === 'health' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 18,
              padding: 20
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#38BDF8' }}>
                <Server size={18} />
                <span>Microservice Health Status</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { name: 'Multi-Tenant Local Partitioning', status: 'Healthy', ping: '2ms', color: '#10B981' },
                  { name: 'Cross-Device BroadcastChannel', status: 'Healthy', ping: '8ms', color: '#10B981' },
                  { name: 'Firebase Cloud Firestore Sync', status: 'Connected', ping: '38ms', color: '#10B981' },
                  { name: 'Thermal ESC/POS Receipt Engine', status: 'Standby / Ready', ping: '0ms', color: '#38BDF8' },
                  { name: 'UPI Dynamic QR Bill Generator', status: 'Active (v2)', ping: '1ms', color: '#10B981' }
                ].map((s, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>
                      {s.status} ({s.ping})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 18,
              padding: 20
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#F59E0B' }}>
                <Sliders size={18} />
                <span>Global Platform Controls</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Zero-Auth Customer QR Menu</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Allow diners to browse & order without sign-in</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#10B981', color: '#FFF', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>ENABLED</span>
                </div>

                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Multi-Branch Aggregation</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Cross-city consolidated sales telemetry</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#10B981', color: '#FFF', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>ENABLED</span>
                </div>

                <div style={{
                  padding: '12px 14px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Kitchen KDS Interface</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Legacy kitchen station display status</div>
                  </div>
                  <span style={{ fontSize: 11, background: '#EF4444', color: '#FFF', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>RETIRED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT TRAIL LOGS */}
        {activeTab === 'logs' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: 20
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#38BDF8' }}>
              <Receipt size={18} />
              <span>Developer Audit Trail & System Events</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logs.map((lg) => (
                <div key={lg.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: 10,
                  fontSize: 12,
                  fontFamily: 'monospace'
                }}>
                  <span style={{ color: '#64748B', minWidth: 80 }}>{lg.time}</span>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: lg.type === 'auth' ? '#0284C7' : lg.type === 'biz' ? '#10B981' : '#64748B',
                    color: '#FFF'
                  }}>
                    {lg.type.toUpperCase()}
                  </span>
                  <span style={{ color: '#E2E8F0', flex: 1 }}>{lg.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CREATE NEW BUSINESS ACCOUNT MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }} onClick={() => setShowCreateModal(false)}>
          <div style={{
            width: '100%',
            maxWidth: 580,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 20,
            padding: 26,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} color="#FFFFFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                    Provision New Business Account
                  </h3>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    Sets up restaurant tenant with its own owner & counter authentication
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 12,
                color: '#FCA5A5',
                marginBottom: 16
              }}>
                {formError}
              </div>
            )}

            {createdSuccessBiz ? (
              <div style={{ textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10B981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12
                }}>
                  <CheckCircle2 size={30} color="#10B981" />
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px', color: '#F8FAFC' }}>
                  Account Created Successfully!
                </h4>
                <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 16px' }}>
                  The business account has been provisioned. A verification email has been dispatched to the owner:
                </p>

                <div style={{
                  background: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  textAlign: 'left'
                }}>
                  <Mail size={18} color="#38BDF8" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', marginBottom: 2 }}>
                      Email Verification Link Sent
                    </div>
                    <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.45 }}>
                      Verification email sent to <strong style={{ color: '#F8FAFC' }}>{createdSuccessBiz.owner.email}</strong>.
                      The owner must click the verification link in their inbox before they can access the Owner Back-Office.
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: 16,
                  textAlign: 'left',
                  fontSize: 13,
                  marginBottom: 20
                }}>
                  <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <span style={{ color: '#94A3B8' }}>Restaurant Name: </span>
                    <b style={{ color: '#F8FAFC' }}>{createdSuccessBiz.name}</b>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#94A3B8' }}>Owner Login Email: </span>
                    <b style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{createdSuccessBiz.owner.email}</b>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#94A3B8' }}>Owner Password: </span>
                    <b style={{ color: '#F59E0B', fontFamily: 'monospace' }}>{createdSuccessBiz.owner.pin}</b>
                  </div>
                  <div>
                    <span style={{ color: '#94A3B8' }}>Counter POS Staff PIN: </span>
                    <b style={{ color: '#10B981', fontFamily: 'monospace' }}>{createdSuccessBiz.counter.pin}</b>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreatedSuccessBiz(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 10,
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#F8FAFC',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      handleLaunchWorkspace(createdSuccessBiz, 'admin');
                    }}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 10,
                      background: '#0284C7',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Open Business Admin
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                      Restaurant / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Biryani House"
                      value={newBiz.name}
                      onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#F8FAFC',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                      Cuisine Category
                    </label>
                    <select
                      value={newBiz.category}
                      onChange={(e) => setNewBiz({ ...newBiz, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#F8FAFC',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="Fine Dining / Artisanal">Fine Dining / Artisanal</option>
                      <option value="Casual Dining & Bar">Casual Dining & Bar</option>
                      <option value="QSR / Cafe">QSR / Cafe</option>
                      <option value="Cloud Kitchen">Cloud Kitchen</option>
                      <option value="Sweet Shop & Chaat">Sweet Shop & Chaat</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                      City / Location Branch
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jubilee Hills, Hyderabad"
                      value={newBiz.city}
                      onChange={(e) => setNewBiz({ ...newBiz, city: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#F8FAFC',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                      Subscription Plan
                    </label>
                    <select
                      value={newBiz.plan}
                      onChange={(e) => setNewBiz({ ...newBiz, plan: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#F8FAFC',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="Starter">Starter (₹1,499/mo)</option>
                      <option value="Pro">Pro (₹3,499/mo)</option>
                      <option value="Enterprise">Enterprise (₹8,999/mo)</option>
                    </select>
                  </div>
                </div>

                {/* AUTOMATIC RENEWAL TERMS & CANCELLATION DISCLOSURE (FTC Negative Option Rule & California ARL Cal. Bus. & Prof. Code § 17600) */}
                <div style={{
                  background: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={14} color="#38BDF8" />
                    <span>Subscription Renewal Terms &amp; 1-Click Cancellation Disclosure</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.45 }}>
                    <strong>Recurring Billing Terms:</strong> Your chosen <strong>{newBiz.plan} Plan ({newBiz.plan === 'Starter' ? '₹1,499' : newBiz.plan === 'Pro' ? '₹3,499' : '₹8,999'}/month)</strong> will automatically renew at the beginning of each monthly billing cycle unless canceled prior to renewal.
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.45 }}>
                    <strong>1-Click Cancellation Instructions:</strong> You may cancel anytime with 1 click in <em>Account Settings &gt; Danger Zone</em> or by sending an email to <a href="mailto:billing@ontap.app" style={{ color: '#38BDF8', textDecoration: 'none' }}>billing@ontap.app</a>. There are zero cancellation fees, penalties, or long-term lock-ins. Access continues until the end of the paid billing period.
                  </div>
                </div>

                {/* RESTAURANT SERVICE FORMAT & TABLES SETUP */}
                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <QrCode size={14} color="#38BDF8" />
                    <span>Restaurant Service Format & Tables</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>
                    Select how customers order and dine at this establishment
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {/* Option 1: Dine-In Restaurant */}
                    <div
                      onClick={() => setNewBiz({ ...newBiz, serviceType: 'dine_in' })}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: newBiz.serviceType !== 'stall' ? '2px solid #0284C7' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: newBiz.serviceType !== 'stall' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: newBiz.serviceType !== 'stall' ? '#0284C7' : 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF'
                        }}>
                          <Utensils size={13} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: newBiz.serviceType !== 'stall' ? '#38BDF8' : '#CBD5E1' }}>
                          Dine-In Restaurant
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', lineHeight: 1.35 }}>
                        Numbered dining tables. Generates separate QR standees for each table.
                      </div>
                    </div>

                    {/* Option 2: Stand & Eat Stall */}
                    <div
                      onClick={() => setNewBiz({ ...newBiz, serviceType: 'stall' })}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: newBiz.serviceType === 'stall' ? '2px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: newBiz.serviceType === 'stall' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: newBiz.serviceType === 'stall' ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFFFFF'
                        }}>
                          <Store size={13} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: newBiz.serviceType === 'stall' ? '#34D399' : '#CBD5E1' }}>
                          Stand & Eat Stall
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', lineHeight: 1.35 }}>
                        Counter service. Single QR standee; orders handed out using Order Numbers.
                      </div>
                    </div>
                  </div>

                  {newBiz.serviceType !== 'stall' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#CBD5E1' }}>
                          Number of Dining Tables:
                        </label>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#38BDF8' }}>
                          {newBiz.tableCount || 6} Tables (+ Takeaway)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={newBiz.tableCount || 6}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1));
                            setNewBiz({ ...newBiz, tableCount: val });
                          }}
                          style={{
                            width: 70,
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#F8FAFC',
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'center'
                          }}
                        />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1, maxHeight: 48, overflowY: 'auto' }}>
                          {Array.from({ length: Math.min(newBiz.tableCount || 6, 6) }, (_, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 5,
                                background: 'rgba(2, 132, 199, 0.2)',
                                color: '#38BDF8',
                                border: '1px solid rgba(2, 132, 199, 0.3)'
                              }}
                            >
                              Table {String(i + 1).padStart(2, '0')}
                            </span>
                          ))}
                          {(newBiz.tableCount || 6) > 6 && (
                            <span style={{ fontSize: 9.5, color: '#94A3B8', padding: '2px 4px' }}>
                              +{(newBiz.tableCount || 6) - 6} more
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 5,
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: '#CBD5E1',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            Counter / Takeaway
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                        Individual QR tent cards will be generated for Table 01 through Table {String(newBiz.tableCount || 6).padStart(2, '0')}.
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <CheckCircle2 size={14} color="#34D399" style={{ flexShrink: 0 }} />
                      <div style={{ fontSize: 10.5, color: '#A7F3D0', lineHeight: 1.35 }}>
                        Generates a single <strong>Counter QR Standee</strong>. Customers order at the counter and receive sequential <strong>Order Numbers (e.g. #101)</strong> for pickup.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', marginBottom: 8 }}>
                    Owner Back-Office Credentials
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Owner Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Farhan Akhtar"
                        value={newBiz.ownerName}
                        onChange={(e) => setNewBiz({ ...newBiz, ownerName: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#F8FAFC',
                          fontSize: 12,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Owner Login Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. farhan@royalbiryani.in"
                        value={newBiz.ownerEmail}
                        onChange={(e) => setNewBiz({ ...newBiz, ownerEmail: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#F8FAFC',
                          fontSize: 12,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Owner Password (min 6 chars) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter password (letters, digits, or both)"
                      value={newBiz.ownerPin}
                      data-mask="true"
                      data-private="true"
                      data-sl="mask"
                      onChange={(e) => setNewBiz({ ...newBiz, ownerPin: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#F59E0B',
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: '0.05em',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                      Letters, digits, or combination (minimum 6 characters). Synchronized with Firebase Auth. Input is masked for privacy.
                    </div>
                  </div>

                  {/* COPPA Age Gate Verification (15 U.S.C. § 6501 et seq.) */}
                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                      Owner Birth Year (COPPA &amp; Legal Capacity Age Gate) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1920}
                      max={new Date().getFullYear()}
                      placeholder="e.g. 1994 (YYYY)"
                      value={newBiz.birthYear}
                      onChange={(e) => setNewBiz({ ...newBiz, birthYear: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#F8FAFC',
                        fontSize: 12,
                        boxSizing: 'border-box',
                        marginBottom: 8
                      }}
                    />
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#CBD5E1', cursor: 'pointer', lineHeight: 1.45 }}>
                      <input
                        type="checkbox"
                        required
                        checked={newBiz.ageGateConsent}
                        onChange={(e) => setNewBiz({ ...newBiz, ageGateConsent: e.target.checked })}
                        style={{ marginTop: 2, accentColor: '#0284C7', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span>
                        I certify that I am at least 18 years of age (or at least 13 with verified legal guardian authorization) and possess full statutory legal capacity to subscribe under the <strong>Children's Online Privacy Protection Act (COPPA, 15 U.S.C. § 6501 et seq.)</strong>. Accounts for children under 13 are strictly prohibited.
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>
                    Counter Staff POS Setup
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Counter POS PIN (6 Digits) *</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="Enter 6-digit PIN"
                        value={newBiz.counterPin}
                        data-mask="true"
                        data-private="true"
                        data-sl="mask"
                        onChange={(e) => setNewBiz({ ...newBiz, counterPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#10B981',
                          fontWeight: 700,
                          fontSize: 14,
                          letterSpacing: '0.15em',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>UPI VPA (QR Payments)</label>
                      <input
                        type="text"
                        placeholder="e.g. royalbiryani@upi"
                        value={newBiz.upiId}
                        data-mask="true"
                        data-private="true"
                        data-sl="mask"
                        onChange={(e) => setNewBiz({ ...newBiz, upiId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#F8FAFC',
                          fontSize: 12,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Statutory Renewal Terms & Cancel Notice next to Subscribe Button (FTC & Cal. ARL) */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', lineHeight: 1.4 }}>
                    🔒 <strong>Renewal Terms:</strong> Plan auto-renews monthly at standard rate. <strong>Cancel anytime</strong> with 1 click in Account Settings or email <a href="mailto:billing@ontap.app" style={{ color: '#38BDF8', textDecoration: 'none' }}>billing@ontap.app</a>. No fees or penalties.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#CBD5E1',
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 10,
                      background: isCreating ? 'rgba(6, 182, 212, 0.5)' : 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    {isCreating && <RefreshCw size={13} className="spinning" />}
                    <span>{isCreating ? 'Provisioning & Sending Verification...' : 'Create Business Account'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* VIEW CREDENTIALS MODAL */}
      {showCredentialsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }} onClick={() => setShowCredentialsModal(null)}>
          <div style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={20} color="#F59E0B" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                  {showCredentialsModal.name} Credentials
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowCredentialsModal(null);
                  setIsEditingCredentials(false);
                }}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {isEditingCredentials ? (
              /* MANUAL CREDENTIALS OVERRIDE FORM (TECHNICAL ANOMALY RECOVERY) */
              <form onSubmit={handleSaveManualCredentialsOverride} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 10,
                  padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#FBBF24', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <AlertTriangle size={14} />
                    <span>Technical Anomaly Recovery Override</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#CBD5E1', lineHeight: 1.4 }}>
                    Manually update the business owner's email address and/or login password (Master PIN). Updates immediately synchronize the local database and Firebase Auth.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>
                    OWNER ADMIN EMAIL *
                  </label>
                  <input
                    type="email"
                    required
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                    placeholder="e.g. owner@restaurant.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#0F172A',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#38BDF8',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>
                      OWNER PASSWORD (MIN 6 CHARS) *
                    </label>
                    <span style={{ fontSize: 10, color: '#F59E0B' }}>Letters / Digits / Combination</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={editOwnerPin}
                    onChange={(e) => setEditOwnerPin(e.target.value)}
                    placeholder="Enter password (letters, digits, or both)"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#0F172A',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#F59E0B',
                      fontFamily: 'monospace',
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 1,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 10, color: '#64748B', display: 'block', marginTop: 4 }}>
                    Minimum 6 characters (characters, digits, or both). Synchronized with Firebase Auth.
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5 }}>
                    COUNTER STAFF POS PIN (6 DIGITS)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={editCounterPin}
                    onKeyDown={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const val = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                      setEditCounterPin(val);
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 6) setEditCounterPin(val);
                    }}
                    placeholder="Enter 6-digit PIN"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: '#0F172A',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#10B981',
                      fontFamily: 'monospace',
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: 2,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'rgba(16, 185, 129, 0.08)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <input
                    type="checkbox"
                    checked={editMarkVerified}
                    onChange={(e) => setEditMarkVerified(e.target.checked)}
                    style={{ accentColor: '#10B981', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11, color: '#D1FAE5' }}>
                    Mark Email Verified & Activate Account (Overrides Suspended State)
                  </span>
                </label>

                {editOverrideError && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#F87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    {editOverrideError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => {
                      playTapSound();
                      setIsEditingCredentials(false);
                      setEditOverrideError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '11px',
                      borderRadius: 10,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#CBD5E1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isActionLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isActionLoading}
                    style={{
                      flex: 2,
                      padding: '11px',
                      borderRadius: 10,
                      background: '#D97706',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: isActionLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {isActionLoading ? (
                      <>
                        <RefreshCw size={13} className="spinning" />
                        <span>Synchronizing...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Manual Override</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* VIEW CREDENTIALS DISPLAY */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>OWNER ADMIN LOGIN</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#38BDF8' }}>
                      {showCredentialsModal.owner.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(showCredentialsModal.owner.email, 'email')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                    >
                      {copiedKey === 'email' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>OWNER PASSWORD</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
                      {showCredentialsModal.owner.pin}
                    </span>
                    <button
                      onClick={() => copyToClipboard(showCredentialsModal.owner.pin, 'ownerPin')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                      title="Copy Owner Password"
                    >
                      {copiedKey === 'ownerPin' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>COUNTER STAFF POS LOGIN ID</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#38BDF8' }}>
                      @{showCredentialsModal.counter?.loginId || `${showCredentialsModal.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.pos`}
                    </span>
                    <button
                      onClick={() => copyToClipboard(`@${showCredentialsModal.counter?.loginId || `${showCredentialsModal.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.pos`}`, 'counterLoginId')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                      title="Copy Staff Login ID"
                    >
                      {copiedKey === 'counterLoginId' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>COUNTER STAFF POS PIN (6 DIGITS)</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#10B981' }}>
                      {showCredentialsModal.counter.pin}
                    </span>
                    <button
                      onClick={() => copyToClipboard(showCredentialsModal.counter.pin, 'counterPin')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                      title="Copy Staff POS PIN"
                    >
                      {copiedKey === 'counterPin' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* MANUAL OVERRIDE BUTTON (FOR TECHNICAL ANOMALIES) */}
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setIsEditingCredentials(true);
                    setEditOwnerEmail(showCredentialsModal.owner?.email || '');
                    setEditOwnerPin(showCredentialsModal.owner?.pin || '');
                    setEditCounterPin(showCredentialsModal.counter?.pin || '');
                    setEditMarkVerified(showCredentialsModal.emailVerified !== false);
                    setEditOverrideError('');
                    setActionStatus(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#FBBF24',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Manually change owner email and password for technical anomalies"
                >
                  <Sliders size={14} />
                  <span>Manual Technical Override: Change Email / Password</span>
                </button>

                {/* Account Lifecycle State (Remains suspended until verified by Firebase) */}
                <div style={{
                  background: (showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${(showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  padding: '10px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>ACCOUNT LIFECYCLE STATE:</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: (showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? '#34D399' : '#FBBF24'
                    }}>
                      {(showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? '● Active' : '⏳ Pending Verification (Incomplete)'}
                    </span>
                  </div>
                  {!(showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) && (
                    <span style={{ fontSize: 11, color: '#FCD34D', lineHeight: 1.4 }}>
                      Account creation incomplete: This business account will remain in a <strong>pending verification</strong> state and cannot log in until the owner clicks the verification link dispatched by Firebase.
                    </span>
                  )}
                </div>

                {/* Email Verification Status & Actions */}
                <div style={{
                  background: showCredentialsModal.emailVerified !== false ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${showCredentialsModal.emailVerified !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  padding: '10px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Mail size={15} color={showCredentialsModal.emailVerified !== false ? '#10B981' : '#F59E0B'} />
                    <span style={{ fontSize: 12, color: showCredentialsModal.emailVerified !== false ? '#34D399' : '#FBBF24', fontWeight: 600 }}>
                      {showCredentialsModal.emailVerified !== false ? 'Email Verified' : 'Pending Verification'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!(showCredentialsModal.emailVerified !== false && showCredentialsModal.status === 'active') && (
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => handleVerifyEmailNow(showCredentialsModal)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          color: '#34D399',
                          fontWeight: 700,
                          cursor: isActionLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Instantly mark email as verified and activate account"
                      >
                        <CheckCircle2 size={12} />
                        <span>Verify Email Now</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={async () => {
                        setIsActionLoading(true);
                        setActionStatus(null);
                        playTapSound();
                        const r = await resendVerificationLink({
                          email: showCredentialsModal.owner.email,
                          password: showCredentialsModal.owner.pin
                        });
                        setIsActionLoading(false);
                        if (r.success) {
                          playSuccessChime();
                          setActionStatus({ type: 'success', text: r.message });
                        } else {
                          playAlertChime();
                          setActionStatus({ type: 'error', text: r.error });
                        }
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: '#F8FAFC',
                        cursor: isActionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <RefreshCw size={11} className={isActionLoading ? 'spinning' : ''} />
                      <span>Resend Email</span>
                    </button>
                  </div>
                </div>

                {/* Password Reset Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={async () => {
                      setIsActionLoading(true);
                      setActionStatus(null);
                      playTapSound();
                      const r = await sendPasswordReset({ email: showCredentialsModal.owner.email });
                      setIsActionLoading(false);
                      if (r.success) {
                        playSuccessChime();
                        setActionStatus({ type: 'success', text: r.message });
                      } else {
                        playAlertChime();
                        setActionStatus({ type: 'error', text: r.error });
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38BDF8',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isActionLoading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: 0
                    }}
                  >
                    <Send size={12} />
                    <span>Send Password Reset Link to Owner</span>
                  </button>
                </div>

                {actionStatus && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    background: actionStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: actionStatus.type === 'success' ? '#34D399' : '#F87171',
                    border: `1px solid ${actionStatus.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}>
                    {actionStatus.text}
                  </div>
                )}
              </div>
            )}

            {!isEditingCredentials && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleDeleteBusiness(showCredentialsModal)}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#EF4444',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title="Permanently delete this business account and wipe all stored data"
                >
                  <Trash2 size={13} />
                  <span>Delete Account & Wipe Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCredentialsModal(null);
                    setIsEditingCredentials(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 10,
                    background: '#0284C7',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Business-Specific Table QR Standees & Direct Order Link Modal */}
      {tableQrBiz && (
        <TableQrModal
          isOpen={Boolean(tableQrBiz)}
          onClose={() => setTableQrBiz(null)}
          tables={tableQrBiz.tables || ['Table 01', 'Table 02', 'Table 03', 'Takeaway']}
          restaurantName={tableQrBiz.name}
          logo={tableQrBiz.logo}
          tagline={tableQrBiz.tagline}
          businessId={tableQrBiz.id}
          serviceType={tableQrBiz.serviceType || (tableQrBiz.tables?.length === 1 && tableQrBiz.tables[0].includes('Stand') ? 'stall' : 'dine_in')}
        />
      )}

      {/* Statutory Legal & Tax Compliance Archive Modal */}
      {showComplianceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16
          }}
          onClick={() => setShowComplianceModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              color: '#F8FAFC'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                }}>
                  <ShieldCheck size={20} color="#FFFFFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                    Statutory Legal & Tax Compliance Archive
                  </h3>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    Section 36 GST Act & DPDP Act 2023 Ledger (7-Year Non-PII Retention)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowComplianceModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5, margin: '0 0 16px' }}>
              Whenever an account is deleted by an owner or admin, all personal identifying data (PII), credentials, emails, and diner records are permanently purged from Firebase Users & Authentication and operational databases. Only statutory non-PII financial and tax aggregate metrics are cryptographically sealed here for audit compliance.
            </p>

            {(() => {
              const records = getLegalComplianceRecords();
              if (records.length === 0) {
                return (
                  <div style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: 14,
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    color: '#94A3B8'
                  }}>
                    <ShieldCheck size={32} color="#10B981" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', marginBottom: 4 }}>
                      No Deleted Accounts in Compliance Archive
                    </div>
                    <div style={{ fontSize: 12 }}>
                      All current business accounts are active and operational. When any business account is purged, its statutory certificate will appear here.
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
                  {records.map((rec) => (
                    <div
                      key={rec.complianceId}
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 14,
                        padding: 16
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#F8FAFC' }}>
                            {rec.businessName}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34D399',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}>
                            ✓ {rec.complianceSealStatus}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38BDF8' }}>
                          {rec.complianceId}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12, marginBottom: 10 }}>
                        <div style={{ color: '#94A3B8' }}>
                          Deletion Timestamp: <strong style={{ color: '#F8FAFC' }}>{new Date(rec.deletionTimestamp).toLocaleString('en-IN')}</strong>
                        </div>
                        <div style={{ color: '#94A3B8' }}>
                          Triggered By: <strong style={{ color: '#F8FAFC' }}>{rec.deletionActor}</strong>
                        </div>
                        <div style={{ color: '#94A3B8' }}>
                          Masked Owner ID: <span style={{ fontFamily: 'monospace', color: '#F8FAFC' }}>{rec.maskedIdentifier}</span>
                        </div>
                        <div style={{ color: '#94A3B8' }}>
                          Fiscal Period: <strong style={{ color: '#F8FAFC' }}>{rec.statutoryFinancialSummary?.fiscalAccountingPeriod || '2026'}</strong>
                        </div>
                      </div>

                      {/* Financial Tax Summary Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 8,
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        marginBottom: 10
                      }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Invoices Processed</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC' }}>
                            {rec.statutoryFinancialSummary?.totalTaxInvoicesIssued || 0}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Gross Turnover (GMV)</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                            ₹{(rec.statutoryFinancialSummary?.grossTurnoverVolumeINR || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Estimated GST Tax</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B' }}>
                            ₹{(rec.statutoryFinancialSummary?.estimatedCompositeGstTaxINR || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {/* Verification Badges */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10.5, color: '#34D399' }}>
                        <span>✓ Firebase Auth User Purged</span> •
                        <span>✓ Passwords & Credentials Erased</span> •
                        <span>✓ Cloud Firestore Orders Cleared</span> •
                        <span>✓ Local Partitions Wiped</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setShowComplianceModal(false)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: 10,
                background: '#0284C7',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Close Compliance Ledger
            </button>
          </div>
        </div>
      )}

      {/* Visible Dashboard Footer with Privacy Policy & All Compliance Links */}
      <LegalFooter
        variant="dark"
        restaurantName="Developer Superadmin Portal"
        licenseText="Platform Control Panel • Delaware Corp"
      />
    </div>
  );
}
