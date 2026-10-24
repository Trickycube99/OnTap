import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  X,
  RefreshCw,
  Server,
  Check
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import { getCloudSyncState, subscribeCloudSyncState } from '../utils/sync';
import { syncOrderToCloud } from '../utils/firebaseSync';

export default function CloudSyncModal({ isOpen, onClose }) {
  const [syncState, setSyncState] = useState(getCloudSyncState());
  const [isCopiedRules, setIsCopiedRules] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [customJsonInput, setCustomJsonInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeCloudSyncState((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const firestoreRulesCode = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

  const handleCopyRules = () => {
    playTapSound();
    navigator.clipboard.writeText(firestoreRulesCode);
    setIsCopiedRules(true);
    playSuccessChime();
    setTimeout(() => setIsCopiedRules(false), 2500);
  };

  const handleTestConnection = async () => {
    playTapSound();
    setIsTesting(true);
    setTestResult(null);

    const testPingOrder = {
      id: `PING-${Date.now().toString().slice(-4)}`,
      orderNumber: 9999,
      customerName: 'Diagnostic Ping',
      table: 'Cloud Test',
      createdAt: new Date().toISOString(),
      status: 'received',
      statusLabel: 'Cloud Diagnostic',
      items: [{ id: 1, name: 'Cloud Connectivity Ping', price: 0, quantity: 1 }],
      total: 0,
      paymentMode: 'System Diagnostic'
    };

    try {
      const success = await syncOrderToCloud(testPingOrder);
      if (success) {
        setTestResult({
          status: 'success',
          message: '✓ Success! Connected to cloud backup. Cloud sync is active!'
        });
        playSuccessChime();
      } else {
        setTestResult({
          status: 'error',
          message: 'Write failed. Check if Firestore Security Rules are set to allow read/write.'
        });
        playAlertChime();
      }
    } catch (err) {
      setTestResult({
        status: 'error',
        message: err.message || 'Error communicating with Firestore.'
      });
      playAlertChime();
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveManualConfig = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(customJsonInput);
      if (!parsed.apiKey || !parsed.projectId) {
        alert('Invalid Firebase configuration object. Missing apiKey or projectId.');
        return;
      }
      localStorage.setItem('flowscape_firebase_config', JSON.stringify(parsed));
      playSuccessChime();
      alert('Firebase config saved to local browser! Reloading...');
      window.location.reload();
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 24,
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: syncState.status === 'connected' ? '#DCFCE7' : syncState.status === 'error' ? '#FEE2E2' : '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Cloud
                size={20}
                color={syncState.status === 'connected' ? '#16A34A' : syncState.status === 'error' ? '#DC2626' : '#007AFF'}
              />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Cross-Device Cloud Sync
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Real-time syncing across Phones, Tablets & Laptops
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Card */}
        <div
          style={{
            background:
              syncState.status === 'connected'
                ? '#F0FDF4'
                : syncState.status === 'error'
                ? '#FEF2F2'
                : '#F8FAFC',
            border: `1px solid ${
              syncState.status === 'connected'
                ? '#BBF7D0'
                : syncState.status === 'error'
                ? '#FECACA'
                : '#E2E8F0'
            }`,
            borderRadius: 16,
            padding: '16px',
            marginBottom: 18
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {syncState.status === 'connected' ? (
              <CheckCircle2 size={18} color="#16A34A" />
            ) : syncState.status === 'error' ? (
              <AlertTriangle size={18} color="#DC2626" />
            ) : (
              <Server size={18} color="#64748B" />
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color:
                  syncState.status === 'connected'
                    ? '#15803D'
                    : syncState.status === 'error'
                    ? '#B91C1C'
                    : '#334155'
              }}
            >
              {syncState.status === 'connected'
                ? '🟢 Firebase Firestore: Live & Connected'
                : syncState.status === 'error'
                ? '🔴 Cloud Sync: Action Required'
                : '🟡 Local Network Mode (Awaiting Vercel Redeploy)'}
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
            {syncState.status === 'connected'
              ? `Connected to Firebase project "${syncState.projectId}". Orders placed on any mobile phone will instantly pop up on counter POS and kitchen screens without refreshing.`
              : syncState.status === 'error'
              ? syncState.error || 'Firestore rejected the request. Please check Firestore security rules below.'
              : 'Firebase environment variables were not detected in this build. If you added them in Vercel, trigger a Redeploy so the build picks them up.'}
          </p>

          {syncState.projectId && (
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
              Connected Project ID: <code style={{ background: '#FFFFFF', padding: '2px 6px', borderRadius: 4 }}>{syncState.projectId}</code>
            </div>
          )}
        </div>

        {/* Live Test Button */}
        <div style={{ marginBottom: 20 }}>
          <button
            className="btn-primary-pill full-width"
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{
              padding: '12px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <RefreshCw size={14} className={isTesting ? 'spinning' : ''} />
            <span>{isTesting ? 'Testing Firestore Ping...' : 'Test Cloud Sync Live (Send Ping)'}</span>
          </button>

          {testResult && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                background: testResult.status === 'success' ? '#DCFCE7' : '#FEE2E2',
                color: testResult.status === 'success' ? '#15803D' : '#DC2626'
              }}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* 2-Step Checklist for Cross-Device Success */}
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
            2-Step Checklist for Cross-Device Sync
          </div>

          {/* Step 1: Vercel Redeploy */}
          <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px', marginBottom: 10, border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              1. Redeploy on Vercel (Crucial!)
            </div>
            <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.4 }}>
              Adding Environment Variables in Vercel does not update previous deployments. Vite embeds variables during <code>npm run build</code>.
              <br />
              Go to <strong>Vercel Dashboard → Deployments → Click ⋯ on top deployment → Click "Redeploy"</strong>.
            </div>
          </div>

          {/* Step 2: Firestore Security Rules */}
          <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                2. Enable Firestore Security Rules
              </div>
              <button
                onClick={handleCopyRules}
                style={{
                  background: isCopiedRules ? '#DCFCE7' : '#FFFFFF',
                  border: '1px solid #D1D5DB',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: isCopiedRules ? '#15803D' : '#374151'
                }}
              >
                {isCopiedRules ? <Check size={12} color="#15803D" /> : <Copy size={12} />}
                <span>{isCopiedRules ? 'Copied!' : 'Copy Rules'}</span>
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 8, lineHeight: 1.4 }}>
              If Firestore is set to production mode, it blocks all reads and writes. Open <strong>Firebase Console → Firestore Database → "Rules" tab</strong>, paste this rule and click <strong>Publish</strong>:
            </div>
            <pre
              style={{
                background: '#1E293B',
                color: '#38BDF8',
                padding: '10px',
                borderRadius: 8,
                fontSize: 11,
                overflowX: 'auto',
                margin: 0
              }}
            >
              {firestoreRulesCode}
            </pre>
          </div>
        </div>

        {/* Optional Manual LocalStorage Override for Instant Testing */}
        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#007AFF',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0
            }}
          >
            {showManualInput ? '▼ Hide browser config override' : '▶ Want to test immediately without redeploying? Paste config here'}
          </button>

          {showManualInput && (
            <form onSubmit={handleSaveManualConfig} style={{ marginTop: 10 }}>
              <textarea
                placeholder='Paste your Firebase config JSON: { "apiKey": "...", "projectId": "..." }'
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #D1D5DB',
                  boxSizing: 'border-box',
                  marginBottom: 8
                }}
              />
              <button
                type="submit"
                className="btn-secondary-pill"
                style={{ fontSize: 11, padding: '6px 12px' }}
              >
                Save to Browser & Test
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
