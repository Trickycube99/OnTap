import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  Building2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import {
  handleVerifyEmailAction,
  handleVerifyPasswordResetCode,
  handleConfirmPasswordReset
} from '../utils/firebaseAuth';
import { playSuccessChime, playAlertChime, playTapSound } from '../utils/audio';

export default function AuthActionView({
  actionState,
  onOpenLogin,
  theme = {}
}) {
  const { mode = 'verifyEmail', oobCode = '' } = actionState || {};

  const [status, setStatus] = useState(mode === 'verifyEmail' ? 'verifying' : 'loading');
  const [targetEmail, setTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize Action Handler
  useEffect(() => {
    let isMounted = true;

    async function processAction() {
      // 1. EMAIL VERIFICATION FLOW
      if (mode === 'verifyEmail') {
        setStatus('verifying');
        const res = await handleVerifyEmailAction(oobCode);
        if (!isMounted) return;

        if (res.success) {
          playSuccessChime();
          setStatus('verified');
          setSuccessMessage('Email verified, you can now login');
        } else {
          playAlertChime();
          setStatus('error');
          setErrorMessage(res.error || 'Failed to verify email. The link may have expired or already been used.');
        }
      }

      // 2. PASSWORD RESET FLOW
      else if (mode === 'resetPassword') {
        setStatus('loading');
        const res = await handleVerifyPasswordResetCode(oobCode);
        if (!isMounted) return;

        if (res.success) {
          setTargetEmail(res.email || 'your account');
          setStatus('resetForm');
        } else {
          playAlertChime();
          setStatus('error');
          setErrorMessage(res.error || 'This password reset link is invalid or has already expired.');
        }
      } else {
        setStatus('error');
        setErrorMessage('Unknown authentication action code.');
      }
    }

    processAction();

    return () => {
      isMounted = false;
    };
  }, [mode, oobCode]);

  // Handle Password Reset Form Submission
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    playTapSound();
    setErrorMessage('');

    if (!/^\d{6}$/.test(newPassword)) {
      setErrorMessage('Master PIN must be exactly 6 numeric digits (e.g. 882100).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('PINs do not match. Please re-enter.');
      return;
    }

    setIsSubmitting(true);
    const res = await handleConfirmPasswordReset(oobCode, newPassword, targetEmail);
    setIsSubmitting(false);

    if (res.success) {
      playSuccessChime();
      setStatus('resetSuccess');
      setSuccessMessage('Password changed for your email. Please go to the login page and try again.');
    } else {
      playAlertChime();
      setErrorMessage(res.error || 'Failed to change password. Please try again or request a new reset link.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: 'radial-gradient(ellipse at 50% 20%, #1E1B4B 0%, #0F172A 50%, #030712 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
      color: '#F8FAFC',
      fontFamily: 'inherit'
    }}>
      {/* Decorative Ambient Background Glows */}
      <div style={{
        position: 'absolute',
        width: 480,
        height: 480,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 70%)',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* Main Glassmorphic Card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        maxWidth: 480,
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 24,
        padding: '36px 32px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 50px rgba(139, 92, 246, 0.15)',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {/* Brand Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: 11,
          fontWeight: 700,
          color: '#CBD5E1',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 20
        }}>
          <Sparkles size={12} color="#A78BFA" />
          <span>{theme.restaurantName || 'Flowscape Restaurant OS'}</span>
        </div>

        {/* ============================================================== */}
        {/* 1. VERIFYING EMAIL: LOADING STATE                              */}
        {/* ============================================================== */}
        {status === 'verifying' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1.5px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <RefreshCw size={32} color="#38BDF8" className="spinning" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#F8FAFC' }}>
              Verifying Your Email...
            </h2>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              Connecting to secure authentication service and validating your verification link token.
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. EMAIL VERIFIED: SUCCESS STATE                               */}
        {/* ============================================================== */}
        {status === 'verified' && (
          <div>
            <div style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 70%)',
              border: '2px solid rgba(16, 185, 129, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)'
            }}>
              <CheckCircle2 size={42} color="#10B981" />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: '#F8FAFC' }}>
              Email Verified Successfully!
            </h2>

            {/* Requested exact phrase highlight box */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: '#34D399',
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              {successMessage || 'Email verified, you can now login'}
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 24px', lineHeight: 1.5 }}>
              Your business owner credentials are now active. You have full access to real-time sales KPIs, POS management, and accounting.
            </p>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onOpenLogin();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Go to Owner Login</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. RESET PASSWORD FORM STATE                                  */}
        {/* ============================================================== */}
        {status === 'resetForm' && (
          <div>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1.5px solid rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.25)'
            }}>
              <KeyRound size={32} color="#A78BFA" />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#F8FAFC' }}>
              Create New Master PIN
            </h2>

            {targetEmail && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: '#93C5FD',
                fontFamily: 'monospace',
                marginBottom: 16
              }}>
                <Mail size={12} />
                <span>{targetEmail}</span>
              </div>
            )}

            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px', lineHeight: 1.45 }}>
              Enter an authorized 6-digit numeric Master PIN to restore access to your owner dashboard.
            </p>

            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#F87171',
                marginBottom: 16,
                textAlign: 'left'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                  New 6-Digit Master PIN *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    maxLength={6}
                    pattern="[0-9]*"
                    inputMode="numeric"
                    placeholder="Enter 6-digit PIN (e.g. 882100)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      width: '100%',
                      padding: '11px 40px 11px 14px',
                      borderRadius: 12,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1.5px solid rgba(255, 255, 255, 0.15)',
                      color: '#F59E0B',
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: showPassword ? 'normal' : '0.25em',
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
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#CBD5E1', marginBottom: 4 }}>
                  Confirm 6-Digit Master PIN *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="Re-enter 6-digit PIN"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1.5px solid rgba(255, 255, 255, 0.15)',
                    color: '#F59E0B',
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: showPassword ? 'normal' : '0.25em',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: '13px 20px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 18px rgba(139, 92, 246, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={14} className="spinning" />
                    <span>Updating Master PIN...</span>
                  </>
                ) : (
                  <>
                    <span>Save New Master PIN</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. PASSWORD RESET: SUCCESS STATE                               */}
        {/* ============================================================== */}
        {status === 'resetSuccess' && (
          <div>
            <div style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 70%)',
              border: '2px solid rgba(16, 185, 129, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)'
            }}>
              <CheckCircle2 size={42} color="#10B981" />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: '#F8FAFC' }}>
              Password Changed Successfully!
            </h2>

            {/* Requested exact phrase highlight box */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: '#34D399',
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              {successMessage || 'Password changed for your email, please go to the login page and try again.'}
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 24px', lineHeight: 1.5 }}>
              Your account password has been updated. You can now use your new password to sign into the Owner Back-Office.
            </p>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onOpenLogin();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <span>Go to Owner Login</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. ERROR STATE (INVALID CODE / EXPIRED LINK)                   */}
        {/* ============================================================== */}
        {status === 'error' && (
          <div>
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px'
            }}>
              <AlertCircle size={36} color="#EF4444" />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#F8FAFC' }}>
              Link Expired or Invalid
            </h2>

            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 12,
              color: '#F87171',
              marginBottom: 20,
              lineHeight: 1.5
            }}>
              {errorMessage || 'This authentication link is no longer valid. It may have already been used or expired.'}
            </div>

            <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 20px' }}>
              If your email is already verified, you can proceed directly to log in:
            </p>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onOpenLogin();
              }}
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 12,
                background: '#0284C7',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <span>Go to Owner Login</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
