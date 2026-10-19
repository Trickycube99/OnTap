import React, { useState } from 'react';
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  FileCheck2,
  Sparkles,
  ChevronRight,
  Heart,
  UtensilsCrossed,
  ArrowLeft
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { DEFAULT_CUTLERY_IMAGE } from '../data/initialData';

export default function AboutChefView({ chef, menu, theme, onAddToCart, onGoToMenu }) {
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);
  const [verifiedCount, setVerifiedCount] = useState(2450);
  const [hasEndorsed, setHasEndorsed] = useState(false);

  const showVerifiedBadge = Boolean(chef?.showVerifiedBadge ?? (chef?.isVerified ?? true));
  const showCredentials = Boolean(chef?.showCredentials ?? true);
  const showHygienePledge = Boolean(chef?.showHygienePledge ?? true);
  const businessName = theme?.restaurantName || chef?.businessName || 'Artisanal Kitchen';

  // Find chef's signature items
  const signatureItems = menu.filter((item) => item.tags.includes("Chef's Pick") || item.tags.includes("Signature Special"));

  const handleEndorse = () => {
    playTapSound();
    if (!hasEndorsed) {
      setVerifiedCount((prev) => prev + 1);
      setHasEndorsed(true);
      playSuccessChime();
    }
  };

  return (
    <div style={{ width: '100%', flex: 1, paddingBottom: 60, overflowX: 'hidden' }}>
      {/* Mobile-Friendly Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            onGoToMenu();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Menu</span>
        </button>

        {showVerifiedBadge && (
          <span className="status-pill done" style={{ fontSize: 11, padding: '4px 10px' }}>
            <ShieldCheck size={12} />
            <span>FSSAI 5-Star Certified</span>
          </span>
        )}
      </div>

      {/* Header section with screen title and subtitle */}
      <div style={{ marginBottom: 16 }}>
        <div className="screen-title">About the Chef</div>
        <div className="screen-subtitle">
          {showVerifiedBadge
            ? 'Transparent culinary craftsmanship & verified Indian accreditation.'
            : 'Culinary craftsmanship, passion & fine dining experience.'}
        </div>
      </div>

      {/* Main Chef Verified Profile Card */}
      <div className="ios-card active-gradient" style={{ marginBottom: 18, paddingTop: 20 }}>
        {/* Top Badges */}
        {showVerifiedBadge && (
          <div className="card-top-row">
            <div className="status-pill done">
              <ShieldCheck size={13} />
              <span>Officially Verified Master Chef</span>
            </div>
            {chef?.verificationId && <span className="card-meta-text">Lic: {chef.verificationId}</span>}
          </div>
        )}

        {/* Chef Portrait & Core Title */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8, marginBottom: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={chef?.portrait || '/assets/chef_portrait.jpg'}
              alt={chef?.name || 'Chef'}
              style={{
                width: 86,
                height: 86,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid #007AFF',
                boxShadow: '0 4px 14px rgba(0, 122, 255, 0.25)'
              }}
            />
            {showVerifiedBadge && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  background: '#007AFF',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #FFFFFF'
                }}
              >
                <CheckCircle2 size={13} strokeWidth={3} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-heading" style={{ fontSize: 19 }}>
              {chef?.name || 'Master Chef'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2 }}>
              {chef?.title || 'Executive Chef & Culinary Director'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              📍 {businessName} • {chef?.experienceYears || 15}+ Yrs Mastery
            </div>
          </div>
        </div>

        {/* Key Verification Metrics & Audit Button */}
        {showVerifiedBadge && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #E5E7EB',
                borderRadius: 14,
                padding: '10px 6px',
                marginBottom: 14,
                textAlign: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{chef?.hygieneScore || '99.4%'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>FSSAI Hygiene</div>
              </div>
              <div style={{ borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)' }}>5-Star A+</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Clean Dining</div>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#9333EA' }}>{chef?.certifications?.length || 4} Badges</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Govt. Audited</div>
              </div>
            </div>

            {/* Verification Action Button */}
            <button
              className="btn-primary-pill full-width"
              style={{ padding: '10px 16px', fontSize: 14 }}
              onClick={() => {
                playTapSound();
                setShowVerifyModal(true);
              }}
            >
              <FileCheck2 size={16} />
              <span>View Food Safety Certificate (FSSAI)</span>
            </button>
          </>
        )}

        {/* Bottom Card Progress Bar */}
        <div className="card-bottom-progress">
          <div className="card-bottom-progress-fill progress" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Chef's Story & Philosophy Card */}
      <div className="ios-card" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Culinary Story & Philosophy</span>
            <span className="card-meta-text">Ancient spice alchemy to your dining table</span>
          </div>
          <Sparkles size={18} color="#007AFF" />
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
          "{chef.philosophy}"
        </p>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
          {chef.bio}
        </p>

        {/* Bullet points adhering to design system */}
        <ul className="body-subtask">
          {chef.careerHighlights.map((hl, idx) => (
            <li key={idx}>{hl}</li>
          ))}
        </ul>

        <div className="card-badges-row">
          <span className="status-pill tag">IHM Pusa Gold Medalist</span>
          <span className="status-pill tag">ITC Bukhara Brigade</span>
          <span className="status-pill done">A2 Gir Cow Ghee</span>
        </div>
      </div>

      {/* Official Culinary Certifications Section - Accredited Diplomas & Audits */}
      {showCredentials && chef?.certifications && chef.certifications.length > 0 && (
        <div className="ios-card" style={{ marginBottom: 16 }}>
          <div className="card-top-row">
            <div className="card-title-group">
              <span className="card-heading">Accredited Diplomas & Audits</span>
              <span className="card-meta-text">Government of India & ICF verified credentials</span>
            </div>
            <Award size={18} color="#D97706" />
          </div>

          <div className="certifications-grid">
            {chef.certifications.map((cert) => (
              <div
                key={cert.id}
                onClick={() => {
                  playTapSound();
                  setSelectedCert(cert);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  gap: 8,
                  minWidth: 0
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: '#FEF3C7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#D97706',
                      flexShrink: 0
                    }}
                  >
                    <Award size={16} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cert.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cert.issuer} • {cert.year}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="status-pill done" style={{ fontSize: 10, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    {cert.badge}
                  </span>
                  <ChevronRight size={14} color="#9CA3AF" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hygiene & Sourcing Pledge Card */}
      {showHygienePledge && chef?.hygieneAndQualityPledge && chef.hygieneAndQualityPledge.length > 0 && (
        <div className="ios-card completed-gradient" style={{ marginBottom: 16 }}>
          <div className="card-top-row">
            <div className="card-title-group">
              <span className="card-heading">FSSAI Hygiene & Organic Sourcing</span>
              <span className="card-meta-text">Uncompromising food safety & farm transparency</span>
            </div>
            <ShieldCheck size={20} color="#16A34A" />
          </div>

          <ul className="body-subtask">
            {chef.hygieneAndQualityPledge.map((pledge, idx) => (
              <li key={idx}>{pledge}</li>
            ))}
          </ul>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Diners Verified: <strong>{verifiedCount}</strong>
            </div>
            <button
              className={`btn-secondary-pill`}
              onClick={handleEndorse}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: hasEndorsed ? '#DCFCE7' : '#F3F4F6',
                color: hasEndorsed ? '#16A34A' : '#111827'
              }}
            >
              <Heart size={13} fill={hasEndorsed ? '#16A34A' : 'none'} color={hasEndorsed ? '#16A34A' : 'currentColor'} />
              <span>{hasEndorsed ? 'Verified & Endorsed' : 'Endorse Chef Standard'}</span>
            </button>
          </div>

          <div className="card-bottom-progress">
            <div className="card-bottom-progress-fill done" style={{ width: '100%' }} />
          </div>
        </div>
      )}

      {/* Signature Dishes Spotlight */}
      <div className="ios-card" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Chef's Verified Signatures</span>
            <span className="card-meta-text">Crafted exclusively by Chef {chef.name}</span>
          </div>
          <UtensilsCrossed size={18} color="#007AFF" />
        </div>

        <div className="chef-signatures-grid">
          {signatureItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '10px',
                background: '#F9FAFB',
                borderRadius: 14,
                border: '1px solid #E5E7EB',
                minWidth: 0
              }}
            >
              <img
                src={item.image || DEFAULT_CUTLERY_IMAGE}
                alt={item.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = DEFAULT_CUTLERY_IMAGE;
                }}
                style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
                  ₹{item.price.toFixed(0)}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {item.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="status-pill tag" style={{ fontSize: 9, padding: '1px 6px' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="btn-primary-pill"
                style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
                onClick={() => {
                  playTapSound();
                  onAddToCart(item);
                }}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Back to Menu CTA */}
      <button
        className="btn-secondary-pill full-width"
        onClick={() => {
          playTapSound();
          onGoToMenu();
        }}
      >
        <span>Return to Full Menu & Order</span>
      </button>

      {/* Official Verification Certificate Inspection Modal */}
      {showVerifyModal && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px'
                }}
              >
                <ShieldCheck size={30} />
              </div>
              <div className="card-heading" style={{ fontSize: 20 }}>FSSAI Verification Registry</div>
              <div className="card-meta-text">Govt. of India Food Safety & Standards Authority Record</div>
            </div>

            <div
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 16
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Certified Master Chef</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{chef.name}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FSSAI License No.</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-blue)' }}>{chef.verificationId}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ICF Registry No.</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{chef.guildRegistryNumber}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Food Safety Certificate No.</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    background: '#F3F4F6',
                    padding: '6px 10px',
                    borderRadius: 8,
                    marginTop: 2
                  }}
                >
                  FSSAI-CERT-2026-REG-9481
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Certification Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span className="status-pill done">VERIFIED & SAFE</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Checked Oct 2026</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Issued By</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {chef.authorityName}
                </div>
              </div>
            </div>

            <button
              className="btn-primary-pill full-width"
              onClick={() => {
                playTapSound();
                setShowVerifyModal(false);
              }}
            >
              <span>Close Certificate</span>
            </button>
          </div>
        </div>
      )}

      {/* Certificate Detail Modal */}
      {selectedCert && (
        <div className="modal-overlay" onClick={() => setSelectedCert(null)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />

            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px'
                }}
              >
                <Award size={26} />
              </div>
              <div className="card-heading" style={{ fontSize: 18 }}>{selectedCert.name}</div>
              <div className="card-meta-text">{selectedCert.issuer}</div>
            </div>

            <div style={{ background: '#F8F9FA', padding: 14, borderRadius: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Conferred Period</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedCert.year}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 4 }}>
                Award Level / Grade
              </div>
              <div className="status-pill done">{selectedCert.badge}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 4 }}>
                Certificate ID
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                CERT-{selectedCert.id.toUpperCase()}-2026
              </div>
            </div>

            <button
              className="btn-secondary-pill full-width"
              onClick={() => {
                playTapSound();
                setSelectedCert(null);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
