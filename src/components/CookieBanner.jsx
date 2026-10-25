import React, { useState, useEffect } from 'react';
import { Shield, Cookie, Check, X, ChevronRight, Settings2, Info } from 'lucide-react';
import { getCookieConsent, saveCookieConsent, COOKIE_CONSENT_KEY } from '../utils/privacyCompliance';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function CookieBanner({ forceOpen = false, onClose, onOpenLegal }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      const current = getCookieConsent();
      setAnalyticsConsent(current.analytics);
      setMarketingConsent(current.marketing);
      setShowPreferences(true);
      setIsOpen(true);
      return;
    }

    // Check if user has already decided
    const consent = getCookieConsent();
    if (!consent.decided) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleRejectNonEssential();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAcceptAll = () => {
    playSuccessChime();
    saveCookieConsent({ analytics: true, marketing: true });
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleRejectNonEssential = () => {
    playTapSound();
    saveCookieConsent({ analytics: false, marketing: false });
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleSaveCustom = () => {
    playSuccessChime();
    saveCookieConsent({ analytics: analyticsConsent, marketing: marketingConsent });
    setIsOpen(false);
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and Privacy Consent Banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.6)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        maxHeight: '85vh',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch'
      }}
      className="custom-scrollbar"
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        {/* Main Banner Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: '1 1 500px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(2, 132, 199, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Cookie size={22} color="#38BDF8" aria-hidden="true" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Privacy &amp; Cookie Consent
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  GDPR / CCPA Compliant
                </span>
              </div>

              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: '#CBD5E1', margin: 0 }}>
                We use strictly necessary cookies to secure table QR ordering and staff POS operations.
                Non-essential analytics and marketing cookies are <strong>blocked by default</strong> until you grant affirmative consent.
                All fonts and assets are 100% self-hosted—we never sell your personal data or transmit visitor IP addresses to external ad networks.
              </p>

              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5 }}>
                <button
                  type="button"
                  onClick={() => onOpenLegal && onOpenLegal('cookie')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#38BDF8',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Cookie Policy
                </button>
                <span style={{ color: '#64748B' }}>•</span>
                <button
                  type="button"
                  onClick={() => onOpenLegal && onOpenLegal('privacy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#38BDF8',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              flex: '1 1 auto'
            }}
          >
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setShowPreferences((prev) => !prev);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#E2E8F0',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Settings2 size={15} aria-hidden="true" />
              <span>{showPreferences ? 'Hide Preferences' : 'Customize'}</span>
            </button>

            <button
              type="button"
              onClick={handleRejectNonEssential}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#F1F5F9',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reject Non-Essential
            </button>

            <button
              type="button"
              onClick={handleAcceptAll}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
              }}
            >
              Accept All
            </button>
          </div>
        </div>

        {/* Expandable Granular Category Preferences */}
        {showPreferences && (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Granular Consent Controls
            </div>

            {/* Category 1: Strictly Necessary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <strong style={{ fontSize: 13, color: '#FFFFFF' }}>Strictly Necessary Cookies</strong>
                  <span style={{ fontSize: 10, background: '#0284C7', color: '#FFF', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                    REQUIRED
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Required for table QR cryptographic security, session authentication, and food ordering continuity.
                </div>
              </div>
              <input
                type="checkbox"
                checked={true}
                disabled={true}
                aria-label="Strictly Necessary Cookies (Always Active)"
                style={{ width: 18, height: 18, accentColor: '#0284C7', cursor: 'not-allowed' }}
              />
            </div>

            {/* Category 2: Analytics & Performance */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div>
                <strong style={{ fontSize: 13, color: '#FFFFFF' }}>Analytics &amp; Performance Telemetry</strong>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Aggregated, anonymous latency diagnostics and error diagnostics to help optimize kitchen throughput.
                </div>
              </div>
              <input
                type="checkbox"
                checked={analyticsConsent}
                onChange={(e) => setAnalyticsConsent(e.target.checked)}
                aria-label="Allow Analytics & Performance Telemetry"
                style={{ width: 18, height: 18, accentColor: '#0284C7', cursor: 'pointer' }}
              />
            </div>

            {/* Category 3: Marketing & Offers */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div>
                <strong style={{ fontSize: 13, color: '#FFFFFF' }}>Marketing, Loyalty &amp; Remarketing</strong>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                  Allows dining loyalty clubs, chef special announcements, and personalized seasonal combo discounts.
                </div>
              </div>
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                aria-label="Allow Marketing and Loyalty Offers"
                style={{ width: 18, height: 18, accentColor: '#0284C7', cursor: 'pointer' }}
              />
            </div>

            {/* Save Preferences Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={handleSaveCustom}
                style={{
                  padding: '9px 20px',
                  borderRadius: 10,
                  background: '#0284C7',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Save My Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
