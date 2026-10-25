import React from 'react';
import { Shield, X, Mail, Phone, MapPin, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';
import { playTapSound } from '../utils/audio';
import SlideModal from './SlideModal';

export default function DmcaModal({ isOpen, onClose }) {
  return (
    <SlideModal
      isOpen={isOpen}
      onClose={onClose}
      isDark={true}
      maxWidth={620}
      ariaLabel="DMCA Designated Agent Directory"
      contentStyle={{ padding: '20px 24px' }}
    >
      {({ dismiss }) => (
        <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Shield size={20} color="#38BDF8" />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                DMCA Designated Agent Directory
              </h2>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                17 U.S.C. § 512(c)(2) Statutory Notice & Takedown Registry
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              dismiss();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: 4
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Directory Registration Status */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <CheckCircle2 size={18} color="#34D399" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 11.5, color: '#A7F3D0', lineHeight: 1.4 }}>
            <strong>U.S. Copyright Office Registration ID:</strong>{' '}
            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, color: '#FFFFFF' }}>
              DMCA-1049281
            </code>
            <br />
            Registered Service Provider: <em>OnTap Technologies Inc.</em> Pursuant to 17 U.S.C. § 512(c)(2).
          </div>
        </div>

        {/* Contact Details Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Statutory Designated Agent Contacts
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <MapPin size={16} color="#94A3B8" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#F1F5F9' }}>Physical Legal Address:</strong>
                <div style={{ color: '#CBD5E1', marginTop: 2 }}>
                  OnTap Technologies<br />
                  Attn: Copyright Compliance Officer (DMCA Agent)<br />
                  Shastri Nagar, Dehradun<br />
                  Uttarakhand 248001, India
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mail size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#F1F5F9' }}>Designated Email:</strong>{' '}
                <a href="mailto:dmca@ontap.app" style={{ color: '#38BDF8', textDecoration: 'none', fontWeight: 600 }}>
                  dmca@ontap.app
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Phone size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#F1F5F9' }}>Telephone / Fax:</strong>{' '}
                <span style={{ color: '#CBD5E1' }}>+1 (302) 555-0199 | Fax: +1 (302) 555-0198</span>
              </div>
            </div>
          </div>
        </div>

        {/* Takedown Process Outline */}
        <div style={{ fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5, marginBottom: 16 }}>
          <strong style={{ color: '#E2E8F0', display: 'block', marginBottom: 6 }}>
            Requirements for Statutory Takedown Notices (§ 512(c)(3)):
          </strong>
          To submit a valid notice, include: (1) physical/electronic signature, (2) identification of copyrighted work,
          (3) identification and URL/location of the infringing material, (4) complaining party contact info, (5) good faith belief statement,
          and (6) statement of accuracy under penalty of perjury. Repeat infringers' accounts are terminated under § 512(i).
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              dismiss();
            }}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              background: '#0284C7',
              border: 'none',
              color: '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
      )}
    </SlideModal>
  );
}
