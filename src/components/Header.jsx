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
  setActiveTable: _setActiveTable,
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
  const [cloudSyncState, setCloudSyncState] = useState(getCloudSyncState());
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  React.useEffect(() => {
    const unsub = subscribeCloudSyncState(setCloudSyncState);
    return unsub;
  }, []);

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
                  <span>{(theme?.restaurantName || 'RS').substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="brand-info">
                <div className="brand-name-row">
                  <span className="brand-title">{theme?.restaurantName || 'Restaurant'}</span>
                </div>
                <div className="fssai-micro-badge" title={theme?.fssai ? `FSSAI Lic: ${theme.fssai}` : undefined}>
                  <ShieldCheck size={11} color="#16A34A" />
                  <span>{theme?.fssai ? `FSSAI Lic #${theme.fssai}` : 'Clean Dining Certified'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Table / Station Badge (Strictly Locked to Scanned Physical QR Code) */}
          <div className="header-center-table">
            <div
              className="customer-table-pill fixed-table-pill"
              title={`QR Verified: ${activeTable} (Scan physical QR code to change)`}
            >
              <QrCode size={13} color="#16A34A" />
              <span className="table-name-text">{activeTable}</span>
            </div>
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
                    ? `${theme?.restaurantName ? `${theme.restaurantName} • ` : ''}Billing Counter`
                    : `${theme?.restaurantName ? `${theme.restaurantName} • ` : ''}Manager Dashboard`}
                </span>
              </div>

              {currentRole === 'developer' && (
                <div style={{ fontSize: 10, color: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span>Platform Superadmin Root</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Workstation Switching (Admin, Counterperson POS) */}
        <nav className="header-center-nav staff-center-nav">

          {/* Admin has Master Access across all stations */}
          {currentRole === 'admin' && (
            <>
              <button
                className="nav-role-pill active"
                onClick={() => onRoleSwitch('admin')}
                title="Sales, Finance, Menu & Staff"
              >
                <BarChart3 size={14} />
                <span>Owner Dashboard</span>
              </button>

              <button
                className="nav-role-pill"
                onClick={() => onRoleSwitch('counter')}
                title="Switch to Billing Counter"
              >
                <Layers size={14} />
                <span>Billing Counter</span>
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
                title="Kitchen Orders & Billing"
              >
                <Layers size={14} />
                <span>Billing Counter</span>
                {activeOrdersCount > 0 && (
                  <span className="nav-badge-pill">{activeOrdersCount}</span>
                )}
              </button>

              {/* If an Admin is operating the counter, allow switching back to Admin */}
              {canReturnToAdmin && (
                <button
                  className="nav-role-pill return-to-admin-pill"
                  onClick={() => onRoleSwitch('admin')}
                  title="Return to Owner Dashboard"
                  style={{ borderColor: '#8B5CF6', color: '#8B5CF6', background: '#F5F3FF', fontWeight: 600 }}
                >
                  <BarChart3 size={14} />
                  <span>Owner Dashboard</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* Right: Staff Profile, Sound Toggle, QR Standees, Reset & Logout */}
        <div className="header-right">
          {/* Mobile Workstation Switcher (visible only on mobile viewports <= 768px) */}
          <div className="mobile-station-switch">
            {currentRole === 'admin' && (
              <button
                className="btn-secondary-pill mobile-switch-pill"
                onClick={() => {
                  playTapSound();
                  onRoleSwitch('counter');
                }}
                title="Switch to Billing Counter"
                style={{ color: '#007AFF', borderColor: '#BFDBFE', background: '#EFF6FF', fontWeight: 600 }}
              >
                <Layers size={13} color="#007AFF" />
                <span>POS{activeOrdersCount > 0 ? ` (${activeOrdersCount})` : ''}</span>
              </button>
            )}
            {currentRole === 'counter' && canReturnToAdmin && (
              <button
                className="btn-secondary-pill mobile-switch-pill"
                onClick={() => {
                  playTapSound();
                  onRoleSwitch('admin');
                }}
                title="Return to Owner Dashboard"
                style={{ color: '#8B5CF6', borderColor: '#DDD6FE', background: '#F5F3FF', fontWeight: 600 }}
              >
                <BarChart3 size={13} color="#8B5CF6" />
                <span>Admin</span>
              </button>
            )}
          </div>

          {/* Active Staff Operator Badge */}
          <div className="header-auth-profile-pill">
            <User size={13} color={currentRole === 'developer' ? '#38BDF8' : '#007AFF'} />
            <span>{currentRole === 'developer' ? 'Root Dev' : currentSession ? currentSession.name.split(' ')[0] : 'Staff'}</span>
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
