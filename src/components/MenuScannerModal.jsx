import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  KeyRound,
  RefreshCw,
  Search,
  ExternalLink,
  Sliders,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  scanMenuDocument,
  parseRawMenuText,
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  COMMON_CATEGORIES
} from '../utils/menuAiParser';

export default function MenuScannerModal(props) {
  return props.isOpen ? <MenuScannerForm {...props} /> : null;
}

function MenuScannerForm({
  isOpen,
  currentMenuCount = 0,
  onImportDishes,
  onClose
}) {

  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste' | 'settings'
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepMessage, setScanStepMessage] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [hasScanned, setHasScanned] = useState(false);
  const [importMode, setImportMode] = useState('add'); // 'add' | 'replace'
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [engineUsed, setEngineUsed] = useState('');

  // AI Settings state
  const [geminiApiKey, setGeminiApiKey] = useState(() => getStoredGeminiApiKey());
  const [apiKeySaveFeedback, setApiKeySaveFeedback] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;
    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      alert('Please upload a PDF document or an image file (PNG, JPG, WebP).');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Perform AI or Heuristic Scanning
  const handleStartScan = async () => {
    playTapSound();
    setErrorMessage('');
    setIsScanning(true);
    setScanStepMessage('Reading menu document structure...');

    // Simulate animated visual progression
    const stepTimer1 = setTimeout(() => {
      setScanStepMessage('Extracting menu dishes, categories & prices...');
    }, 900);
    const stepTimer2 = setTimeout(() => {
      setScanStepMessage('Classifying dietary types (Veg / Non-Veg)...');
    }, 1800);

    try {
      let result;
      if (activeTab === 'paste') {
        if (!pastedText.trim()) {
          setErrorMessage('Please paste some menu text before scanning.');
          setIsScanning(false);
          clearTimeout(stepTimer1);
          clearTimeout(stepTimer2);
          return;
        }
        result = await scanMenuDocument({ rawText: pastedText });
      } else {
        if (!selectedFile) {
          setErrorMessage('Please select a PDF or image file first.');
          setIsScanning(false);
          clearTimeout(stepTimer1);
          clearTimeout(stepTimer2);
          return;
        }
        result = await scanMenuDocument({
          file: selectedFile,
          customApiKey: geminiApiKey
        });
      }

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (result.success && Array.isArray(result.items) && result.items.length > 0) {
        setScannedItems(result.items);
        setSelectedItemIds(new Set(result.items.map((it) => it.id)));
        setHasScanned(true);
        setEngineUsed(result.engine || 'AI Engine');
        playSuccessChime();
      } else if (result.reason === 'REQUIRES_GEMINI_KEY') {
        setErrorMessage(
          'To scan complex images or photos, connect your free Google Gemini API key in the AI Settings tab, or paste text in the Paste Menu Text tab.'
        );
        playAlertChime();
      } else {
        setErrorMessage(result.message || 'No dishes could be detected from this file. Try pasting the menu text or using a clearer image/PDF.');
        playAlertChime();
      }
    } catch (err) {
      console.error('Scan error:', err);
      setErrorMessage(`Scan failed: ${err.message}`);
      playAlertChime();
    } finally {
      setIsScanning(false);
    }
  };

  // Inline modifications in Review Table
  const handleItemFieldChange = (id, field, value) => {
    setScannedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteItem = (id) => {
    playTapSound();
    setScannedItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleSelect = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedItemIds(new Set(scannedItems.map((it) => it.id)));
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const handleAddManualItem = () => {
    playTapSound();
    const newItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: 'New Menu Item',
      category: 'Main Course',
      price: 200,
      isVeg: true,
      isAvailable: true,
      bullets: ['Freshly prepared with authentic ingredients'],
      tags: [],
      image: null
    };
    setScannedItems((prev) => [newItem, ...prev]);
    setSelectedItemIds((prev) => new Set([...prev, newItem.id]));
  };

  // Save Gemini Key
  const handleSaveApiKey = () => {
    playTapSound();
    saveStoredGeminiApiKey(geminiApiKey);
    setApiKeySaveFeedback('✓ Google Gemini API key saved successfully!');
    setTimeout(() => setApiKeySaveFeedback(''), 3500);
  };

  const handleTestApiKey = async () => {
    if (!geminiApiKey.trim()) {
      alert('Please enter a Gemini API key first.');
      return;
    }
    setIsTestingKey(true);
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey.trim()}`;
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, confirm you are working with the word OK.' }] }]
        })
      });

      if (res.ok) {
        saveStoredGeminiApiKey(geminiApiKey);
        alert('🎉 Success! Google Gemini API key is valid and connected.');
      } else {
        const text = await res.text();
        alert(`❌ Connection failed (${res.status}): ${text.slice(0, 150)}`);
      }
    } catch (err) {
      alert(`❌ Connection error: ${err.message}`);
    } finally {
      setIsTestingKey(false);
    }
  };

  // Final Import Handler
  const handleConfirmImport = () => {
    playTapSound();
    const itemsToImport = scannedItems.filter((it) => selectedItemIds.has(it.id));
    if (itemsToImport.length === 0) {
      alert('Please select at least one dish to import.');
      return;
    }

    const cleanedItems = itemsToImport.map((item) => ({
      ...item,
      tags: Array.isArray(item.tags)
        ? item.tags.filter(
            (t) => t && !['scanned', 'manual', 'new', 'unassigned'].includes(String(t).toLowerCase().trim())
          )
        : []
    }));

    onImportDishes(cleanedItems, importMode === 'replace');

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 }
    });

    onClose();
  };

  // Filtered view
  const filteredItems = scannedItems.filter((it) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (it.name || '').toLowerCase().includes(q) ||
      (it.category || '').toLowerCase().includes(q)
    );
  });

  const vegCount = scannedItems.filter((it) => it.isVeg).length;
  const nonVegCount = scannedItems.filter((it) => !it.isVeg).length;
  const uniqueCategories = Array.from(new Set(scannedItems.map((it) => it.category))).length;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 740, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div className="modal-drag-pill" />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #007AFF, #00C6FF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div className="card-heading" style={{ fontSize: 18 }}>AI Menu Scanner &amp; Quick Onboarding</div>
              <div className="card-meta-text">Upload a menu PDF or photo to automatically digitize dishes &amp; prices</div>
            </div>
          </div>
          <button
            className="nav-icon-btn"
            onClick={onClose}
            style={{ width: 32, height: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs (Only if not currently in review mode) */}
        {!hasScanned && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 4,
              background: '#F1F5F9',
              borderRadius: 10,
              marginBottom: 14
            }}
          >
            <button
              type="button"
              onClick={() => { setActiveTab('upload'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'upload' ? '#FFFFFF' : 'transparent',
                fontWeight: activeTab === 'upload' ? 700 : 500,
                color: activeTab === 'upload' ? 'var(--primary-blue)' : '#64748B',
                boxShadow: activeTab === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Upload size={14} />
              <span>Upload PDF or Image</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('paste'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'paste' ? '#FFFFFF' : 'transparent',
                fontWeight: activeTab === 'paste' ? 700 : 500,
                color: activeTab === 'paste' ? 'var(--primary-blue)' : '#64748B',
                boxShadow: activeTab === 'paste' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <FileText size={14} />
              <span>Paste Menu Text</span>
            </button>

            <button
              type="button"
              hidden={import.meta.env.PROD}
              onClick={() => { setActiveTab('settings'); setErrorMessage(''); }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === 'settings' ? '#FFFFFF' : 'transparent',
                fontWeight: activeTab === 'settings' ? 700 : 500,
                color: activeTab === 'settings' ? 'var(--primary-blue)' : '#64748B',
                boxShadow: activeTab === 'settings' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontSize: 12,
                cursor: 'pointer',
                display: import.meta.env.PROD ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <KeyRound size={14} />
              <span>AI Settings</span>
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: '#FEE2E2',
              color: '#B91C1C',
              fontSize: 12,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              border: '1px solid #FCA5A5'
            }}
          >
            <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700 }}>Scanning Notice</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {/* --- VIEW 1: UPLOAD / PASTE FORM --- */}
        {!hasScanned && !isScanning && (
          <div>
            {activeTab === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {!selectedFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #93C5FD',
                      borderRadius: 16,
                      background: '#F8FAFC',
                      padding: '36px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: 14
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: '#EFF6FF',
                        color: 'var(--primary-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px'
                      }}
                    >
                      <Upload size={24} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Drag &amp; drop your menu PDF or photo here
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Supports Adobe PDF, JPG, PNG &amp; WebP (up to 20MB)
                    </div>
                    <button
                      type="button"
                      className="btn-primary-pill"
                      style={{ padding: '8px 18px', fontSize: 13 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Browse Device Files
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: '#EFF6FF',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: 14,
                      marginBottom: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {filePreview ? (
                        <img
                          src={filePreview}
                          alt="Menu Preview"
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 10,
                            objectFit: 'cover',
                            border: '1px solid #93C5FD'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 10,
                            background: '#DBEAFE',
                            color: '#1D4ED8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <FileText size={30} />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFile.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Document'}
                        </div>
                        <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 4 }}>
                          ✓ Ready for automated extraction
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#64748B',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'paste' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Paste menu lines directly (from WhatsApp, Word, email or website):
                </div>
                <textarea
                  className="ios-input"
                  rows={8}
                  style={{
                    width: '100%',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: '1.5',
                    padding: '10px 12px'
                  }}
                  placeholder={`STARTERS\nPaneer Tikka - ₹280\nCrispy Corn - Rs 220\nChicken Malai Tikka - 360\n\nMAIN COURSE\nDal Makhani ... ₹260\nButter Chicken - 420\nPaneer Butter Masala - 320\n\nBREADS\nButter Roti - 35\nGarlic Naan - 75`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </div>
            )}

            {activeTab === 'settings' && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    marginBottom: 12
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    Google Gemini Multimodal Vision API
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', lineHeight: '1.5', marginBottom: 10 }}>
                    Powers automated extraction for complex PDF layouts, multi-column designs, and photos of physical menu cards.
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      GEMINI API KEY
                    </label>
                    <input
                      type="password"
                      className="ios-input"
                      placeholder="AIzaSy..."
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-primary-pill"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={handleSaveApiKey}
                    >
                      Save Key
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-pill"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={handleTestApiKey}
                      disabled={isTestingKey}
                    >
                      {isTestingKey ? 'Testing Connection...' : 'Test Connection'}
                    </button>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 11,
                        color: 'var(--primary-blue)',
                        textDecoration: 'underline',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginLeft: 6
                      }}
                    >
                      <span>Get free Gemini API Key</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {apiKeySaveFeedback && (
                    <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 8 }}>
                      {apiKeySaveFeedback}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions for Form */}
            {activeTab !== 'settings' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  ⚡ Auto-detects dish names, prices, categories &amp; veg/non-veg
                </div>
                <button
                  type="button"
                  className="btn-primary-pill"
                  style={{
                    padding: '10px 22px',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #007AFF, #00C6FF)'
                  }}
                  onClick={handleStartScan}
                  disabled={isScanning}
                >
                  <Sparkles size={16} />
                  <span>Scan Menu Dishes</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW 2: SCANNING LIVE ANIMATION --- */}
        {isScanning && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#EFF6FF',
                border: '3px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                position: 'relative'
              }}
            >
              <Sparkles size={32} color="#007AFF" style={{ animation: 'spin 3s linear infinite' }} />
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              AI Document Digitizer at Work
            </div>
            <div style={{ fontSize: 13, color: 'var(--primary-blue)', fontWeight: 600 }}>
              {scanStepMessage || 'Analyzing menu contents...'}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
              Extracting items, prices, descriptions, and dietary classifications...
            </div>
          </div>
        )}

        {/* --- VIEW 3: INTERACTIVE REVIEW & CUSTOMIZE TABLE --- */}
        {hasScanned && (
          <div>
            {/* Success Summary Pill */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#F0FDF4',
                border: '1.5px solid #86EFAC',
                borderRadius: 14,
                marginBottom: 14,
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>
                  ✓ {scannedItems.length} Dishes Detected!
                </div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                  {vegCount} Vegetarian • {nonVegCount} Non-Veg • {uniqueCategories} Categories
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="btn-secondary-pill"
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#FFFFFF'
                  }}
                >
                  <Plus size={13} />
                  <span>Add Extra Item</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHasScanned(false);
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="btn-secondary-pill"
                  style={{ padding: '6px 12px', fontSize: 11, background: '#FFFFFF' }}
                >
                  Scan Another
                </button>
              </div>
            </div>

            {/* Quick Filter & Selection Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{ fontSize: 11, color: 'var(--primary-blue)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Select All ({scannedItems.length})
                </button>
                <span style={{ color: '#CBD5E1' }}>•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  style={{ fontSize: 11, color: '#64748B', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Deselect All
                </button>
              </div>

              <div style={{ position: 'relative', width: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94A3B8' }} />
                <input
                  type="text"
                  className="ios-input"
                  style={{ paddingLeft: 30, fontSize: 11, height: 32 }}
                  placeholder="Filter detected dishes..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Dishes Table */}
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                marginBottom: 16
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: 'var(--text-muted)', fontSize: 11, textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: 34 }}></th>
                    <th style={{ padding: '8px 10px' }}>Dish Name</th>
                    <th style={{ padding: '8px 10px', width: 140 }}>Category</th>
                    <th style={{ padding: '8px 10px', width: 90 }}>Price (₹)</th>
                    <th style={{ padding: '8px 10px', width: 85 }}>Dietary</th>
                    <th style={{ padding: '8px 10px', width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isSelected ? '#FFFFFF' : '#F8FAFC',
                          opacity: isSelected ? 1 : 0.6
                        }}
                      >
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemFieldChange(item.id, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          />
                        </td>

                        <td style={{ padding: '8px 10px' }}>
                          <select
                            value={item.category}
                            onChange={(e) => handleItemFieldChange(item.id, 'category', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              fontSize: 11
                            }}
                          >
                            {COMMON_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemFieldChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid #E2E8F0',
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--primary-blue)'
                            }}
                          />
                        </td>

                        <td style={{ padding: '8px 10px' }}>
                          <button
                            type="button"
                            onClick={() => handleItemFieldChange(item.id, 'isVeg', !item.isVeg)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: item.isVeg ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                              background: item.isVeg ? '#DCFCE7' : '#FEE2E2',
                              color: item.isVeg ? '#15803D' : '#DC2626',
                              fontWeight: 700,
                              fontSize: 10,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.isVeg ? '#16A34A' : '#DC2626' }} />
                            <span>{item.isVeg ? 'Veg' : 'Non-Veg'}</span>
                          </button>
                        </td>

                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94A3B8',
                              cursor: 'pointer',
                              padding: 4
                            }}
                            title="Remove item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Import Mode Radio Options */}
            <div
              style={{
                padding: '12px 14px',
                background: '#F8FAFC',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                marginBottom: 16
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                HOW SHOULD THESE DISHES BE IMPORTED?
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="add"
                    checked={importMode === 'add'}
                    onChange={() => setImportMode('add')}
                  />
                  <span><strong>Add to Existing Menu</strong> (Keep current {currentMenuCount} items)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  <span style={{ color: importMode === 'replace' ? '#DC2626' : 'inherit' }}>
                    <strong>Replace Current Menu</strong> (Fresh restaurant onboarding)
                  </span>
                </label>
              </div>
            </div>

            {/* Bottom Final Import Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                Selected <strong>{selectedItemIds.size}</strong> of {scannedItems.length} items
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={onClose}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-pill"
                  style={{
                    padding: '8px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #007AFF, #00C6FF)'
                  }}
                  onClick={handleConfirmImport}
                  disabled={selectedItemIds.size === 0}
                >
                  <Check size={16} />
                  <span>Import {selectedItemIds.size} Dishes to Menu</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
