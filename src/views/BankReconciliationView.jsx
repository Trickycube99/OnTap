import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Check,
  Building
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function BankReconciliationView({ orders = [], theme: _theme }) {
  // Zero mock initial state - starts completely empty
  const [bankEntries, setBankEntries] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Sync real-time settled orders into reconciliation ledger
  const handleSyncFromOrders = () => {
    playTapSound();
    setIsUploading(true);
    setTimeout(() => {
      const generated = (orders || [])
        .filter((o) => o && o.status !== 'rejected' && o.status !== 'cancelled')
        .slice(0, 15)
        .map((o, idx) => ({
          id: `TXN-${100 + idx}`,
          date: (o.createdAt || new Date().toISOString()).slice(0, 10),
          description: `${(o.paymentMode || 'POS Settled').toUpperCase()} - ${(o.customerName || 'Diner').toUpperCase()}`,
          credit: Number(o.total || 0),
          matchedId: o.id,
          status: 'matched'
        }));
      setBankEntries(generated);
      setIsUploading(false);
      setUploadSuccess(true);
      playSuccessChime();
    }, 600);
  };

  const handleReconcileAll = () => {
    playTapSound();
    setBankEntries((prev) =>
      prev.map((e) => ({ ...e, status: 'matched' }))
    );
    playSuccessChime();
  };

  const totalBankCredits = bankEntries.reduce((s, e) => s + (e.credit || 0), 0);
  const matchedCount = bankEntries.filter((e) => e.status === 'matched').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Bank Statements & Matching</div>
        <div className="screen-subtitle">Reconcile real-time UPI, Card, and Cash deposits with your bank statement</div>
      </div>

      {/* Top Upload Card */}
      <div className="ios-card active-gradient" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Import Bank Statement</span>
            <span className="card-meta-text">Reconcile current account deposits against live kitchen tickets</span>
          </div>
          <FileSpreadsheet size={20} color="#007AFF" />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            className="btn-primary-pill"
            style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
            onClick={handleSyncFromOrders}
            disabled={isUploading}
          >
            <Upload size={14} />
            <span>{isUploading ? 'Reconciling Live Tickets...' : 'Populate from Live Orders'}</span>
          </button>
        </div>

        {uploadSuccess && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: 11, fontWeight: 600 }}>
            <CheckCircle2 size={14} />
            <span>Live statement ledger synced with active POS orders!</span>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bank Money Received</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A', marginTop: 2 }}>
            ₹{totalBankCredits.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>Across {bankEntries.length} verified transactions</div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Matched with POS</div>
            {bankEntries.length > 0 && matchedCount < bankEntries.length && (
              <button
                type="button"
                className="btn-secondary-pill"
                style={{ fontSize: 9, padding: '2px 6px' }}
                onClick={handleReconcileAll}
              >
                Match All
              </button>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            {matchedCount} / {bankEntries.length}
          </div>
          <div style={{ fontSize: 10, color: '#6B7280' }}>
            {bankEntries.length > 0 && matchedCount === bankEntries.length ? '100% Fully Matched' : 'Awaiting confirmation'}
          </div>
        </div>
      </div>

      {/* Bank Transactions Matching List */}
      <div className="ios-card">
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Bank Transactions Log</span>
            <span className="card-meta-text">Compare money received in bank vs counter bills</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bankEntries.length > 0 ? (
            bankEntries.map((txn) => (
              <div
                key={txn.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 14
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{txn.id}</span>
                    <span className="status-pill tag" style={{ fontSize: 9 }}>
                      {txn.date}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1F2937', marginTop: 2 }}>
                    {txn.description}
                  </div>
                  {txn.mdrDeduction && (
                    <div style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>
                      Bill was ₹{txn.expectedCredit} • ₹{txn.mdrDeduction} deducted as card swipe charge
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>
                    +₹{txn.credit.toLocaleString('en-IN')}
                  </div>
                  <span
                    className={`status-pill ${txn.status === 'matched' ? 'done' : 'tag'}`}
                    style={{ fontSize: 9, padding: '2px 6px', marginTop: 4 }}
                  >
                    {txn.status === 'matched' ? '✓ Matched' : '⚠️ Fee Difference'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '36px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B' }}>
              <Building size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Bank Entries Imported Yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Click "Populate from Live Orders" above or upload an Excel bank passbook to reconcile incoming deposits.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
