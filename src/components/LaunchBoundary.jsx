import React from 'react';
import { getFirebaseConfig } from '../utils/firebaseSync';

export default class LaunchBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    const setupRequired = import.meta.env.PROD && !getFirebaseConfig();
    if (!setupRequired && !this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', alignItems: 'center', padding: 'clamp(24px, 7vw, 96px)', background: '#FAF7F0', color: '#30271D' }}>
        <section style={{ maxWidth: 580, borderLeft: '4px solid #B86B26', paddingLeft: 28 }}>
          <img src="/ontap_logo.png" width="64" height="64" alt="OnTap" style={{ objectFit: 'contain', marginBottom: 30 }} />
          <p style={{ textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 12, color: '#8C5A30' }}>OnTap · Restaurant service</p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(36px, 7vw, 60px)', lineHeight: 1.08, margin: '18px 0' }}>Online ordering is temporarily unavailable.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6 }}>Please order directly at the restaurant counter. Our team can help with your menu and payment.</p>
          {!setupRequired && <button className="btn-primary-pill" onClick={() => window.location.reload()}>Reload page</button>}
        </section>
      </main>
    );
  }
}
