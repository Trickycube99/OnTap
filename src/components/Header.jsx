import React, { useState } from 'react';
import {
  Search,
  QrCode,
  ShieldCheck,
  ChevronDown,
  Layers,
  BarChart3,
  RotateCcw,
  ShoppingBag,
  MapPin,
  CheckCircle2,
  Utensils,
  User,
  LogOut,
  Volume2,
  VolumeX,
  Globe,
  Cloud,
  Server
} from 'lucide-react';
import { playTapSound } from '../utils/audio';
import { getCloudSyncState, subscribeCloudSyncState } from '../utils/sync';
import CloudSyncModal from './CloudSyncModal';

export default function Header({
  chef,
  theme,
  currentRole,
  onRoleSwitch,
  activeTable,
  setActiveTable,
  searchQuery,
  setSearchQuery,
  isSearchOpen,
  setIsSearchOpen,
  activeOrdersCount,
  cartCount,
  cartTotal,
  onOpenCart,
  onResetDemo,
  authSessions = {},
  canReturnToAdmin = false,
  onLogoutRole,
  onOpenTableQr,
  language = 'en',
  onToggleLanguage,
  isSoundMuted = false,
  onToggleSound
}) {
  const [activeBranch, setActiveBranch] = useState('Connaught Place, New Delhi');
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState(getCloudSyncState());
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  React.useEffect(() => {
    const unsub = subscribeCloudSyncState(setCloudSyncState);
    return unsub;
  }, []);

  const branches = [
    'Connaught Place, New Delhi (Flagship)',
    'DLF Cyber Hub, Gurugram',
    '12th Main Indiranagar, Bengaluru'
  ];

  const currentSession = authSessions[currentRole];
  const isCustomer = currentRole === 'customer' || currentRole === 'chef';

  // -------------------------------------------------------------
  // 1. DEDICATED CUSTOMER-FACING HEADER
  // In accordance with PRD: Absolutely NO login buttons, NO admin/counter links
  // -------------------------------------------------------------
  if (isCustomer) {
    return (
      <>
        <header className="production-header customer-mode-header">
          {/* Left: Restaurant Brand & FSSAI Badge */}
          <div className="header-left">
            <div className="brand-pill customer-brand">
              <div className="brand-avatar-box">
                {theme?.logo ? (
                  <img
                    src={theme.logo}
                    alt={theme.restaurantName}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }}
                  />
                ) : (chef?.portrait && chef?.showAboutChef !== false && theme?.showAboutChef !== false) ? (
                  <img src={chef.portrait} alt={theme.restaurantName} />
                ) : (
                  <span>{(theme?.restaurantName || 'AD').substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="brand-info">
                <div className="brand-name-row">
                  <span className="brand-title">{theme.restaurantName || 'Advait Artisanal Kitchen'}</span>
                </div>
                <div className="fssai-micro-badge">
                  <ShieldCheck size={11} color="#16A34A" />
                  <span>FSSAI 5-Star Clean Dining</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Table Badge (Tap to change table if needed) */}
          <div className="header-center-table">
            <button
              className="customer-table-pill"
              onClick={() => {
                playTapSound();
                setShowTableModal(true);
              }}
              title="Current Dine-in Table (Tap to switch)"
            >
              <Utensils size={13} color="#007AFF" />
              <span className="table-name-text">{activeTable}</span>
              <ChevronDown size={11} color="#6B7280" />
            </button>
          </div>

          {/* Right: Language Switcher, Search, and Cart Tray */}
          <div className="header-right">
            {/* Language Switcher Pill (PRD Section 7: English & Hindi Support) */}
            <button
              className="btn-secondary-pill lang-toggle-pill"
              onClick={() => {
                playTapSound();
                if (onToggleLanguage) onToggleLanguage();
              }}
              title={language === 'en' ? 'Switch to Hindi (हिन्दी)' : 'Switch to English'}
            >
              <Globe size={13} color="#007AFF" />
              <span style={{ fontWeight: 600 }}>{language === 'en' ? 'हिन्दी' : 'EN'}</span>
            </button>

            {/* Search Icon */}
            <button
              className={`nav-icon-btn ${isSearchOpen ? 'active' : ''}`}
              onClick={() => {
                playTapSound();
                setIsSearchOpen(!isSearchOpen);
              }}
              title="Search dishes & flavors"
              aria-label="Search dishes"
            >
              <Search size={16} />
            </button>

            {/* Quick Cart / Order Tray Pill */}
            {cartCount > 0 && (
              <button
                className="btn-primary-pill header-cart-pill"
                onClick={() => {
                  playTapSound();
                  if (onOpenCart) onOpenCart();
                }}
                title="View your dining tray"
              >
                <ShoppingBag size={14} />
                <span>₹{cartTotal.toFixed(0)}</span>
                <span className="cart-bubble-count">{cartCount}</span>
              </button>
            )}
          </div>
        </header>

        {/* Expandable Search Input Row */}
        {isSearchOpen && (
          <div className="header-search-bar">
            <div className="search-bar-inner">
              <Search size={16} color="#9CA3AF" />
              <input
                type="text"
                placeholder={language === 'hi' ? 'व्यंजन या स्वाद खोजें...' : 'Search artisanal dishes, ingredients or dietary choices...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Guest Table Selector Modal */}
        {showTableModal && (
          <div className="modal-overlay" onClick={() => setShowTableModal(false)}>
            <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-drag-pill" />
              <div className="card-heading" style={{ fontSize: 18, marginBottom: 4 }}>
                {language === 'hi' ? 'अपनी टेबल चुनें' : 'Select Your Table'}
              </div>
              <div className="card-meta-text" style={{ marginBottom: 16 }}>
                {language === 'hi'
                  ? 'अपना ऑर्डर सीधे इसी टेबल पर प्राप्त करने के लिए नंबर चुनें'
                  : 'Orders will be delivered directly to this table number by our service team.'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {(theme?.tables || [
                  'Table 01', 'Table 02', 'Table 03', 'Table 04',
                  'Table 05', 'Table 06', 'Table 07', 'Counter / Takeaway'
                ]).map((tbl) => (
                  <button
                    key={tbl}
                    className={`btn-secondary-pill ${activeTable === tbl ? 'active' : ''}`}
                    style={{
                      padding: '10px 6px',
                      fontSize: 12,
                      fontWeight: 600,
                      justifyContent: 'center',
                      background: activeTable === tbl ? '#EFF6FF' : '#F9FAFB',
                      borderColor: activeTable === tbl ? '#007AFF' : '#E5E7EB',
                      color: activeTable === tbl ? '#007AFF' : 'var(--text-primary)'
                    }}
                    onClick={() => {
                      playTapSound();
                      setActiveTable(tbl);
                      setShowTableModal(false);
                    }}
                  >
                    {tbl}
                  </button>
                ))}
              </div>

              <button
                className="btn-primary-pill full-width"
                onClick={() => setShowTableModal(false)}
              >
                {language === 'hi' ? 'टेबल कन्फर्म करें' : `Confirm ${activeTable}`}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // 2. DEDICATED STAFF WORKSTATION HEADER (Counterperson / Admin)
  // High-productivity terminal with station switching, alerts & session locking
  // -------------------------------------------------------------
  return (
    <>
      <header className="production-header staff-mode-header">
        {/* Left: Station Badge & Branch Switcher */}
        <div className="header-left">
          <div className="brand-pill staff-station-pill">
            <div className="brand-avatar-box staff-avatar">
              {currentRole === 'developer' ? (
                <Server size={16} color="#38BDF8" />
              ) : theme?.logo ? (
                <img
                  src={theme.logo}
                  alt={theme.restaurantName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }}
                />
              ) : currentRole === 'counter' ? (
                <Layers size={16} color="#FFFFFF" />
              ) : (
                <BarChart3 size={16} color="#FFFFFF" />
              )}
            </div>
            <div className="brand-info">
              <div className="brand-name-row">
                <span className="brand-title">
                  {currentRole === 'developer'
                    ? 'FlowScape Root Console'
                    : currentRole === 'counter'
                    ? `${theme?.restaurantName ? `${theme.restaurantName} • ` : ''}POS Terminal 01`
                    : `${theme?.restaurantName ? `${theme.restaurantName} • ` : ''}Owner Executive Back-Office`}
                </span>
                <span className="staff-online-dot" title="Workstation Online" />
              </div>

              {/* Branch Selector Pill or Developer Root Badge */}
              {currentRole === 'developer' ? (
                <div style={{ fontSize: 10, color: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span>Platform Superadmin Root</span>
                </div>
              ) : (
                <div
                  className="branch-selector-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    playTapSound();
                    setShowBranchMenu(!showBranchMenu);
                  }}
                >
                  <MapPin size={10} color="#007AFF" />
                  <span>{activeBranch.split('(')[0].trim()}</span>
                  <ChevronDown size={10} />
                </div>
              )}

              {showBranchMenu && (
                <div className="branch-dropdown-menu">
                  {branches.map((b) => (
                    <div
                      key={b}
                      className={`branch-dropdown-item ${activeBranch === b ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        playTapSound();
                        setActiveBranch(b);
                        setShowBranchMenu(false);
                      }}
                    >
                      <CheckCircle2 size={12} color={activeBranch === b ? '#007AFF' : 'transparent'} />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Workstation Switching (Dev, Admin, Counterperson POS) */}
        <nav className="header-center-nav staff-center-nav">
          {/* Developer Superadmin has Master Access */}
          {currentRole === 'developer' && (
            <>
              <button
                className="nav-role-pill active"
                onClick={() => onRoleSwitch('developer')}
                title="Developer Superadmin Console"
                style={{ background: '#0F172A', color: '#38BDF8', borderColor: '#38BDF8' }}
              >
                <Server size={14} color="#38BDF8" />
                <span>Dev Console</span>
              </button>

              <button
                className="nav-role-pill"
                onClick={() => onRoleSwitch('admin')}
                title="Switch to Active Business Owner Admin"
              >
                <BarChart3 size={14} />
                <span>Owner Admin</span>
              </button>

              <button
                className="nav-role-pill"
                onClick={() => onRoleSwitch('counter')}
                title="Switch to Live Counter POS"
              >
                <Layers size={14} />
                <span>Live POS</span>
                {activeOrdersCount > 0 && (
                  <span className="nav-badge-pill">{activeOrdersCount}</span>
                )}
              </button>

              <button
                className="nav-role-pill"
                onClick={() => onRoleSwitch('customer')}
                title="Preview Customer QR Dining Experience"
              >
                <Utensils size={14} color="#007AFF" />
                <span>Customer Menu</span>
              </button>
            </>
          )}

          {/* Admin has Master Access across all stations */}
          {currentRole === 'admin' && (
            <>
              <button
                className="nav-role-pill active"
                onClick={() => onRoleSwitch('admin')}
                title="Sales, Finance, P&L & Checklists"
              >
                <BarChart3 size={14} />
                <span>Owner Admin</span>
              </button>

              <button
                className="nav-role-pill"
                onClick={() => onRoleSwitch('counter')}
                title="Admin Switching to Live Counter POS"
              >
                <Layers size={14} />
                <span>Live POS</span>
                {activeOrdersCount > 0 && (
                  <span className="nav-badge-pill">{activeOrdersCount}</span>
                )}
              </button>
            </>
          )}

          {/* Counterperson: Can access Counter POS (and Admin if logged in as Admin) */}
          {currentRole === 'counter' && (
            <>
              <button
                className="nav-role-pill active"
                onClick={() => onRoleSwitch('counter')}
                title="Live Counter POS Queue & Cash Check"
              >
                <Layers size={14} />
                <span>Live POS</span>
                {activeOrdersCount > 0 && (
                  <span className="nav-badge-pill">{activeOrdersCount}</span>
                )}
              </button>

              {/* If an Admin is operating the counter, allow switching back to Admin */}
              {canReturnToAdmin && (
                <button
                  className="nav-role-pill return-to-admin-pill"
                  onClick={() => onRoleSwitch('admin')}
                  title="Return to Owner Admin"
                  style={{ borderColor: '#8B5CF6', color: '#8B5CF6', background: '#F5F3FF', fontWeight: 600 }}
                >
                  <BarChart3 size={14} />
                  <span>Owner Admin</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* Right: Staff Profile, Sound Toggle, QR Standees, Reset & Logout */}
        <div className="header-right">
          {/* Real-Time Cloud Sync Indicator Pill */}
          <button
            className="btn-secondary-pill cloud-sync-badge-pill"
            onClick={() => {
              playTapSound();
              setShowCloudSyncModal(true);
            }}
            style={{
              padding: '4px 9px',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              borderColor: cloudSyncState.status === 'connected' ? '#BBF7D0' : cloudSyncState.status === 'error' ? '#FECACA' : '#E5E7EB',
              background: cloudSyncState.status === 'connected' ? '#F0FDF4' : cloudSyncState.status === 'error' ? '#FEF2F2' : '#F9FAFB',
              color: cloudSyncState.status === 'connected' ? '#15803D' : cloudSyncState.status === 'error' ? '#DC2626' : '#4B5563'
            }}
            title="Cross-Device Cloud Sync Diagnostics (Tap to inspect)"
          >
            <Cloud size={12} color={cloudSyncState.status === 'connected' ? '#16A34A' : cloudSyncState.status === 'error' ? '#DC2626' : '#64748B'} />
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: cloudSyncState.status === 'connected' ? '#16A34A' : cloudSyncState.status === 'error' ? '#DC2626' : '#9CA3AF'
            }} />
            <span className="cloud-sync-label">
              {cloudSyncState.status === 'connected' ? 'Cloud Live' : cloudSyncState.status === 'error' ? 'Sync Issue' : 'Local Sync'}
            </span>
          </button>

          {/* Active Staff Operator Badge */}
          <div className="header-auth-profile-pill">
            <User size={13} color={currentRole === 'developer' ? '#38BDF8' : '#007AFF'} />
            <span>{currentRole === 'developer' ? 'Root Dev' : currentSession ? currentSession.name.split(' ')[0] : 'Staff'}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentRole === 'developer' ? '#38BDF8' : '#10B981' }} />
          </div>

          {/* Sound Alert Toggle */}
          <button
            className={`nav-icon-btn ${isSoundMuted ? 'muted' : ''}`}
            onClick={() => {
              playTapSound();
              if (onToggleSound) onToggleSound();
            }}
            title={isSoundMuted ? 'Unmute Audio Chime Alerts' : 'Mute Audio Alerts'}
            aria-label="Toggle Sound"
          >
            {isSoundMuted ? <VolumeX size={15} color="#DC2626" /> : <Volume2 size={15} color="#16A34A" />}
          </button>

          {/* Table Standee QR Code Generator Modal Trigger */}
          <button
            className="btn-secondary-pill qr-tent-pill"
            onClick={() => {
              playTapSound();
              if (onOpenTableQr) onOpenTableQr();
            }}
            title="Generate & print contactless table QR standees"
          >
            <QrCode size={13} color="#007AFF" />
            <span className="qr-pill-label">Table QRs</span>
          </button>

          {/* Reset Demo Data Button */}
          <button
            className="btn-secondary-pill reset-demo-pill"
            onClick={onResetDemo}
            title="Reset demonstration data to fresh defaults"
          >
            <RotateCcw size={12} />
            <span className="reset-label">Reset</span>
          </button>

          {/* Exit / Lock Station Button (Returns safely to customer dining view) */}
          <button
            className="btn-secondary-pill staff-exit-pill"
            style={{ color: '#DC2626', borderColor: '#FECACA' }}
            onClick={() => {
              playTapSound();
              if (onLogoutRole) onLogoutRole(currentRole);
            }}
            title="Lock and exit workstation"
          >
            <LogOut size={13} color="#DC2626" />
            <span className="reset-label">Exit Station</span>
          </button>
        </div>
      </header>

      {/* Expandable Search Input Row (for staff menu lookups) */}
      {isSearchOpen && (
        <div className="header-search-bar">
          <div className="search-bar-inner">
            <Search size={16} color="#9CA3AF" />
            <input
              type="text"
              placeholder="Search dishes or recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {/* Cloud Sync Diagnostic & Rules Modal */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
      />
    </>
  );
}
