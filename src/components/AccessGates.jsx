import React from 'react';
import { ShieldCheck, Lock, BarChart3, QrCode, Layers, ArrowRight } from 'lucide-react';
import { playTapSound } from '../utils/audio';

/**
 * AdminOwnerLoginGate
 * Displays when unauthenticated users access the default root route (/) or #admin
 */
export function AdminOwnerLoginGate({ onOpenLogin, onSwitchRole, theme }) {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#FFFFFF'
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          padding: '44px 32px 36px',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 50px rgba(99, 102, 241, 0.18)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Ambient Top Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '240px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        {/* Branding Icon / Logo */}
        {theme?.logo ? (
          <img
            src={theme.logo}
            alt={theme?.restaurantName || 'Restaurant Logo'}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '20px',
              objectFit: 'cover',
              margin: '0 auto 20px',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
            }}
          />
        ) : (
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 12px 28px -6px rgba(99, 102, 241, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <ShieldCheck size={36} color="#FFFFFF" />
          </div>
        )}

        {/* Pill Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            color: '#A5B4FC',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '16px'
          }}
        >
          <Lock size={12} /> Owner Back-Office
        </div>

        <h1
          style={{
            fontSize: '26px',
            fontWeight: 800,
            margin: '0 0 10px',
            letterSpacing: '-0.025em',
            color: '#F8FAFC'
          }}
        >
          {theme?.restaurantName || 'Restaurant'} Management Portal
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#94A3B8',
            margin: '0 auto 28px',
            lineHeight: 1.6,
            maxWidth: '420px'
          }}
        >
          Welcome to the executive back-office portal. Sign in with your verified owner credentials to access live sales telemetry, menu engineering, staff rosters, and financial records.
        </p>

        {/* Main Sign In Action */}
        <button
          onClick={() => {
            playTapSound();
            onOpenLogin();
          }}
          style={{
            width: '100%',
            padding: '15px 24px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 12px 28px -6px rgba(99, 102, 241, 0.5)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            marginBottom: '22px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 16px 32px -6px rgba(99, 102, 241, 0.65)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(99, 102, 241, 0.5)';
          }}
        >
          <Lock size={18} /> Sign In as Owner / Admin
        </button>

        {/* Secondary Station Navigation & Notes */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <button
              onClick={() => {
                playTapSound();
                onSwitchRole('counter');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#CBD5E1';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <BarChart3 size={14} color="#10B981" /> Counter Terminal
            </button>

            <button
              onClick={() => {
                playTapSound();
                onSwitchRole('developer');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#CBD5E1';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <Layers size={14} color="#38BDF8" /> Dev Console (#manj)
            </button>
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#64748B',
              marginTop: '4px',
              lineHeight: 1.5
            }}
          >
            🔒 Dining menus are strictly accessible via physical table QR codes.
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CounterLoginGate
 * Displays when unauthenticated users access #counter
 */
export function CounterLoginGate({ onOpenLogin, onReturnToAdmin }) {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#FFFFFF'
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          padding: '40px 28px 32px',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 50px rgba(16, 185, 129, 0.15)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 12px 28px -6px rgba(16, 185, 129, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <BarChart3 size={32} color="#FFFFFF" />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#6EE7B7',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '16px'
          }}
        >
          <Lock size={12} /> Terminal Locked
        </div>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            margin: '0 0 10px',
            color: '#F8FAFC'
          }}
        >
          Counter POS & Kitchen KDS
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#94A3B8',
            margin: '0 auto 24px',
            lineHeight: 1.6,
            maxWidth: '380px'
          }}
        >
          Sign in with your staff credentials or authorized station PIN to manage live orders, punch walk-ins, and handle settlements.
        </p>

        <button
          onClick={() => {
            playTapSound();
            onOpenLogin();
          }}
          style={{
            width: '100%',
            padding: '14px 22px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 12px 28px -6px rgba(16, 185, 129, 0.45)',
            marginBottom: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          <Lock size={18} /> Sign In to Counter Station
        </button>

        <button
          onClick={() => {
            playTapSound();
            onReturnToAdmin();
          }}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderRadius: '14px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#E2E8F0',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
        >
          Return to Owner Back-Office
        </button>
      </div>
    </div>
  );
}

/**
 * QrCodeGate
 * Displays when a user visits #customer or #chef without scanning a physical table QR code
 */
export function QrCodeGate({ onReturnToAdmin }) {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#FFFFFF'
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '28px',
          padding: '40px 28px 32px',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 50px rgba(245, 158, 11, 0.15)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 12px 28px -6px rgba(245, 158, 11, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <QrCode size={36} color="#FFFFFF" />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: '999px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#FCD34D',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '16px'
          }}
        >
          Table Standee Required
        </div>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            margin: '0 0 10px',
            color: '#F8FAFC'
          }}
        >
          Table QR Code Required
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#94A3B8',
            margin: '0 auto 24px',
            lineHeight: 1.6,
            maxWidth: '380px'
          }}
        >
          The guest dining and contactless ordering experience is strictly accessible by scanning the physical QR code standee on your dining table.
        </p>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#CBD5E1',
            lineHeight: 1.5
          }}
        >
          📷 Please point your mobile camera at the standee QR code placed on your table to open your live table order tray.
        </div>

        <button
          onClick={() => {
            playTapSound();
            onReturnToAdmin();
          }}
          style={{
            width: '100%',
            padding: '14px 22px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 12px 28px -6px rgba(99, 102, 241, 0.5)',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldCheck size={18} /> Access Owner Back-Office <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
