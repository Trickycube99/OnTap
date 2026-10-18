import React, { useState } from 'react';
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
  Send
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import {
  provisionOwnerAccountWithVerification,
  resendVerificationLink,
  sendPasswordReset
} from '../utils/firebaseAuth';
import {
  getBusinesses,
  getActiveBusiness,
  createBusiness,
  updateBusiness,
  deleteBusiness,
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
  const [copiedKey, setCopiedKey] = useState(null);

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
    tableCount: 6,
    accentColor: '#007AFF'
  });
  const [formError, setFormError] = useState('');
  const [createdSuccessBiz, setCreatedSuccessBiz] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // System Logs
  const [logs, setLogs] = useState(() => [
    { id: 1, time: 'Just now', type: 'system', text: 'Developer Console session initialized securely' },
    { id: 2, time: '2 mins ago', type: 'auth', text: 'Multi-tenant database validated: 3 active business partitions' },
    { id: 3, time: '14 mins ago', type: 'sync', text: 'Cross-tab broadcast channel heartbeat: OK (latency 12ms)' },
    { id: 4, time: '1 hour ago', type: 'biz', text: 'Business "Advait Artisanal Kitchen" processed ₹18,400 in POS sales' }
  ]);

  const refreshBusinesses = () => {
    setBusinesses(getBusinesses());
  };

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

    if (!/^\d{4}$/.test(trimmedOwnerPin)) {
      setFormError('Owner Admin PIN must be exactly 4 digits (e.g. 8821).');
      return;
    }
    if (!/^\d{4}$/.test(trimmedCounterPin)) {
      setFormError('Counter Staff POS PIN must be exactly 4 digits (e.g. 4421).');
      return;
    }

    const pinInUse = businesses.some(
      (b) => b.owner.pin === trimmedOwnerPin ||
             b.counter.pin === trimmedOwnerPin ||
             b.owner.pin === trimmedCounterPin ||
             b.counter.pin === trimmedCounterPin
    );
    if (pinInUse) {
      setFormError('Specified Owner PIN or Counter PIN is already assigned to another business. Please choose unique 4-digit PINs.');
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

    const tables = Array.from({ length: Number(newBiz.tableCount) || 6 }, (_, i) => `Table ${String(i + 1).padStart(2, '0')}`);
    tables.push('Takeaway / Counter');

    // 2. Provision business in local multi-tenant database (marked as suspended pending email verification)
    const res = createBusiness({
      ...newBiz,
      ownerPin: trimmedOwnerPin,
      counterPin: trimmedCounterPin,
      tables,
      status: 'suspended',
      emailVerified: false
    });

    setIsCreating(false);

    if (res.success) {
      playSuccessChime();
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
        tableCount: 6,
        accentColor: '#007AFF'
      });
    } else {
      playAlertChime();
      setFormError(res.error);
    }
  };

  const handleDeleteBusiness = (biz) => {
    playTapSound();
    if (window.confirm(`Are you sure you want to delete business account "${biz.name}"? This will permanently remove its tenant workspace.`)) {
      const res = deleteBusiness(biz.id);
      if (res.success) {
        playSuccessChime();
        refreshBusinesses();
        setLogs((prev) => [
          { id: Date.now(), time: 'Just now', type: 'biz', text: `Deleted business account "${biz.name}" (${biz.id})` },
          ...prev
        ]);
      } else {
        alert(res.error);
      }
    }
  };

  const handleToggleStatus = (biz) => {
    playTapSound();
    const newStatus = biz.status === 'active' ? 'suspended' : 'active';
    updateBusiness(biz.id, { status: newStatus });
    refreshBusinesses();
    setLogs((prev) => [
      { id: Date.now(), time: 'Just now', type: 'biz', text: `Updated "${biz.name}" status to ${newStatus}` },
      ...prev
    ]);
  };

  const handleLaunchWorkspace = (biz, targetRole = 'admin') => {
    playTapSound();
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
                placeholder="dev@platform.com"
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
                  placeholder="Enter developer access key"
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
                if (onRoleSwitch) onRoleSwitch('customer');
                else window.location.hash = 'customer';
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
              <span>← Return to Public Customer Menu</span>
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
              if (onRoleSwitch) onRoleSwitch('customer');
              else window.location.hash = 'customer';
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
            <span>Open Dining App</span>
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
            <div style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC' }}>
              {businesses.length}
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

            {/* Businesses Grid */}
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner:</span>
                          <span style={{ fontWeight: 600, color: '#F8FAFC' }}>{biz.owner.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner Login:</span>
                          <span style={{ fontFamily: 'monospace', color: '#38BDF8', fontWeight: 600 }}>{biz.owner.email}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>Owner PIN (4 Digits):</span>
                          <span style={{ fontFamily: 'monospace', color: '#F59E0B', fontWeight: 700 }}>{biz.owner.pin}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#94A3B8' }}>Counter POS PIN (4 Digits):</span>
                          <span style={{ fontFamily: 'monospace', color: '#10B981', fontWeight: 700 }}>{biz.counter.pin}</span>
                        </div>
                      </div>

                      {/* Plan & Status Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
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

                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: (isActive && biz.emailVerified !== false) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: (isActive && biz.emailVerified !== false) ? '#34D399' : '#F87171',
                          border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                          {(isActive && biz.emailVerified !== false) ? '● Active' : '○ Suspended (Pending Verification)'}
                        </span>

                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: biz.emailVerified !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
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

                    {/* Actions Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      paddingTop: 12
                    }}>
                      {/* Launch workspace button */}
                      <button
                        onClick={() => handleLaunchWorkspace(biz, 'admin')}
                        style={{
                          flex: 1,
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

                      <button
                        onClick={() => handleLaunchWorkspace(biz, 'counter')}
                        style={{
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

                      {/* View Credentials */}
                      <button
                        onClick={() => {
                          playTapSound();
                          setShowCredentialsModal(biz);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#F59E0B',
                          cursor: 'pointer'
                        }}
                        title="View & copy login credentials"
                      >
                        <KeyRound size={14} />
                      </button>

                      {/* Toggle status */}
                      <button
                        onClick={() => handleToggleStatus(biz)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: isActive ? '#F87171' : '#34D399',
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                        title={isActive ? 'Suspend business account' : 'Activate business account'}
                      >
                        {isActive ? 'Suspend' : 'Activate'}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteBusiness(biz)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#EF4444',
                          cursor: 'pointer'
                        }}
                        title="Delete business account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
                    <span style={{ color: '#94A3B8' }}>Owner Admin PIN: </span>
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
                    <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Owner Master PIN (4 Digits) *</label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      placeholder="e.g. 8821"
                      value={newBiz.ownerPin}
                      onChange={(e) => setNewBiz({ ...newBiz, ownerPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#F59E0B',
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: '0.15em',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                      Original Constraint: Exactly 4 numeric digits. Account will remain in a <strong>suspended</strong> state until email verification is completed via Firebase.
                    </div>
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
                      <label style={{ display: 'block', fontSize: 11, color: '#CBD5E1', marginBottom: 2 }}>Counter POS PIN (4 Digits) *</label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        placeholder="e.g. 4421"
                        value={newBiz.counterPin}
                        onChange={(e) => setNewBiz({ ...newBiz, counterPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
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
            maxWidth: 460,
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
                onClick={() => setShowCredentialsModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

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
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>OWNER MASTER PIN (4 DIGITS)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#F59E0B' }}>
                    {showCredentialsModal.owner.pin}
                  </span>
                  <button
                    onClick={() => copyToClipboard(showCredentialsModal.owner.pin, 'ownerPin')}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
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
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>COUNTER STAFF POS PIN (4 DIGITS)</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#10B981' }}>
                    {showCredentialsModal.counter.pin}
                  </span>
                  <button
                    onClick={() => copyToClipboard(showCredentialsModal.counter.pin, 'counterPin')}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    {copiedKey === 'counterPin' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

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
                    color: (showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? '#34D399' : '#F87171'
                  }}>
                    {(showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) ? '● Active' : '○ Suspended'}
                  </span>
                </div>
                {!(showCredentialsModal.status === 'active' && showCredentialsModal.emailVerified !== false) && (
                  <span style={{ fontSize: 11, color: '#FCA5A5', lineHeight: 1.4 }}>
                    This account will remain in a <strong>suspended</strong> state until the owner clicks the verification link sent by Firebase.
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

            <button
              onClick={() => setShowCredentialsModal(null)}
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
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
