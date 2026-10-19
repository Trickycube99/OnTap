import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Check
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function BankReconciliationView({ orders: _orders, theme: _theme }) {
  // Mock Bank Statement Entries (from HDFC / ICICI Current Account)
  const [bankEntries, setBankEntries] = useState([
    { id: 'TXN-101', date: '2026-10-15', description: 'UPI SETTLEMENT - BHARATPE / PAYTM', credit: 11250, matchedId: 'POS-UPI-15OCT', status: 'matched' },
    { id: 'TXN-102', date: '2026-10-15', description: 'POS CARD SETTLEMENT - PINE LABS HDFC (Less 1.5% MDR)', credit: 5122, expectedCredit: 5200, mdrDeduction: 78, matchedId: 'POS-CARD-15OCT', status: 'variance' },
    { id: 'TXN-103', date: '2026-10-14', description: 'CASH DEPOSIT - SMART CDM CONNAUGHT PLACE', credit: 8400, matchedId: 'POS-CASH-14OCT', status: 'matched' },
    { id: 'TXN-104', date: '2026-10-13', description: 'ZOMATO ONLINE PAYOUT - WEEKLY CYCLE', credit: 14200, matchedId: 'AGG-ZOM-13OCT', status: 'matched' },
    { id: 'TXN-105', date: '2026-10-13', description: 'SWIGGY COMMERCE PAYOUT - NET PROCEEDS', credit: 12100, matchedId: 'AGG-SWG-13OCT', status: 'matched' }
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleSimulateCsvUpload = () => {
    playTapSound();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setUploadSuccess(true);
      playSuccessChime();
    }, 1000);
  };

  const handleReconcileAll = () => {
    playTapSound();
    setBankEntries((prev) =>
      prev.map((e) => ({ ...e, status: 'matched' }))
    );
    playSuccessChime();
  };

  const totalBankCredits = bankEntries.reduce((s, e) => s + e.credit, 0);
  const matchedCount = bankEntries.filter((e) => e.status === 'matched').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Bank Statements & Matching</div>
        <div className="screen-subtitle">Check your daily UPI, Card, and Cash deposits with your bank statement</div>
      </div>

      {/* Top Upload Card */}
      <div className="ios-card active-gradient" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Upload Bank Statement</span>
            <span className="card-meta-text">Upload your bank passbook / statement (Excel or CSV file)</span>
          </div>
          <FileSpreadsheet size={20} color="#007AFF" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
          <button
            className="btn-primary-pill"
            style={{ fontSize: 13, padding: '8px 16px' }}
            onClick={handleSimulateCsvUpload}
            disabled={isUploading}
          >
            <Upload size={14} />
            <span>{isUploading ? 'Reading Statement...' : 'Upload Statement (Excel / CSV)'}</span>
          </button>

          <button
            className="btn-secondary-pill"
            style={{ fontSize: 13, padding: '8px 16px' }}
            onClick={handleReconcileAll}
          >
            <CheckCircle2 size={14} color="#16A34A" />
            <span>Match All Deposits</span>
          </button>
        </div>

        {uploadSuccess && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} strokeWidth={3} />
            <span>Successfully loaded 5 bank entries from ICICI_CurrentAccount_Oct2026.csv</span>
          </div>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Money in Bank</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{totalBankCredits.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Matched with Bills</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A', marginTop: 2 }}>
            {((matchedCount / bankEntries.length) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Card Machine Fees</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
            ₹78.00 (Bank Charge)
          </div>
        </div>
      </div>

      {/* Bank Statement Entries Table */}
      <div className="ios-card">
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Bank Deposit History</span>
            <span className="card-meta-text">Compare money received in bank vs counter bills</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bankEntries.map((txn) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
