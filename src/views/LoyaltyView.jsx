import React, { useState } from 'react';
import {
  Crown,
  Gift,
  Search,
  CheckCircle2,
  Phone,
  Ticket
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function LoyaltyView({ theme: _theme }) {
  const [searchPhone, setSearchPhone] = useState('+91 98112-40192');
  const [selectedMember, setSelectedMember] = useState({
    id: 'MEM-8821',
    name: 'Rohan Sharma',
    phone: '+91 98112-40192',
    tier: 'Gold',
    tierColor: '#F59E0B',
    points: 840,
    lifetimeSpent: 12450,
    visitsCount: 14,
    lastVisit: '2 days ago',
    activeVouchers: [
      { id: 'VOUCH-1', title: 'Free Alphonso Mango & Kokum Shikanji', pointsCost: 150, code: 'GOLD-SHIKANJI', isRedeemed: false },
      { id: 'VOUCH-2', title: '₹200 Off Chef\'s Naan Pizza', pointsCost: 300, code: 'GOLD-PIZZA200', isRedeemed: false },
      { id: 'VOUCH-3', title: 'Flat 15% VIP Dining Privilege', pointsCost: 500, code: 'VIP-GOLD15', isRedeemed: false }
    ]
  });

  const [redeemedCode, setRedeemedCode] = useState(null);

  const handleRedeemVoucher = (voucher) => {
    playTapSound();
    if (selectedMember.points < voucher.pointsCost) {
      alert('Insufficient points for this reward voucher.');
      return;
    }

    setSelectedMember((prev) => ({
      ...prev,
      points: prev.points - voucher.pointsCost,
      activeVouchers: prev.activeVouchers.map((v) => (v.id === voucher.id ? { ...v, isRedeemed: true } : v))
    }));
    setRedeemedCode(voucher.code);
    playSuccessChime();
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Customer Rewards & Points</div>
        <div className="screen-subtitle">Give regular customers reward points and discount coupons</div>
      </div>

      {/* Customer Phone Search */}
      <div className="ios-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
          Search Member by Mobile Number:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Phone size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12 }} />
            <input
              type="text"
              className="ios-input"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              style={{ paddingLeft: 34 }}
              placeholder="+91 98765-43210"
            />
          </div>
          <button
            className="btn-primary-pill"
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={() => playTapSound()}
          >
            <Search size={14} />
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* Member Profile Hero Card (iOS Native Glass) */}
      <div
        className="ios-card active-gradient"
        style={{
          border: '1px solid rgba(245, 158, 11, 0.4)',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Crown size={18} color="#F59E0B" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {selectedMember.tier} VIP Member
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>
              {selectedMember.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selectedMember.phone} • Member ID: {selectedMember.id}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Available Balance</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-blue)', lineHeight: 1.1 }}>
              {selectedMember.points}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>Points (Worth ₹{Math.round(selectedMember.points * 0.8)})</div>
          </div>
        </div>

        {/* Member Key Metrics Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 14,
            background: 'rgba(255, 255, 255, 0.8)',
            padding: 10,
            borderRadius: 12,
            textAlign: 'center',
            fontSize: 11
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Total Money Spent</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>₹{selectedMember.lifetimeSpent.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Total Visits</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedMember.visitsCount} times</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Next Level</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#8B5CF6' }}>Platinum (660 pts)</div>
          </div>
        </div>

        {/* Progress Bar to Platinum VIP */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Silver (0)</span>
            <span>Gold (500)</span>
            <span>Platinum VIP (1,500)</span>
          </div>
          <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(selectedMember.points / 1500) * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #8B5CF6)', borderRadius: 3 }} />
          </div>
        </div>
      </div>

      {/* Redeemable Rewards Catalog */}
      <div className="ios-card" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Free Dishes & Coupons</span>
            <span className="card-meta-text">Use member points for free food or special discounts</span>
          </div>
          <Gift size={18} color="#007AFF" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedMember.activeVouchers.map((voucher) => (
            <div
              key={voucher.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: voucher.isRedeemed ? '#F3F4F6' : '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                opacity: voucher.isRedeemed ? 0.6 : 1
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ticket size={14} color="#007AFF" />
                  <span>{voucher.title}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Cost: <strong>{voucher.pointsCost} Points</strong> • Coupon Code: <code style={{ background: '#E0F2FE', padding: '1px 5px', borderRadius: 4 }}>{voucher.code}</code>
                </div>
              </div>

              <div>
                {voucher.isRedeemed ? (
                  <span className="status-pill done" style={{ fontSize: 11 }}>
                    Redeemed
                  </span>
                ) : (
                  <button
                    className="btn-primary-pill"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={() => handleRedeemVoucher(voucher)}
                  >
                    <span>Use Coupon ({voucher.pointsCost} Pts)</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {redeemedCode && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: '#DCFCE7',
              border: '1px solid #86EFAC',
              borderRadius: 12,
              fontSize: 12,
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <CheckCircle2 size={16} />
            <span>Success! Coupon code <strong>{redeemedCode}</strong> is ready to use on the bill!</span>
          </div>
        )}
      </div>
    </div>
  );
}
