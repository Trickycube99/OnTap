import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Printer,
  ExternalLink,
  X,
  CheckCircle2,
  Sparkles,
  Utensils,
  Store
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { computeTableSignature } from '../utils/tableSecurity';
import SlideModal from './SlideModal';

export default function TableQrModal({
  isOpen,
  onClose,
  activeTable = 'Table 04',
  setActiveTable,
  tables = [
    'Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05',
    'Table 06', 'Table 07', 'Table 08', 'Table 09', 'Table 10',
    'Counter / Takeaway'
  ],
  restaurantName = 'Restaurant',
  logo = null,
  tagline = null,
  businessId = '',
  serviceType = 'dine_in'
}) {
  const [selectedTable, setSelectedTable] = useState(activeTable || 'Table 04');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://restraunt-web-app.vercel.app';
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const isStallMode = serviceType === 'stall' || (tables.length === 1 && (tables[0].toLowerCase().includes('stand') || tables[0].toLowerCase().includes('stall')));
  const isCurrentStall = isStallMode || (selectedTable || '').toLowerCase().includes('stand') || (selectedTable || '').toLowerCase().includes('stall');
  const isTakeaway = isCurrentStall || (selectedTable || '').toLowerCase().includes('takeaway') || (selectedTable || '').toLowerCase().includes('counter');
  const tableNum = (selectedTable || 'Table 04').replace(/\D/g, '').padStart(2, '0');
  const cleanBiz = businessId || '';
  const sig = computeTableSignature(cleanBiz, selectedTable);
  const directMenuUrl = isCurrentStall
    ? `${baseUrl}/?biz=${encodeURIComponent(cleanBiz)}&table=Stand&sig=${encodeURIComponent(sig)}&qr=true#customer`
    : isTakeaway
    ? `${baseUrl}/?biz=${encodeURIComponent(cleanBiz)}&table=Takeaway&sig=${encodeURIComponent(sig)}&qr=true#customer`
    : `${baseUrl}/?biz=${encodeURIComponent(cleanBiz)}&table=${tableNum}&sig=${encodeURIComponent(sig)}&qr=true#customer`;

  // Sync selectedTable when modal opens or activeTable/tables changes
  useEffect(() => {
    if (isOpen) {
      if (activeTable && tables.includes(activeTable)) {
        setSelectedTable(activeTable);
      } else if (tables && tables.length > 0) {
        setSelectedTable(tables[0]);
      }
    }
  }, [isOpen, activeTable, tables, businessId]);

  // Generate QR Code data URL whenever selectedTable or baseUrl changes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    QRCode.toDataURL(
      directMenuUrl,
      {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF'
        }
      },
      (err, url) => {
        if (!err && isMounted) {
          setQrDataUrl(url);
        }
      }
    );
    return () => { isMounted = false; };
  }, [directMenuUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    playTapSound();
    navigator.clipboard.writeText(directMenuUrl).then(() => {
      setIsCopied(true);
      playSuccessChime();
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDownloadQr = () => {
    playTapSound();
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `${cleanBiz}_qr_${selectedTable.toLowerCase().replace(/\s+/g, '_')}.png`;
    link.href = qrDataUrl;
    link.click();
    playSuccessChime();
  };

  const handlePrintTentCard = () => {
    playTapSound();
    window.print();
  };

  return (
    <SlideModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={480}
      ariaLabel="Table QR Standee Modal"
      contentStyle={{ padding: '24px' }}
    >
      {({ dismiss }) => (
        <div>
        {/* Modal Header */}
        <div className="table-qr-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="table-qr-avatar" style={{ background: isStallMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 122, 255, 0.15)' }}>
              {isStallMode ? (
                 <Store size={22} color="#10B981" />
              ) : (
                <QrCode size={22} color="#007AFF" />
              )}
            </div>
            <div>
              <div className="table-qr-badge" style={{ color: isStallMode ? '#10B981' : '#007AFF' }}>
                {isStallMode ? 'Counter Standee QR Code' : 'Table QR Code'}
              </div>
              <h3 className="table-qr-title">
                {isStallMode ? 'Counter QR Standee (Order Number Handout)' : 'Table QR Code for Menu'}
              </h3>
            </div>
          </div>
          <button
            className="auth-modal-close-btn"
            onClick={() => {
              playTapSound();
              dismiss();
            }}
            aria-label="Close QR Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="table-qr-banner">
          <div className="table-qr-banner-title">
            <Sparkles size={14} color="#16A34A" />
            <span>{isStallMode ? 'Counter / Stall Standee' : 'Easy Customer Ordering'}</span>
          </div>
          <p className="table-qr-banner-text">
            {isStallMode ? (
              <>Place this QR standee at your food stall or counter. Customers scan with their mobile camera to order, and receive an <strong>Order Number</strong> for quick counter pickup.</>
            ) : (
              <>Customers simply open their mobile camera and scan this QR code to view the menu and order food. <strong>No app download or sign-in needed.</strong></>
            )}
          </p>
        </div>

        {/* Table Selector Pills */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
            {isStallMode ? 'Active Counter Standee' : 'Select Dining Table'}
          </label>
          <div className="table-selector-scroll">
            {tables.map((t) => (
              <button
                key={t}
                className={`table-pill-btn ${selectedTable === t ? 'active' : ''}`}
                onClick={() => {
                  playTapSound();
                  setSelectedTable(t);
                  if (setActiveTable) setActiveTable(t);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Printable Standee Card Mockup */}
        <div className="qr-standee-preview-card" id="printable-tent-card">
          <div className="qr-standee-header">
            {logo && (
              <img
                src={logo}
                alt={restaurantName}
                style={{
                  maxHeight: 34,
                  maxWidth: 120,
                  objectFit: 'contain',
                  margin: '0 auto 6px',
                  display: 'block'
                }}
              />
            )}
            <span className="qr-standee-brand">{restaurantName}</span>
            <span className="qr-standee-sub">{tagline || (isStallMode ? 'Scan to Order • Pick Up at Counter' : 'Scan to View Menu & Order')}</span>
          </div>

          <div className="qr-standee-table-badge" style={{ borderColor: isStallMode ? '#10B981' : undefined, color: isStallMode ? '#047857' : undefined }}>
            {isStallMode ? (
              <>
                <Store size={12} color="#10B981" />
                <span>Counter • Stand & Eat (Order Numbers)</span>
              </>
            ) : (
              <>
                <Utensils size={12} color="#007AFF" />
                <span>{selectedTable}</span>
              </>
            )}
          </div>

          {/* Scannable High-Res QR */}
          <div className="qr-image-container">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Instant Ordering QR Code for ${selectedTable}`}
                className="qr-rendered-img"
              />
            ) : (
              <div className="qr-skeleton-box">
                <QrCode size={64} color="#CBD5E1" />
              </div>
            )}
          </div>

          <div className="qr-standee-footer">
            <div className="qr-cta-bold">
              {isStallMode ? 'SCAN TO ORDER • PICK UP BY ORDER NUMBER' : 'SCAN WITH CAMERA TO ORDER'}
            </div>
            <div className="qr-cta-sub">
              {isStallMode
                ? 'Orders Handed Out by Order Number • No Sign-In Required'
                : (isTakeaway ? 'Instant Counter / Takeaway Pick-Up • No Sign-In Required' : 'Instant Table Service • No Sign-In Required')}
            </div>
          </div>
        </div>

        {/* Direct Link & Base URL Controls */}
        <div className="qr-url-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Menu Web Link:</span>
            <a
              href={directMenuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="qr-test-link"
              onClick={playTapSound}
            >
              <span>Open Link</span>
              <ExternalLink size={11} />
            </a>
          </div>
          <div className="qr-url-text">{directMenuUrl}</div>
        </div>

        {/* Actions Bar */}
        <div className="qr-actions-grid">
          <button
            className="btn-secondary-pill qr-action-btn"
            onClick={handleCopyLink}
          >
            {isCopied ? <CheckCircle2 size={15} color="#16A34A" /> : <Copy size={15} />}
            <span>{isCopied ? 'Link Copied!' : 'Copy Link'}</span>
          </button>

          <button
            className="btn-secondary-pill qr-action-btn"
            onClick={handleDownloadQr}
          >
            <Download size={15} />
            <span>Download QR Image</span>
          </button>

          <button
            className="btn-primary-pill qr-action-btn print-btn"
            onClick={handlePrintTentCard}
          >
            <Printer size={15} />
            <span>Print QR Card</span>
          </button>
        </div>
      </div>
      )}
    </SlideModal>
  );
}
