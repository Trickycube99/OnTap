import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';
import { playTapSound } from '../utils/audio';

export default function PrinterModal({ order, theme, chef, onClose }) {
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' | '58mm'
  const [printType, setPrintType] = useState('bill'); // 'bill' | 'kot'

  if (!order) return null;

  const handlePrint = () => {
    playTapSound();
    window.print();
  };

  const invoiceNumber = `INV-${order.id.replace('ORD-', '')}-2026`;
  const printDate = new Date(order.createdAt).toLocaleDateString('en-IN');
  const printTime = new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '92vh' }}
      >
        <div className="modal-drag-pill" />

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="card-heading" style={{ fontSize: 18 }}>Print Bill & Kitchen Order</div>
            <div className="card-meta-text">Print customer receipt or kitchen slip</div>
          </div>
          <button className="nav-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Control Toggles */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Print Option
            </label>
            <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 2 }}>
              <button
                type="button"
                className={`role-tab-btn ${printType === 'bill' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setPrintType('bill')}
              >
                Customer Bill
              </button>
              <button
                type="button"
                className={`role-tab-btn ${printType === 'kot' ? 'active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setPrintType('kot')}
              >
                Kitchen Slip (KOT)
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Paper Size
            </label>
            <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 10, padding: 2 }}>
              <button
                type="button"
                className={`role-tab-btn ${paperWidth === '80mm' ? 'active' : ''}`}
                onClick={() => setPaperWidth('80mm')}
              >
                80mm
              </button>
              <button
                type="button"
                className={`role-tab-btn ${paperWidth === '58mm' ? 'active' : ''}`}
                onClick={() => setPaperWidth('58mm')}
              >
                58mm
              </button>
            </div>
          </div>
        </div>

        {/* Thermal Slip Visual Preview Container */}
        <div
          id="thermal-print-area"
          style={{
            width: paperWidth === '80mm' ? '320px' : '240px',
            margin: '0 auto 16px',
            background: '#FFFDF9',
            border: '1px dashed #D1D5DB',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            padding: '16px 14px',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: paperWidth === '80mm' ? '12px' : '10.5px',
            lineHeight: 1.4,
            color: '#111827'
          }}
        >
          {printType === 'bill' ? (
            <>
              {/* Restaurant Header */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                {theme?.logo && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <img
                      src={theme.logo}
                      alt={theme.restaurantName}
                      style={{
                        maxHeight: 38,
                        maxWidth: 130,
                        objectFit: 'contain',
                        filter: 'grayscale(100%) contrast(150%)'
                      }}
                    />
                  </div>
                )}
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{theme.restaurantName}</div>
                {theme.tagline && <div style={{ fontSize: '11px' }}>{theme.tagline}</div>}
                {theme.address && <div style={{ fontSize: '10px', color: '#4B5563' }}>{theme.address}</div>}
                {(theme.fssai || chef.fssaiLicense) && (
                  <div style={{ fontSize: '10px', color: '#4B5563' }}>FSSAI Lic: {theme.fssai || chef.fssaiLicense}</div>
                )}
                {theme.gstin && <div style={{ fontSize: '10px', color: '#4B5563' }}>GSTIN: {theme.gstin}</div>}
                <div>--------------------------------</div>
                <div style={{ fontWeight: 'bold' }}>TAX INVOICE</div>
              </div>

              {/* Bill Metadata */}
              <div style={{ marginBottom: 6 }}>
                <div>Inv No : {invoiceNumber}</div>
                <div>Table  : {order.table}</div>
                <div>Diner  : {order.customerName}</div>
                <div>Date   : {printDate} {printTime}</div>
                <div>Server : Rahul S. (Captain)</div>
                <div>--------------------------------</div>
              </div>

              {/* Items Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: 4 }}>
                <span>Item [Qty]</span>
                <span>Amount</span>
              </div>
              <div>--------------------------------</div>

              {/* Item Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '4px 0' }}>
                {order.items.map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name} x{item.quantity}
                      </span>
                      <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                    {item.note && (
                      <div style={{ fontSize: '10px', fontStyle: 'italic', paddingLeft: 8 }}>
                        * {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>--------------------------------</div>

              {/* Totals & Tax Calculation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{Number(order.subtotal || order.total || 0).toFixed(0)}</span>
                </div>
                {Number(order.tax) > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>CGST (2.5%):</span>
                      <span>₹{(order.tax / 2).toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>SGST (2.5%):</span>
                      <span>₹{(order.tax / 2).toFixed(1)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#444' }}>
                    <span>Taxes:</span>
                    <span>Inclusive in dish prices</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-₹{order.discount.toFixed(0)}</span>
                  </div>
                )}
                <div>================================</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                  <span>GRAND TOTAL:</span>
                  <span>₹{order.total.toFixed(0)}</span>
                </div>
                <div>================================</div>
              </div>

              {/* Payment Mode & Status */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div>Mode: {order.paymentMode}</div>
                <div style={{ fontSize: '10px', marginTop: 2 }}>{order.paymentStatus}</div>
                <div style={{ fontSize: '10px', marginTop: 8 }}>Thank you for dining with us!</div>
                <div style={{ fontSize: '9px', color: '#6B7280' }}>Verified by Chef {chef.name}</div>
              </div>
            </>
          ) : (
            <>
              {/* KOT (Kitchen Order Ticket) Header */}
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>*** KITCHEN ORDER TICKET ***</div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginTop: 2 }}>TABLE: {order.table.toUpperCase()}</div>
                <div>Ticket: {order.id} | Server: Captain</div>
                <div>Time: {printTime}</div>
                <div>================================</div>
              </div>

              {/* KOT Items in BOLD */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ borderBottom: '1px dashed #D1D5DB', paddingBottom: 4 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                      [{item.quantity}x] {item.name}
                    </div>
                    {item.note && (
                      <div style={{ fontSize: '11px', background: '#FEF08A', padding: '2px 4px', display: 'inline-block', marginTop: 2 }}>
                        INSTRUCTION: {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {order.orderNote && (
                <div style={{ background: '#FFEDD5', padding: '6px', fontSize: '11px', fontWeight: 'bold', marginTop: 6 }}>
                  TABLE NOTE: {order.orderNote}
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: 8, fontSize: '11px' }}>
                <div>================================</div>
                <div>KITCHEN COOKING SLIP</div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary-pill full-width" onClick={handlePrint}>
            <Printer size={16} />
            <span>Print {printType === 'bill' ? 'Customer Bill' : 'Kitchen Slip'}</span>
          </button>
          <button className="btn-secondary-pill" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
