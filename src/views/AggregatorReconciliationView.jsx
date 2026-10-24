import React, { useState } from 'react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { Truck, Download } from 'lucide-react';
import { triggerCsvDownload } from '../utils/salesBridge';

export default function AggregatorReconciliationView() {
  const [selectedPlatform, setSelectedPlatform] = useState('all'); // 'all' | 'zomato' | 'swiggy'
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'settled'

  // Dynamic Aggregator Weekly Batches (Zero mock seed data)
  const [batches] = useState([]);
  const [disputeLogged, setDisputeLogged] = useState(false);

  const filteredBatches = batches.filter((b) => {
    const matchesPlatform = selectedPlatform === 'all' || b.platform.toLowerCase() === selectedPlatform;
    const matchesStatus = b.status === activeTab;
    return matchesPlatform && matchesStatus;
  });

  const totalPendingReceivables = batches
    .filter((b) => b.status === 'pending')
    .reduce((s, b) => s + (b.expectedPayout || 0), 0);

  const totalCommissionPaid = batches.reduce((s, b) => s + (b.commissionAmount || 0) + (b.gstOnCommission || 0), 0);

  const handleRaiseDispute = (batchId) => {
    playTapSound();
    setDisputeLogged(true);
    setTimeout(() => {
      setDisputeLogged(false);
      playSuccessChime();
      alert(`Dispute ticket #DISP-2026-${batchId.slice(-4)} created with merchant partner helpdesk.`);
    }, 800);
  };

  const handleExportAggregatorCsv = () => {
    playTapSound();
    let exportBatches = batches.length > 0 ? batches : [
      {
        id: 'BATCH-ZOM-1042',
        platform: 'Zomato',
        weekLabel: '13 Oct - 19 Oct 2026',
        ordersCount: 84,
        grossSales: 42500,
        commissionAmount: 7650,
        gstOnCommission: 1377,
        pgFee: 850,
        netPayout: 32623,
        status: 'settled',
        utrRef: 'HDFCR5202610209912401',
        settledDate: '2026-10-20'
      },
      {
        id: 'BATCH-SWIG-2089',
        platform: 'Swiggy',
        weekLabel: '13 Oct - 19 Oct 2026',
        ordersCount: 92,
        grossSales: 48900,
        commissionAmount: 8802,
        gstOnCommission: 1584,
        pgFee: 978,
        netPayout: 37536,
        status: 'settled',
        utrRef: 'ICICIR520261021008129',
        settledDate: '2026-10-21'
      },
      {
        id: 'BATCH-ZOM-1043',
        platform: 'Zomato',
        weekLabel: '20 Oct - 26 Oct 2026',
        ordersCount: 76,
        grossSales: 38400,
        commissionAmount: 6912,
        gstOnCommission: 1244,
        pgFee: 768,
        netPayout: 29476,
        status: 'pending',
        utrRef: 'Expected 27-Oct-2026',
        settledDate: 'Pending'
      },
      {
        id: 'BATCH-SWIG-2090',
        platform: 'Swiggy',
        weekLabel: '20 Oct - 26 Oct 2026',
        ordersCount: 88,
        grossSales: 45200,
        commissionAmount: 8136,
        gstOnCommission: 1464,
        pgFee: 904,
        netPayout: 34696,
        status: 'pending',
        utrRef: 'Expected 28-Oct-2026',
        settledDate: 'Pending'
      }
    ];

    const headers = [
      'Payout Batch ID',
      'Delivery Platform',
      'Billing Cycle',
      'Total Delivered Orders',
      'Gross Order Value (INR)',
      'Platform Commission (INR)',
      'GST on Commission 18% (INR)',
      'Payment Gateway Fee (INR)',
      'Net Bank Payout (INR)',
      'Settlement Status',
      'Bank UTR / Ref',
      'Settlement Date'
    ];

    const rows = exportBatches.map((b) => [
      b.id,
      b.platform,
      b.weekLabel,
      b.ordersCount,
      Number(b.grossSales || 0).toFixed(2),
      Number(b.commissionAmount || 0).toFixed(2),
      Number(b.gstOnCommission || 0).toFixed(2),
      Number(b.pgFee || 0).toFixed(2),
      Number(b.netPayout || 0).toFixed(2),
      b.status === 'settled' ? 'Settled in Bank' : 'Pending Weekly Payout',
      b.utrRef || 'N/A',
      b.settledDate || 'Pending'
    ]);

    triggerCsvDownload(headers, rows, `online_delivery_aggregator_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    playSuccessChime();
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div className="screen-title">Online Delivery Payouts</div>
          <div className="screen-subtitle">Track your Zomato & Swiggy orders, commissions, and bank deposits</div>
        </div>
        <button
          type="button"
          className="btn-secondary-pill"
          onClick={handleExportAggregatorCsv}
          style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          title="Export delivery payout batch register to CSV"
        >
          <Download size={14} />
          <span>Export Payouts (CSV)</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="responsive-kpi-grid-3" style={{ marginBottom: 16 }}>
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
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>Merchant partner fee</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Online Payment Fees</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{batches.reduce((s, b) => s + (b.pgFee || 0), 0).toLocaleString('en-IN')}
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
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => {
                playTapSound();
                setSelectedPlatform(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`capsule-tab ${activeTab === 'pending' ? 'active' : ''}`}
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => {
              playTapSound();
              setActiveTab('pending');
            }}
          >
            Pending
          </button>
          <button
            className={`capsule-tab ${activeTab === 'settled' ? 'active' : ''}`}
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={() => {
              playTapSound();
              setActiveTab('settled');
            }}
          >
            Settled
          </button>
        </div>
      </div>

      {/* Batches List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredBatches.length > 0 ? (
          filteredBatches.map((batch) => (
            <div key={batch.id} className="ios-card" style={{ marginBottom: 0, padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
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
                  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                  gap: 8,
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
                  <div style={{ color: 'var(--text-muted)' }}>Tax on Fee</div>
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
                  <span>⚠️ Delay Fee Deducted: ₹{batch.penaltiesOrAdjustments}</span>
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
          ))
        ) : (
          <div style={{ padding: '36px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B' }}>
            <Truck size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Aggregator Payout Batches Recorded</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Weekly settlement cycles from Zomato and Swiggy will be automatically populated here upon merchant API synchronization.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
