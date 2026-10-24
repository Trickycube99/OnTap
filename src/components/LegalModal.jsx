import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  Scale,
  RefreshCw,
  Cookie,
  X,
  Printer,
  Mail,
  MapPin,
  Phone,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { COMPANY_LEGAL_INFO } from '../utils/privacyCompliance';
import { playTapSound } from '../utils/audio';

export default function LegalModal({ isOpen, initialTab = 'privacy', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'terms', label: 'Terms of Service', icon: Scale },
    { id: 'refund', label: 'Refund & Cancellation', icon: RefreshCw },
    { id: 'cookie', label: 'Cookie Policy', icon: Cookie },
    { id: 'dmca', label: 'DMCA & Copyright', icon: FileText }
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
      onClick={() => {
        playTapSound();
        onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 22,
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
          color: '#F8FAFC',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(30, 41, 59, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(2, 132, 199, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Scale size={20} color="#38BDF8" aria-hidden="true" />
            </div>
            <div>
              <h2 id="legal-modal-title" style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Legal Documents &amp; Compliance Center
              </h2>
              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
                {COMPANY_LEGAL_INFO.legalName} • Compliance Repository
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#CBD5E1',
                fontSize: 12,
                cursor: 'pointer'
              }}
              aria-label="Print Document"
            >
              <Printer size={14} aria-hidden="true" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: 6,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close Legal Modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Switcher Bar */}
        <div
          style={{
            display: 'flex',
            overflowX: 'auto',
            background: 'rgba(15, 23, 42, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '4px 16px',
            gap: 6
          }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab(tab.id);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? 'rgba(2, 132, 199, 0.2)' : 'transparent',
                  color: isActive ? '#38BDF8' : '#94A3B8',
                  fontSize: 12.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderBottom: isActive ? '2px solid #38BDF8' : '2px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Scrollable Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            lineHeight: 1.6,
            fontSize: 13,
            color: '#CBD5E1'
          }}
        >
          {/* Statutory Registration Banner */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <CheckCircle2 size={18} color="#34D399" style={{ flexShrink: 0 }} aria-hidden="true" />
            <div style={{ fontSize: 11.5, color: '#A7F3D0', lineHeight: 1.4 }}>
              <strong>Official Corporate Entity:</strong> {COMPANY_LEGAL_INFO.legalName} • Registered in Delaware, USA.
              <br />
              U.S. Copyright Office Registration ID: <code>{COMPANY_LEGAL_INFO.registrationId}</code> | Regional Entity: {COMPANY_LEGAL_INFO.regionalOffice}
            </div>
          </div>

          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                Privacy Policy (GDPR, CCPA &amp; DPDP Act 2023)
              </h3>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 16px' }}>
                Effective Date: October 24, 2026 | Dedicated Contact: {COMPANY_LEGAL_INFO.privacyEmail}
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>1. Data Minimization &amp; Optional Fields</h4>
              <p>
                In strict compliance with Section 6(1) of the Digital Personal Data Protection Act, 2023 (DPDP Act) and GDPR Article 5(1)(c),
                order placement and food delivery are <strong>never conditioned</strong> upon the diner submitting a mobile number or diner name.
                Phone numbers are strictly optional to receive digital receipts. If declined, orders seamlessly proceed under guest aliases (e.g. Table 04 Guest).
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>2. No Session Replay or Keystroke Recording (CIPA Compliance)</h4>
              <p>
                We do not deploy third-party session replay software (such as FullStory, LogRocket, or Hotjar). Keystroke recording without affirmative
                prior consent is strictly prohibited under the California Invasion of Privacy Act (Cal. Penal Code § 631). All sensitive form inputs carry
                privacy masking attributes (<code>data-mask="true"</code>, <code>data-private="true"</code>).
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>3. Children's Privacy (COPPA &amp; DPDP Section 9)</h4>
              <p>
                Our services are not directed to individuals under 13 years of age. Diners under 18 must use the QR table ordering client under adult parental supervision.
                We maintain an absolute statutory prohibition on behavioral monitoring, tracking, or targeted marketing directed at minors.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>4. Enforceable Rights &amp; Right to Erasure</h4>
              <p>
                You retain enforceable statutory rights to access, rectify, port, and completely erase your personal data (Right to be Forgotten).
                Restaurant owners may execute instantaneous data deletion via the Admin Settings dashboard or via our automated API endpoint <code>/api/privacy/delete-data</code>.
              </p>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                Terms of Service (Terms &amp; Conditions)
              </h3>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 16px' }}>
                Effective Date: October 24, 2026 | Legal Affairs: {COMPANY_LEGAL_INFO.legalEmail}
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>1. Capacity &amp; Eligibility</h4>
              <p>
                Commercial account creators must be at least 18 years of age (the age of legal majority) to execute binding commercial subscription contracts.
                Users are solely responsible for safeguarding the secrecy of their POS PINs and administrative access keys.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>2. Transparent Billing &amp; 1-Click Cancellation (FTC Negative Option Rule)</h4>
              <p>
                All recurring subscription terms (monthly renewal cadence and renewal amounts) are presented clearly upfront.
                Pursuant to FTC Negative Option guidance and the California Automatic Renewal Law (Cal. Bus. &amp; Prof. Code § 17600),
                subscribers may cancel auto-renewal at any time with <strong>1-click simplicity</strong> in the Admin Dashboard without exit fees, retention traps, or penalty charges.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>3. Independent Merchant Relationship</h4>
              <p>
                OnTap operates as a software provider. Individual restaurants are independent commercial fiduciaries responsible for culinary safety,
                FSSAI/FDA hygiene ratings, allergen declarations, and menu pricing accuracy.
              </p>
            </div>
          )}

          {/* TAB 3: REFUND POLICY */}
          {activeTab === 'refund' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                Refund &amp; Cancellation Policy
              </h3>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 16px' }}>
                Effective Date: October 24, 2026 | Billing &amp; Inquiries: {COMPANY_LEGAL_INFO.billingEmail}
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>1. 14-Day Software Satisfaction Guarantee</h4>
              <p>
                New commercial subscribers may cancel their initial paid plan within 14 calendar days of activation for a full 100% refund.
                Simply email <code>billing@ontap.app</code> or use the in-app cancel button.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>2. Dining Food Orders</h4>
              <p>
                Due to food safety and perishability standards, table order cancellations must be requested prior to kitchen preparation.
                If food items suffer from hygiene defects, incorrect items, or allergen preparation errors, diners are entitled to an immediate free replacement
                or a full refund from the restaurant management.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>3. Processing Timelines</h4>
              <p>
                Approved refunds are credited directly back to the original method of payment (Card or UPI) within 3 to 7 business days.
              </p>
            </div>
          )}

          {/* TAB 4: COOKIE POLICY */}
          {activeTab === 'cookie' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                Cookie &amp; Tracking Technologies Policy
              </h3>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 16px' }}>
                Effective Date: October 24, 2026 | Privacy Office: {COMPANY_LEGAL_INFO.privacyEmail}
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>1. Zero Third-Party Advertising Cookies</h4>
              <p>
                We do not use third-party cross-site trackers or ad network beacons.
                All fonts and web assets are strictly self-hosted locally, eliminating visitor IP address leakage to Google or external CDNs.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>2. Storage Classifications</h4>
              <p>
                • <strong>Strictly Necessary:</strong> HttpOnly authentication session tokens, table QR cryptographic signatures (Browser Tab session).<br />
                • <strong>Functional:</strong> Language selection (English / Hindi), visual theme preferences.<br />
                • <strong>Analytics &amp; Telemetry:</strong> Strictly blocked by default; activated only with explicit affirmative opt-in consent.
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>3. Preference Management</h4>
              <p>
                You can re-open our Cookie Consent Banner and update your granular settings at any time by clicking "Cookie Preferences" in the page footer.
              </p>
            </div>
          )}

          {/* TAB 5: DMCA & COPYRIGHT */}
          {activeTab === 'dmca' && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
                DMCA Designated Agent &amp; Copyright Policy
              </h3>
              <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 16px' }}>
                17 U.S.C. § 512(c)(2) Statutory Directory ID: <code>{COMPANY_LEGAL_INFO.registrationId}</code>
              </p>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>1. Designated Agent Contacts</h4>
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: 14, borderRadius: 12, marginBottom: 14 }}>
                <div><strong>Designated Agent:</strong> Copyright Compliance Officer</div>
                <div><strong>Organization:</strong> {COMPANY_LEGAL_INFO.legalName}</div>
                <div><strong>Address:</strong> {COMPANY_LEGAL_INFO.physicalAddress}</div>
                <div><strong>Designated Email:</strong> <a href={`mailto:${COMPANY_LEGAL_INFO.dmcaEmail}`} style={{ color: '#38BDF8' }}>{COMPANY_LEGAL_INFO.dmcaEmail}</a></div>
                <div><strong>Phone / Fax:</strong> {COMPANY_LEGAL_INFO.phone} | Fax: {COMPANY_LEGAL_INFO.fax}</div>
              </div>

              <h4 style={{ color: '#F1F5F9', fontSize: 14, margin: '16px 0 6px' }}>2. Notice &amp; Takedown Procedure</h4>
              <p>
                To file a valid copyright infringement notice pursuant to 17 U.S.C. § 512(c)(3), provide a written notification containing:
                (1) signature of copyright owner/agent, (2) identification of copyrighted work, (3) identification of infringing URL/material,
                (4) contact info, (5) good faith belief statement, and (6) statement of accuracy under penalty of perjury.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer with Company Business Details */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(30, 41, 59, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 11.5,
            color: '#94A3B8'
          }}
        >
          <div>
            <strong style={{ color: '#CBD5E1' }}>{COMPANY_LEGAL_INFO.legalName}</strong> • {COMPANY_LEGAL_INFO.physicalAddress}
            <br />
            Support: <a href={`mailto:${COMPANY_LEGAL_INFO.supportEmail}`} style={{ color: '#38BDF8', textDecoration: 'none' }}>{COMPANY_LEGAL_INFO.supportEmail}</a> | Phone: {COMPANY_LEGAL_INFO.phone}
          </div>

          <button
            type="button"
            onClick={() => {
              playTapSound();
              onClose();
            }}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: '#0284C7',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
