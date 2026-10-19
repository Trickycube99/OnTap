import React, { useState } from 'react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function AggregatorReconciliationView() {
  const [selectedPlatform, setSelectedPlatform] = useState('all'); // 'all' | 'zomato' | 'swiggy'
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'settled'

  // Mock Aggregator Weekly Batches
  const [batches] = useState([
    {
      id: 'ZOM-BATCH-OCT-W2',
      platform: 'Zomato',
      period: '06 Oct - 12 Oct 2026',
      grossSales: 18450,
      commissionRate: 20, // 20%
      commissionAmount: 3690,
      gstOnCommission: 664, // 18% GST on commission
      pgFee: 339, // ~1.84%
      penaltiesOrAdjustments: 0,
      expectedPayout: 13757,
      bankSettledAmount: 13757,
      status: 'settled',
      payoutDate: '14 Oct 2026',
      bankRef: 'HDFC-NEFT-ZOM-99214'
    },
    {
      id: 'ZOM-BATCH-OCT-W3',
      platform: 'Zomato',
      period: '13 Oct - 19 Oct 2026',
      grossSales: 22400,
      commissionRate: 20,
      commissionAmount: 4480,
      gstOnCommission: 806,
      pgFee: 412,
      penaltiesOrAdjustments: 200, // rider delay penalty
      expectedPayout: 16502,
      bankSettledAmount: 0,
      status: 'pending',
      payoutDate: '21 Oct 2026 (Wednesday)',
      bankRef: 'Pending Clearing'
    },
    {
      id: 'SWG-BATCH-OCT-W2',
      platform: 'Swiggy',
      period: '05 Oct - 11 Oct 2026',
      grossSales: 16200,
      commissionRate: 22,
      commissionAmount: 3564,
      gstOnCommission: 641,
      pgFee: 298,
      penaltiesOrAdjustments: 0,
      expectedPayout: 11697,
      bankSettledAmount: 11697,
      status: 'settled',
      payoutDate: '16 Oct 2026',
      bankRef: 'ICICI-CMS-SWG-33104'
    },
    {
      id: 'SWG-BATCH-OCT-W3',
      platform: 'Swiggy',
      period: '12 Oct - 18 Oct 2026',
      grossSales: 15800,
      commissionRate: 22,
      commissionAmount: 3476,
      gstOnCommission: 625,
      pgFee: 290,
      penaltiesOrAdjustments: 0,
      expectedPayout: 11409,
      bankSettledAmount: 0,
      status: 'pending',
      payoutDate: '23 Oct 2026 (Friday)',
      bankRef: 'Pending Clearing'
    }
  ]);

  const [disputeLogged, setDisputeLogged] = useState(false);

  const filteredBatches = batches.filter((b) => {
    const matchesPlatform = selectedPlatform === 'all' || b.platform.toLowerCase() === selectedPlatform;
    const matchesStatus = b.status === activeTab;
    return matchesPlatform && matchesStatus;
  });

  const totalPendingReceivables = batches
    .filter((b) => b.status === 'pending')
    .reduce((s, b) => s + b.expectedPayout, 0);

  const totalCommissionPaid = batches.reduce((s, b) => s + b.commissionAmount + b.gstOnCommission, 0);

  const handleRaiseDispute = (batchId) => {
    playTapSound();
    setDisputeLogged(true);
    setTimeout(() => {
      setDisputeLogged(false);
      playSuccessChime();
      alert(`Dispute ticket #DISP-2026-${batchId.slice(-4)} created with merchant partner helpdesk for ₹200 delay deduction.`);
    }, 800);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Online Delivery Payouts</div>
        <div className="screen-subtitle">Track your Zomato & Swiggy orders, commissions, and bank deposits</div>
      </div>

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending Payouts</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
            ₹{totalPendingReceivables.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Expected this week</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Commission Paid</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>
            ₹{totalCommissionPaid.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Average ~21% fee</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Online Payment Fees</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{batches.reduce((s, b) => s + b.pgFee, 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Gateway processing charge</div>
        </div>
      </div>

      {/* Platform Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'All Platforms' },
            { id: 'zomato', label: 'Zomato Orders' },
            { id: 'swiggy', label: 'Swiggy Orders' }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`capsule-tab ${selectedPlatform === tab.id ? 'active' : ''}`}
              onClick={() => {
                playTapSound();
                setSelectedPlatform(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 2 }}>
          <button
            type="button"
            className={`role-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Pending ({batches.filter((b) => b.status === 'pending').length})
          </button>
          <button
            type="button"
            className={`role-tab-btn ${activeTab === 'settled' ? 'active' : ''}`}
            onClick={() => setActiveTab('settled')}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            Deposited ({batches.filter((b) => b.status === 'settled').length})
          </button>
        </div>
      </div>

      {/* Batches Stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredBatches.map((batch) => (
          <div key={batch.id} className="ios-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: batch.platform === 'Zomato' ? '#FEE2E2' : '#FFEDD5',
                      color: batch.platform === 'Zomato' ? '#DC2626' : '#EA580C'
                    }}
                  >
                    {batch.platform}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{batch.period}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Payout ID: {batch.id} • Expected Deposit: <strong>{batch.payoutDate}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className={`status-pill ${batch.status === 'settled' ? 'done' : 'pending'}`}>
                  {batch.status === 'settled' ? 'Deposited in Bank' : 'Waiting Payout'}
                </span>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-blue)', marginTop: 4 }}>
                  ₹{batch.expectedPayout.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Reconciliation Breakdown */}
            <div
              style={{
                marginTop: 10,
                background: '#F9FAFB',
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 11,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                textAlign: 'center'
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Total Orders</div>
                <div style={{ fontWeight: 700 }}>₹{batch.grossSales.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Commission ({batch.commissionRate}%)</div>
                <div style={{ fontWeight: 700, color: '#DC2626' }}>-₹{batch.commissionAmount.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Tax on Fee (18%)</div>
                <div style={{ fontWeight: 700, color: '#DC2626' }}>-₹{batch.gstOnCommission}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Payment Fee</div>
                <div style={{ fontWeight: 700, color: '#6B7280' }}>-₹{batch.pgFee}</div>
              </div>
            </div>

            {batch.penaltiesOrAdjustments > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 8,
                  fontSize: 11,
                  color: '#DC2626',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>⚠️ Delay Fee Deducted: ₹{batch.penaltiesOrAdjustments} (Rider waiting delay)</span>
                <button
                  className="btn-secondary-pill"
                  style={{ padding: '2px 8px', fontSize: 10, color: '#DC2626' }}
                  onClick={() => handleRaiseDispute(batch.id)}
                  disabled={disputeLogged}
                >
                  {disputeLogged ? 'Reporting...' : 'Report Deduction'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
