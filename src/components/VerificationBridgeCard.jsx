import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  UtensilsCrossed,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export default function VerificationBridgeCard({
  bridgeData,
  role = 'owner', // 'owner' or 'counter'
  onNavigateToCashCheck,
  compact = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!bridgeData) return null;

  const {
    totalServedAmount = 0,
    totalExpectedAmount = 0,
    unservedAmount = 0,
    servedCount = 0,
    expectedCount = 0,
    unservedCount = 0,
    fulfillmentRate = 100,
    isFullyServed = false,
    statusTone = 'empty',
    statusTitle = '',
    statusSubtitle = '',
    channels,
    servedOrders = [],
    inPrepOrders = [],
    timestamp = ''
  } = bridgeData;

  const isOwner = role === 'owner';

  return (
    <div
      className="ios-card active-gradient"
      style={{
        marginBottom: 16,
        border: isFullyServed ? '1.5px solid #86EFAC' : '1.5px solid #93C5FD',
        boxShadow: isFullyServed
          ? '0 6px 20px rgba(22, 163, 74, 0.08)'
          : '0 6px 20px rgba(37, 99, 235, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Banner Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: isFullyServed ? 'rgba(22, 163, 74, 0.12)' : 'rgba(37, 99, 235, 0.12)',
              border: `1.5px solid ${isFullyServed ? '#86EFAC' : '#93C5FD'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowRightLeft size={18} color={isFullyServed ? '#15803D' : '#1D4ED8'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                Real-Time Verification Bridge
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: isFullyServed ? '#DCFCE7' : '#EFF6FF',
                  color: isFullyServed ? '#15803D' : '#1D4ED8',
                  border: `1px solid ${isFullyServed ? '#86EFAC' : '#BFDBFE'}`
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isFullyServed ? '#16A34A' : '#2563EB',
                    boxShadow: isFullyServed ? '0 0 8px #16A34A' : '0 0 8px #2563EB'
                  }}
                />
                Live Real-Time
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Counter Dashboard (Served) ⟷ Owner Dashboard (Expected) • Synced at {timestamp}
            </div>
          </div>
        </div>

        {/* Verification Status Pill */}
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 20,
              background: isFullyServed ? '#16A34A' : unservedCount > 0 ? '#FEF3C7' : '#F1F5F9',
              color: isFullyServed ? '#FFFFFF' : unservedCount > 0 ? '#92400E' : '#475569',
              border: isFullyServed ? '1px solid #15803D' : unservedCount > 0 ? '1px solid #FCD34D' : '1px solid #CBD5E1'
            }}
          >
            {isFullyServed ? <ShieldCheck size={13} /> : unservedCount > 0 ? <Clock size={13} /> : <Sparkles size={13} />}
            <span>{statusTitle}</span>
          </span>
        </div>
      </div>

      {/* 3-Column Reconciliation Comparison Metric Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          background: 'rgba(255, 255, 255, 0.92)',
          borderRadius: 14,
          padding: '12px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          marginBottom: 12
        }}
      >
        {/* Column 1: Counter Dashboard Total Served */}
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
            <UtensilsCrossed size={12} />
            <span>Counter Total Served</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D', marginTop: 4 }}>
            ₹{totalServedAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {servedCount} of {expectedCount} orders served
          </div>
        </div>

        {/* Column 2: Owner Dashboard Total Expected */}
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: 6, paddingLeft: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Layers size={12} />
            <span>Owner Expected Amount</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-blue)', marginTop: 4 }}>
            ₹{totalExpectedAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {expectedCount} total recorded tickets
          </div>
        </div>

        {/* Column 3: In-Kitchen / Pending Serving */}
        <div style={{ paddingLeft: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: unservedAmount > 0 ? '#B45309' : '#15803D', display: 'flex', alignItems: 'center', gap: 4 }}>
            {unservedAmount > 0 ? <Clock size={12} /> : <CheckCircle2 size={12} />}
            <span>In-Kitchen / Unserved</span>
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: unservedAmount > 0 ? '#D97706' : '#15803D',
              marginTop: 4
            }}
          >
            ₹{unservedAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: unservedAmount > 0 ? '#B45309' : '#15803D', marginTop: 2 }}>
            {unservedCount > 0 ? `${unservedCount} tickets in preparation` : 'All tickets cleared'}
          </div>
        </div>
      </div>

      {/* Visual Fulfillment Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            Real-Time Serving Fulfillment:
          </span>
          <span style={{ fontWeight: 700, color: isFullyServed ? '#15803D' : '#2563EB' }}>
            {fulfillmentRate.toFixed(0)}% Served
          </span>
        </div>
        <div
          style={{
            height: 7,
            borderRadius: 6,
            background: '#E2E8F0',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${fulfillmentRate}%`,
              borderRadius: 6,
              background: isFullyServed
                ? 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)'
                : 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* Payment Channel Served vs Expected Match Pills */}
      {channels && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            fontSize: 11,
            background: '#F8FAFC',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            marginBottom: 8
          }}
        >
          {/* Cash */}
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>💵 Counter Cash</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              ₹{channels.served.cash.toFixed(0)} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/ ₹{channels.expected.cash.toFixed(0)}</span>
            </div>
          </div>

          {/* Card */}
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>💳 Card POS</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              ₹{channels.served.card.toFixed(0)} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/ ₹{channels.expected.card.toFixed(0)}</span>
            </div>
          </div>

          {/* UPI */}
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600 }}>📱 UPI Settlement</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              ₹{channels.served.upi.toFixed(0)} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/ ₹{channels.expected.upi.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px solid rgba(226, 232, 240, 0.7)'
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {statusSubtitle}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--primary-blue)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px'
          }}
        >
          <span>{isExpanded ? 'Hide Ticket Audit' : 'Audit Served vs In-Prep'}</span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Expandable Live Audit Drawer */}
      {isExpanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px dashed #CBD5E1',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12
          }}
        >
          {/* Served Tickets List */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '10px'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>✓ Served Tickets ({servedOrders.length})</span>
              <span>₹{totalServedAmount.toFixed(0)}</span>
            </div>
            {servedOrders.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No dishes marked as served yet.
              </div>
            ) : (
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {servedOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      fontSize: 11,
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      background: '#F0FDF4',
                      borderRadius: 6
                    }}
                  >
                    <span>
                      <strong>#{o.id.replace('ord-', '').slice(-4)}</strong> ({o.table})
                    </span>
                    <span style={{ fontWeight: 700, color: '#16A34A' }}>₹{Number(o.total || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In-Kitchen / Cooking Tickets List */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #FED7AA',
              borderRadius: 10,
              padding: '10px'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>⏳ In-Kitchen / Cooking ({inPrepOrders.length})</span>
              <span>₹{unservedAmount.toFixed(0)}</span>
            </div>
            {inPrepOrders.length === 0 ? (
              <div style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                All kitchen orders served to tables!
              </div>
            ) : (
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {inPrepOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      fontSize: 11,
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      background: '#FFF7ED',
                      borderRadius: 6
                    }}
                  >
                    <span>
                      <strong>#{o.id.replace('ord-', '').slice(-4)}</strong> ({o.table}) • <em style={{ textTransform: 'capitalize' }}>{o.status}</em>
                    </span>
                    <span style={{ fontWeight: 700, color: '#EA580C' }}>₹{Number(o.total || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
