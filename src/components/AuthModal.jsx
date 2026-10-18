import React, { useState } from 'react';
import {
  Lock,
  Layers,
  BarChart3,
  KeyRound,
  User,
  AlertCircle,
  X,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { ROLE_CONFIGS, ROLES, authenticateRole } from '../utils/auth';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';

export default function AuthModal({
  isOpen,
  targetRole = ROLES.COUNTER,
  activeSessionRole = null,
  onSuccess,
  onClose,
  theme,
  staff = []
}) {
  const [selectedStation, setSelectedStation] = useState(null);
  const currentStation = selectedStation || (targetRole === ROLES.ADMIN ? ROLES.ADMIN : ROLES.COUNTER);

  const roleConfig = ROLE_CONFIGS[currentStation] || ROLE_CONFIGS[ROLES.COUNTER];

  const activeStaffList = Array.isArray(staff)
    ? staff.filter((emp) => emp.status !== 'resigned')
    : [];

  // Discrete form state
  const [selectedStaffId, setSelectedStaffId] = useState(() => activeStaffList[0]?.id || '');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPin('');
    setEmail('');
    setShowPin(false);
    setErrorMessage('');
    setSelectedStation(null);
    setSelectedStaffId(activeStaffList[0]?.id || '');
  };

  if (!isOpen) return null;

  // Station switcher tabs - Strictly Counter & Owner Admin
  const allTabs = [
    { id: ROLES.COUNTER, label: 'Counterperson POS', icon: Layers },
    { id: ROLES.ADMIN, label: 'Business Owner Admin', icon: BarChart3 }
  ];

  const allowedTabs = allTabs.filter((t) => {
    if (activeSessionRole === ROLES.COUNTER) {
      return t.id === ROLES.COUNTER;
    }
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    playTapSound();
    setIsSubmitting(true);
    setErrorMessage('');

    let creds = {};
    if (currentStation === ROLES.ADMIN) {
      creds = { email, pin };
    } else {
      creds = {
        staffId: selectedStaffId || activeStaffList[0]?.id || '',
        pin,
        staffList: activeStaffList,
        terminal: 'POS-01 (Flagship CP)'
      };
    }

    // Attempt authentication via abstraction layer
    const result = authenticateRole(currentStation, creds);

    if (result.success) {
      playSuccessChime();
      setTimeout(() => {
        setIsSubmitting(false);
        resetForm();
        onSuccess(result.session, result.business);
      }, 200);
    } else {
      playAlertChime();
      setIsSubmitting(false);
      setErrorMessage(result.error);
    }
  };

  const getRoleIcon = () => {
    switch (currentStation) {
      case ROLES.COUNTER:
        return <Layers size={24} color="#F59E0B" />;
      case ROLES.ADMIN:
        return <BarChart3 size={24} color="#8B5CF6" />;
      default:
        return <Lock size={24} color="#007AFF" />;
    }
  };

  const handleCloseModal = () => {
    playTapSound();
    resetForm();
    onClose();
  };

  const selectedStaffMember = activeStaffList.find((s) => s.id === selectedStaffId);

  return (
    <div className="auth-modal-overlay" onClick={handleCloseModal}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 440 }}
      >
        {/* Modal Header */}
        <div className="auth-modal-header">
          <div className="auth-role-avatar-wrapper">
            <div className={`auth-role-avatar role-${currentStation}`}>
              {getRoleIcon()}
            </div>
            <div>
              <div className="auth-role-badge">
                <Lock size={11} />
                <span>Station Authentication</span>
              </div>
              <h3 className="auth-modal-title">{roleConfig.name}</h3>
            </div>
          </div>
          <button
            className="auth-modal-close-btn"
            onClick={handleCloseModal}
            aria-label="Close authentication modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Station Selector Tabs for Staff / Owner */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allowedTabs.length}, 1fr)`, gap: 6, margin: '10px 0 14px' }}>
          {allowedTabs.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`btn-secondary-pill ${currentStation === st.id ? 'active' : ''}`}
              style={{
                padding: '7px 4px',
                fontSize: 11,
                fontWeight: 600,
                justifyContent: 'center',
                background: currentStation === st.id ? '#EFF6FF' : '#F9FAFB',
                borderColor: currentStation === st.id ? '#007AFF' : '#E5E7EB',
                color: currentStation === st.id ? '#007AFF' : 'var(--text-secondary)'
              }}
              onClick={() => {
                playTapSound();
                setSelectedStation(st.id);
                setErrorMessage('');
              }}
            >
              <st.icon size={13} />
              <span>{st.label}</span>
            </button>
          ))}
        </div>

        {/* Security Description */}
        <div className="auth-security-banner">
          <div className="auth-security-pill">
            <KeyRound size={12} color="#007AFF" />
            <span>{roleConfig.securityLevel}</span>
          </div>
          <p className="auth-description">{roleConfig.description}</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="auth-error-banner">
            <AlertCircle size={16} color="#EF4444" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dynamic Form based on Target Role */}
        <form onSubmit={handleSubmit} className="auth-modal-form">
          {/* COUNTER POS FORM: Staff Identity & Secret PIN */}
          {currentStation === ROLES.COUNTER && (
            <>
              {activeStaffList.length > 0 && (
                <div className="auth-input-group" style={{ marginBottom: 12 }}>
                  <label className="auth-label">
                    <User size={13} />
                    <span>Staff Member Profile *</span>
                  </label>
                  <select
                    className="auth-input"
                    value={selectedStaffId || activeStaffList[0]?.id}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setErrorMessage('');
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    <optgroup label="Registered Counter Staff">
                      {activeStaffList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} — {emp.role} {emp.loginId ? `(@${emp.loginId})` : ''}
                        </option>
                      ))}
                    </optgroup>
                    <option value="__owner_admin__">
                      👑 Business Owner (Master Override)
                    </option>
                  </select>
                  {selectedStaffMember && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, color: '#64748B' }}>
                      <ShieldCheck size={12} color="#16A34A" />
                      <span>Login ID: <strong>{selectedStaffMember.loginId || `${selectedStaffMember.name.toLowerCase().replace(/\s+/g, '')}.pos`}</strong></span>
                    </div>
                  )}
                </div>
              )}

              <div className="auth-input-group">
                <label className="auth-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={13} />
                    <span>4-Digit Secret POS PIN *</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPin ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter your 4-Digit Secret PIN"
                    className="auth-input"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={{ letterSpacing: showPin ? 'normal' : '0.15em', fontWeight: 700 }}
                  />
                </div>
                <span className="auth-hint">Enter your personal 4-digit staff PIN (or Owner master PIN) to unlock this station.</span>
              </div>
            </>
          )}

          {/* ADMIN OWNER FORM */}
          {currentStation === ROLES.ADMIN && (
            <>
              <div className="auth-input-group">
                <label className="auth-label">
                  <User size={13} />
                  <span>Business Owner Login Email *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@advaitkitchen.com"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={13} />
                    <span>Master Owner PIN / Password *</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showPin ? 'Hide' : 'Show'}</span>
                  </button>
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="Enter Master Owner PIN"
                  className="auth-input"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  style={{ letterSpacing: showPin ? 'normal' : '0.15em', fontWeight: 700 }}
                />
                <span className="auth-hint">Authenticates against your specific registered business account.</span>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="auth-actions-row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn-secondary-pill auth-cancel-btn"
              onClick={() => {
                playTapSound();
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary-pill auth-submit-btn"
            >
              <span>{isSubmitting ? 'Verifying...' : `Unlock ${roleConfig.shortName}`}</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
