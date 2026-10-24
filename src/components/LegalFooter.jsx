import React, { useState } from 'react';
import { Shield, Cookie, Trash2, ExternalLink } from 'lucide-react';
import { COMPANY_LEGAL_INFO } from '../utils/privacyCompliance';
import LegalModal from './LegalModal';
import CookieBanner from './CookieBanner';
import { playTapSound } from '../utils/audio';

export default function LegalFooter({
  variant = 'light', // 'light' | 'dark'
  restaurantName = '',
  licenseText = '',
  onClearData = null,
  clearDataLabel = 'Clear My Diner Data',
  showCookiePreferences = true,
  style = {}
}) {
  const [legalModalTab, setLegalModalTab] = useState(null);
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  const isDark = variant === 'dark';

  const textColor = isDark ? '#94A3B8' : '#64748B';
  const headingColor = isDark ? '#E2E8F0' : '#334155';
  const linkColor = isDark ? '#38BDF8' : '#007AFF';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
  const buttonBg = isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9';
  const buttonBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1';
  const buttonText = isDark ? '#E2E8F0' : '#334155';

  const handleOpenLegal = (tab) => {
    playTapSound();
    setLegalModalTab(tab);
  };

  return (
    <footer
      role="contentinfo"
      aria-label="Legal documents and business compliance footer"
      style={{
        marginTop: 40,
        padding: '28px 16px 36px',
        borderTop: `1px solid ${borderColor}`,
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.6,
        color: textColor,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        ...style
      }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Optional Restaurant Branding & FSSAI / Health Registration */}
        {(restaurantName || licenseText) && (
          <div style={{ fontWeight: 700, color: headingColor, fontSize: 12.5 }}>
            {restaurantName}
            {licenseText && (
              <span style={{ fontWeight: 500, color: textColor, marginLeft: 6 }}>
                • {licenseText}
              </span>
            )}
          </div>
        )}

        {/* Primary Legal Policies Navigation Row */}
        <nav
          aria-label="Legal Policies and Compliance Links"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px 14px',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          {/* Privacy Policy Link - Prominently Displayed */}
          <button
            type="button"
            onClick={() => handleOpenLegal('privacy')}
            style={{
              background: 'none',
              border: 'none',
              color: linkColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 700
            }}
          >
            <Shield size={13} aria-hidden="true" />
            <span>Privacy Policy</span>
          </button>

          <span style={{ color: isDark ? '#475569' : '#CBD5E1' }} aria-hidden="true">•</span>

          <button
            type="button"
            onClick={() => handleOpenLegal('terms')}
            style={{
              background: 'none',
              border: 'none',
              color: linkColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 4px'
            }}
          >
            Terms of Service
          </button>

          <span style={{ color: isDark ? '#475569' : '#CBD5E1' }} aria-hidden="true">•</span>

          <button
            type="button"
            onClick={() => handleOpenLegal('refund')}
            style={{
              background: 'none',
              border: 'none',
              color: linkColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 4px'
            }}
          >
            Refund &amp; Cancellation Policy
          </button>

          <span style={{ color: isDark ? '#475569' : '#CBD5E1' }} aria-hidden="true">•</span>

          <button
            type="button"
            onClick={() => handleOpenLegal('cookie')}
            style={{
              background: 'none',
              border: 'none',
              color: linkColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 4px'
            }}
          >
            Cookie Policy
          </button>

          <span style={{ color: isDark ? '#475569' : '#CBD5E1' }} aria-hidden="true">•</span>

          <button
            type="button"
            onClick={() => handleOpenLegal('dmca')}
            style={{
              background: 'none',
              border: 'none',
              color: linkColor,
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 4px'
            }}
          >
            DMCA &amp; Copyright Notice
          </button>
        </nav>

        {/* Company Transparency & Registered Physical Details */}
        <div style={{ fontSize: 11, color: textColor, marginTop: 4, lineHeight: 1.5 }}>
          <div>
            Operating Platform: <strong style={{ color: headingColor }}>{COMPANY_LEGAL_INFO.legalName}</strong>
            {' '}(Service Provider / Data Processor)
          </div>
          <div>
            Registered Legal Address: {COMPANY_LEGAL_INFO.physicalAddress}
          </div>
          <div>
            Support &amp; Grievances:{' '}
            <a href={`mailto:${COMPANY_LEGAL_INFO.supportEmail}`} style={{ color: linkColor, textDecoration: 'none' }}>
              {COMPANY_LEGAL_INFO.supportEmail}
            </a>
            {' '}| Privacy Office:{' '}
            <a href={`mailto:${COMPANY_LEGAL_INFO.privacyEmail}`} style={{ color: linkColor, textDecoration: 'none' }}>
              {COMPANY_LEGAL_INFO.privacyEmail}
            </a>
            {' '}| Tel: {COMPANY_LEGAL_INFO.phone}
          </div>
        </div>

        {/* Action Controls: Cookie Preferences & Data Erasure */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
          {showCookiePreferences && (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setShowCookieSettings(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: buttonBg,
                border: `1px solid ${buttonBorder}`,
                color: buttonText,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Cookie size={13} aria-hidden="true" />
              <span>Cookie Preferences</span>
            </button>
          )}

          {onClearData && (
            <button
              type="button"
              onClick={onClearData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(239, 68, 68, 0.25)',
                color: isDark ? '#FCA5A5' : '#DC2626',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>{clearDataLabel}</span>
            </button>
          )}
        </div>

        {/* Copyright Attribution */}
        <div style={{ fontSize: 10.5, color: isDark ? '#64748B' : '#94A3B8', marginTop: 4 }}>
          &copy; {new Date().getFullYear()} {COMPANY_LEGAL_INFO.legalName}. All rights reserved. Self-hosted &amp; GDPR compliant.
        </div>
      </div>

      {/* Embedded Autonomous Legal Documents Modal */}
      <LegalModal
        isOpen={Boolean(legalModalTab)}
        initialTab={legalModalTab || 'privacy'}
        onClose={() => setLegalModalTab(null)}
      />

      {/* Embedded Autonomous Cookie Banner Settings Drawer */}
      <CookieBanner
        forceOpen={showCookieSettings}
        onClose={() => setShowCookieSettings(false)}
        onOpenLegal={(tab) => setLegalModalTab(tab)}
      />
    </footer>
  );
}
