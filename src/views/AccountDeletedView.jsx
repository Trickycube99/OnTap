import React from 'react';
import { Trash2, ShieldCheck, ArrowRight, Building2, Store, RefreshCw } from 'lucide-react';
import { getBusinesses, setActiveBusiness } from '../utils/businessManager';

export default function AccountDeletedView({ deletedInfo, onResetToHome, onOpenSetup }) {
  const businesses = getBusinesses();
  const deletedName = deletedInfo?.businessName || 'Restaurant';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'linear-gradient(180deg, #090D16 0%, #0F172A 100%)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 24,
          padding: '36px 28px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(239, 68, 68, 0.12)',
          backdropFilter: 'blur(20px)',
          textAlign: 'center'
        }}
      >
        {/* Status Badge Icon */}
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 24,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 22px',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)'
          }}
        >
          <Trash2 size={36} color="#EF4444" />
        </div>

        {/* Status Pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Account Closed
          </span>
        </div>

        {/* Primary Headline */}
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px', color: '#FFFFFF', letterSpacing: '-0.02em' }}>
          Account and Data Deleted
        </h1>

        <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, margin: '0 0 26px' }}>
          The business account <strong style={{ color: '#F1F5F9' }}>"{deletedName}"</strong> and all its operational data have been permanently deleted.
        </p>

        {/* Summary Info Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <ShieldCheck size={18} color="#F87171" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', marginBottom: 2 }}>
                Account Permanently Closed
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
                Owner credentials, staff access, and dashboards for this restaurant are no longer active.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <Store size={18} color="#38BDF8" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', marginBottom: 2 }}>
                Menu & Ordering Inactive
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>
                Table QR standees and digital ordering links for this restaurant are deactivated.
              </div>
            </div>
          </div>
        </div>

        {/* Available Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {businesses.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                const first = businesses[0];
                if (first?.id) {
                  setActiveBusiness(first.id);
                  if (typeof window !== 'undefined') {
                    window.location.href = window.location.pathname;
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
              }}
            >
              <RefreshCw size={17} />
              <span>Switch to Available Restaurant ({businesses[0]?.name})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSetup || (() => {
                if (typeof window !== 'undefined') {
                  window.location.hash = 'manj';
                  window.location.reload();
                }
              })}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Building2 size={17} />
              <span>Register New Restaurant</span>
            </button>
          )}

          <button
            type="button"
            onClick={onResetToHome || (() => {
              if (typeof window !== 'undefined') {
                window.location.href = window.location.pathname;
              }
            })}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 14,
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'transparent',
              color: '#CBD5E1',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            <span>Return to Home</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
