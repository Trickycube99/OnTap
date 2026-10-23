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
  Mail,
  CheckCircle2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { ROLE_CONFIGS, ROLES, authenticateRole } from '../utils/auth';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import {
  logInUserWithVerification,
  sendPasswordReset,
  resendVerificationLink
} from '../utils/firebaseAuth';

export default function AuthModal({
  isOpen,
  targetRole = ROLES.ADMIN,
  activeSessionRole = null,
  onSuccess,
  onClose,
  theme: _theme
}) {
  const [selectedStation, setSelectedStation] = useState(null);
  const currentStation = selectedStation || (targetRole === ROLES.COUNTER ? ROLES.COUNTER : ROLES.ADMIN);

  const roleConfig = ROLE_CONFIGS[currentStation] || ROLE_CONFIGS[ROLES.COUNTER];

  // Form states: login vs forgot password (Accounts can only be created via Developer Dashboard)
  const [adminAuthMode, setAdminAuthMode] = useState('login'); // 'login' | 'forgot'
  const [counterLoginId, setCounterLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isUnverifiedError, setIsUnverifiedError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const resetForm = () => {
    setPin('');
    setCounterLoginId('');
    setEmail('');
    setShowPin(false);
    setErrorMessage('');
    setIsUnverifiedError(false);
    setSuccessMessage('');
    setIsSubmitting(false);
    setIsResending(false);
    setAdminAuthMode('login');
    setSelectedStation(null);
  };

  if (!isOpen) return null;

  // Station switcher tabs - Strictly Counter & Owner Admin
  const allTabs = [
    { id: ROLES.COUNTER, label: 'Cashier Counter', icon: Layers },
    { id: ROLES.ADMIN, label: 'Store Owner', icon: BarChart3 }
  ];

  const allowedTabs = allTabs.filter((t) => {
    if (activeSessionRole === ROLES.COUNTER) {
      return t.id === ROLES.COUNTER;
    }
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    playTapSound();
    setIsSubmitting(true);
    setErrorMessage('');
    setIsUnverifiedError(false);
    setSuccessMessage('');

    // --- 1. COUNTERPERSON POS AUTHENTICATION ---
    if (currentStation === ROLES.COUNTER) {
      const trimmedLoginId = counterLoginId.trim();
      const trimmedPin = pin.trim();

      if (!trimmedLoginId) {
        playAlertChime();
        setIsSubmitting(false);
        setErrorMessage('Please enter your Staff Login ID (e.g. @username.pos).');
        return;
      }

      if (!trimmedPin || !/^\d{4,6}$/.test(trimmedPin)) {
        playAlertChime();
        setIsSubmitting(false);
        setErrorMessage('Staff POS PIN must be 4 to 6 numeric digits.');
        return;
      }

      const creds = {
        loginId: trimmedLoginId,
        pin: trimmedPin,
        terminal: 'POS-01 (Flagship CP)'
      };

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
      return;
    }

    // --- 2. BUSINESS OWNER AUTHENTICATION ---
    if (currentStation === ROLES.ADMIN) {
      // Flow A: Forgot Password / Password Reset Link
      if (adminAuthMode === 'forgot') {
        const res = await sendPasswordReset({ email });
        if (res.success) {
          playSuccessChime();
          setIsSubmitting(false);
          setSuccessMessage(res.message);
        } else {
          playAlertChime();
          setIsSubmitting(false);
          setErrorMessage(res.error);
        }
        return;
      }

      // Flow B: User Log In with Strict Verification Check (blocks unverified accounts)
      if (!/^\d{6}$/.test(pin.trim())) {
        playAlertChime();
        setIsSubmitting(false);
        setErrorMessage('Owner Master PIN must be exactly 6 numeric digits.');
        return;
      }

      const res = await logInUserWithVerification({
        email,
        password: pin.trim()
      });

      if (res.success) {
        playSuccessChime();
        setTimeout(() => {
          setIsSubmitting(false);
          resetForm();
          onSuccess(res.session, res.business);
        }, 200);
      } else {
        playAlertChime();
        setIsSubmitting(false);
        setErrorMessage(res.error);
        if (res.isUnverified) {
          setIsUnverifiedError(true);
        }
      }
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setErrorMessage('Please enter your email address to resend the verification link.');
      return;
    }
    if (!pin) {
      setErrorMessage('Please enter your password / Master PIN to resend the verification email.');
      return;
    }
    setIsResending(true);
    setErrorMessage('');
    playTapSound();

    const res = await resendVerificationLink({ email, password: pin });
    setIsResending(false);

    if (res.success) {
      playSuccessChime();
      setSuccessMessage(res.message);
      setIsUnverifiedError(false);
    } else {
      playAlertChime();
      setErrorMessage(res.error);
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

  return (
    <div className="auth-modal-overlay" onClick={handleCloseModal}>
      <div
        className="auth-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 450 }}
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
                <span>
                  {currentStation === ROLES.ADMIN
                    ? adminAuthMode === 'forgot'
                      ? 'Reset Password'
                      : 'Owner Login'
                    : 'Cashier Login'}
                </span>
              </div>
              <h3 className="auth-modal-title">
                {currentStation === ROLES.ADMIN
                  ? adminAuthMode === 'forgot'
                    ? 'Reset Password'
                    : 'Store Owner Login'
                  : 'Cashier Counter Login'}
              </h3>
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
                setIsUnverifiedError(false);
                setSuccessMessage('');
                setAdminAuthMode('login');
              }}
            >
              <st.icon size={13} />
              <span>{st.label}</span>
            </button>
          ))}
        </div>

        {/* Security / Context Description */}
        <div className="auth-security-banner">
          <div className="auth-security-pill">
            <KeyRound size={12} color="#007AFF" />
            <span>
              {currentStation === ROLES.ADMIN
                ? adminAuthMode === 'forgot'
                  ? 'Password Reset'
                  : 'Owner Login'
                : 'Cashier Login'}
            </span>
          </div>
          <p className="auth-description">
            {currentStation === ROLES.ADMIN
              ? adminAuthMode === 'forgot'
                ? 'Enter your registered email address to receive a password reset link.'
                : 'Sign in to view today\'s sales, menu, and orders.'
              : 'Enter your Cashier Login ID and 6-digit PIN to open the billing counter.'}
          </p>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
              fontWeight: 500,
              color: '#15803D',
              marginBottom: 14,
              lineHeight: 1.45
            }}
          >
            <CheckCircle2 size={16} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ flex: 1 }}>{successMessage}</span>
          </div>
        )}

        {/* Error Alert Banner with Resend Verification action */}
        {errorMessage && (
          <div
            className="auth-error-banner"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 8,
              marginBottom: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, lineHeight: 1.4 }}>{errorMessage}</span>
            </div>

            {/* Quick Resend Verification Action if Account is Blocked */}
            {isUnverifiedError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '8px 10px',
                  borderRadius: 8,
                  marginTop: 4,
                  gap: 8
                }}
              >
                <span style={{ fontSize: 11, color: '#991B1B', fontWeight: 500 }}>
                  Need a new verification email?
                </span>
                <button
                  type="button"
                  disabled={isResending}
                  onClick={handleResendVerification}
                  style={{
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: isResending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  <RefreshCw size={11} className={isResending ? 'spinning' : ''} />
                  <span>{isResending ? 'Sending Link...' : 'Resend Email'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Form based on Target Role & Admin Mode */}
        <form onSubmit={handleSubmit} className="auth-modal-form">
          {/* ============================================================== */}
          {/* COUNTERPERSON POS FORM (STRICT MANUAL LOGIN ID & PIN)          */}
          {/* ============================================================== */}
          {currentStation === ROLES.COUNTER && (
            <>
              <div className="auth-input-group" style={{ marginBottom: 14 }}>
                <label className="auth-label">
                  <User size={13} />
                  <span>Cashier Login ID *</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    placeholder="Enter Cashier Login ID"
                    className="auth-input"
                    value={counterLoginId}
                    onChange={(e) => {
                      setCounterLoginId(e.target.value);
                      setErrorMessage('');
                      setIsUnverifiedError(false);
                    }}
                    style={{ fontWeight: 600, letterSpacing: '0.02em' }}
                  />
                </div>
                <span className="auth-hint">
                  Enter the Cashier Login ID for this restaurant.
                </span>
              </div>

              <div className="auth-input-group">
                <label className="auth-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={13} />
                    <span>6-Digit PIN *</span>
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
                    autoComplete="off"
                    placeholder="••••••"
                    className="auth-input"
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={pin}
                    onKeyDown={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const cleaned = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                      setPin(cleaned);
                      setErrorMessage('');
                    }}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setErrorMessage('');
                    }}
                    style={{ letterSpacing: showPin ? 'normal' : '0.2em', fontWeight: 700 }}
                  />
                </div>
                <span className="auth-hint">
                  Enter your 6-digit cashier PIN.
                </span>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* BUSINESS OWNER: 1. LOG IN (BLOCKS UNVERIFIED ACCOUNTS)         */}
          {/* ============================================================== */}
          {currentStation === ROLES.ADMIN && adminAuthMode === 'login' && (
            <>
              <div className="auth-input-group">
                <label className="auth-label">
                  <Mail size={13} />
                  <span>Owner Email *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="auth-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <label className="auth-label" style={{ margin: 0 }}>
                    <KeyRound size={13} />
                    <span>Owner 6-Digit PIN *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setAdminAuthMode('forgot');
                      setErrorMessage('');
                      setIsUnverifiedError(false);
                      setSuccessMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#007AFF',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="Enter 6-digit PIN"
                    className="auth-input"
                    value={pin}
                    onKeyDown={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const cleaned = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
                      setPin(cleaned);
                      setErrorMessage('');
                    }}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      paddingRight: 40,
                      letterSpacing: showPin ? 'normal' : '0.25em',
                      fontWeight: 700
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748B',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className="auth-hint">Platform Requirement: Exactly 6 numeric digits. Accounts remain suspended until email is verified.</span>
              </div>
            </>
          )}

          {/* ============================================================== */}
          {/* BUSINESS OWNER: 2. FORGOT PASSWORD (PASSWORD RESET LINK)       */}
          {/* ============================================================== */}
          {currentStation === ROLES.ADMIN && adminAuthMode === 'forgot' && (
            <>
              <div className="auth-input-group">
                <label className="auth-label">
                  <Mail size={13} />
                  <span>Registered Owner Email Address *</span>
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="e.g. owner@example.com"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span className="auth-hint">We will dispatch an authorized password reset link to this email.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setAdminAuthMode('login');
                    setErrorMessage('');
                    setIsUnverifiedError(false);
                    setSuccessMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>Back to Sign In</span>
                </button>
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
              style={{
                background: currentStation === ROLES.ADMIN ? '#8B5CF6' : undefined
              }}
            >
              <span>
                {isSubmitting
                  ? currentStation === ROLES.ADMIN && adminAuthMode === 'forgot'
                    ? 'Sending Link...'
                    : 'Verifying...'
                  : currentStation === ROLES.ADMIN
                  ? adminAuthMode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Sign In to Back-Office'
                  : `Unlock ${roleConfig.shortName}`}
              </span>
              <ChevronRight size={15} />
            </button>
          </div>
        </form>

        {/* Informative Footer note: accounts created only via Developer Dashboard */}
        {currentStation === ROLES.ADMIN && adminAuthMode === 'login' && (
          <div style={{
            textAlign: 'center',
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid #F1F5F9',
            fontSize: 11,
            color: '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            <Lock size={11} color="#94A3B8" />
            <span>New accounts are provisioned exclusively via Developer Dashboard</span>
          </div>
        )}
      </div>
    </div>
  );
}
