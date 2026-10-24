import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  ShoppingBag,
  Search,
  Check
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import { broadcastSyncEvent, SYNC_EVENTS } from '../utils/sync';

export default function PunchWalkInOrders({
  activeBusinessId = '',
  orders,
  setOrders,
  menu = [],
  tables = [
    'Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05',
    'Table 06', 'Table 07', 'Counter / Takeaway'
  ],
  onOrderSubmitted = null
}) {
  const [grids, setGrids] = useState([
    {
      id: 1,
      table: tables[0] || 'Table 01',
      customer: 'Walk-in Diner',
      payment: 'Cash Settled',
      items: [],
      search: ''
    }
  ]);
  const [successToast, setSuccessToast] = useState(null);

  // Add a new Walk-in Order Grid
  const handleAddGrid = () => {
    playTapSound();
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const gridIndex = grids.length + 1;
    const defaultTable = tables[(gridIndex - 1) % tables.length] || 'Table 01';

    setGrids((prev) => [
      ...prev,
      {
        id: newId,
        table: defaultTable,
        customer: `Walk-in Diner #${gridIndex}`,
        payment: 'Cash Settled',
        items: [],
        search: ''
      }
    ]);
  };

  // Remove / Discard an extra grid
  const handleRemoveGrid = (gridId) => {
    playTapSound();
    if (grids.length <= 1) return;
    setGrids((prev) => prev.filter((g) => g.id !== gridId));
  };

  // Update fields on a specific grid
  const handleUpdateGridField = (gridId, field, value) => {
    setGrids((prev) =>
      prev.map((g) => (g.id === gridId ? { ...g, [field]: value } : g))
    );
  };

  // Add dish to a grid
  const handleAddDish = (gridId, dish) => {
    playTapSound();
    setGrids((prev) =>
      prev.map((g) => {
        if (g.id !== gridId) return g;
        const exists = g.items.find((i) => i.id === dish.id);
        let updatedItems;
        if (exists) {
          updatedItems = g.items.map((i) =>
            i.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        } else {
          updatedItems = [...g.items, { ...dish, quantity: 1, note: '' }];
        }
        return { ...g, items: updatedItems };
      })
    );
  };

  // Stepper quantity update (+1 or -1; removes if 0)
  const handleUpdateQuantity = (gridId, dishId, delta) => {
    playTapSound();
    setGrids((prev) =>
      prev.map((g) => {
        if (g.id !== gridId) return g;
        const updatedItems = g.items
          .map((i) => {
            if (i.id === dishId) {
              const newQty = i.quantity + delta;
              return newQty > 0 ? { ...i, quantity: newQty } : null;
            }
            return i;
          })
          .filter(Boolean);
        return { ...g, items: updatedItems };
      })
    );
  };

  // Remove dish completely from a grid
  const handleRemoveDish = (gridId, dishId) => {
    playTapSound();
    setGrids((prev) =>
      prev.map((g) => {
        if (g.id !== gridId) return g;
        return {
          ...g,
          items: g.items.filter((i) => i.id !== dishId)
        };
      })
    );
  };

  // Clear all dishes from a grid
  const handleClearTray = (gridId) => {
    playTapSound();
    setGrids((prev) =>
      prev.map((g) => (g.id === gridId ? { ...g, items: [] } : g))
    );
  };

  // Submit and punch order
  const handlePunchOrder = (grid) => {
    if (!grid.items || grid.items.length === 0) {
      playAlertChime();
      return;
    }
    playTapSound();

    const subtotal = grid.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const tax = 0; // Taxes are included in dish prices
    const total = Number(subtotal.toFixed(2));

    const uniqueOrderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      id: uniqueOrderId,
      businessId: activeBusinessId,
      customerName: (grid.customer || '').trim() || 'Walk-in Diner',
      table: grid.table,
      phone: 'Walk-in POS',
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      statusLabel: 'Punched at Counter',
      items: grid.items,
      orderNote: 'Direct POS manual walk-in order',
      paymentMode: grid.payment,
      paymentStatus: 'Settled at Counter',
      subtotal,
      tax,
      discount: 0,
      total,
      progressPercent: 50
    };

    if (setOrders) {
      setOrders((prev) => [newOrder, ...prev]);
    }

    broadcastSyncEvent(SYNC_EVENTS.NEW_ORDER, newOrder, activeBusinessId);
    playSuccessChime();

    setSuccessToast(`Order ${newOrder.id} (${newOrder.table}) punched successfully!`);
    setTimeout(() => setSuccessToast(null), 3500);

    const otherGridsWithItems = grids.filter((g) => g.id !== grid.id && Array.isArray(g.items) && g.items.length > 0);
    const hasOtherGridsWithItems = otherGridsWithItems.length > 0;

    // If multiple grids exist, remove this grid; otherwise reset the single grid
    setGrids((prev) => {
      if (prev.length > 1) {
        return prev.filter((g) => g.id !== grid.id);
      }
      return [
        {
          id: 1,
          table: tables[0] || 'Table 01',
          customer: 'Walk-in Diner',
          payment: 'Cash Settled',
          items: [],
          search: ''
        }
      ];
    });

    if (onOrderSubmitted) {
      onOrderSubmitted(newOrder, { hasOtherGridsWithItems, otherGridsWithItemsCount: otherGridsWithItems.length });
    }
  };

  return (
    <div className="punch-walkin-container">
      {/* Top Banner / Toast Alert */}
      {successToast && (
        <div
          style={{
            background: '#F0FDF4',
            border: '1.5px solid #BBF7D0',
            color: '#15803D',
            padding: '10px 14px',
            borderRadius: 12,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <Check size={16} color="#16A34A" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Multi-Grid Bar when more than 1 grid is open */}
      {grids.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            padding: '8px 12px',
            borderRadius: 12,
            marginBottom: 14,
            gap: 10,
            overflowX: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
            <span>Active Walk-in Grids:</span>
            <span
              style={{
                background: '#007AFF',
                color: '#FFF',
                borderRadius: 10,
                padding: '1px 7px',
                fontSize: 11
              }}
            >
              {grids.length}
            </span>
          </div>

          <button
            type="button"
            className="btn-secondary-pill"
            onClick={handleAddGrid}
            title="Add another walk-in grid at the same time"
            style={{
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              color: '#007AFF',
              borderColor: '#BFDBFE',
              background: '#EFF6FF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <Plus size={14} color="#007AFF" strokeWidth={2.5} />
            <span>Add Another Grid</span>
          </button>
        </div>
      )}

      {/* Grid Cards Container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: grids.length > 1 ? 'repeat(auto-fit, minmax(350px, 1fr))' : '1fr',
          gap: 16
        }}
      >
        {grids.map((grid, index) => {
          const totalQty = grid.items.reduce((acc, i) => acc + i.quantity, 0);
          const subtotal = grid.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
          const total = subtotal.toFixed(0);

          const filteredMenu = (menu || []).filter((dish) => {
            if (dish.isAvailable === false) return false;
            if (!grid.search || !grid.search.trim()) return true;
            return (
              dish.name.toLowerCase().includes(grid.search.toLowerCase()) ||
              (dish.category && dish.category.toLowerCase().includes(grid.search.toLowerCase()))
            );
          });

          return (
            <div key={grid.id} className="ios-card" style={{ marginBottom: 0 }}>
              {/* Card Header Row */}
              <div className="card-top-row" style={{ alignItems: 'flex-start' }}>
                <div className="card-title-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="card-heading">
                      Punch Walk-in or Phone Order
                      {grids.length > 1 && ` (Grid #${index + 1})`}
                    </span>
                    {totalQty > 0 && (
                      <span
                        className="status-pill tag"
                        style={{ fontSize: 10, background: '#EFF6FF', color: '#007AFF', borderColor: '#BFDBFE' }}
                      >
                        {totalQty} item{totalQty > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span className="card-meta-text">
                    Record in-person sales directly to the kitchen stack
                  </span>
                </div>

                {/* Right controls: Add Grid (+) & Close Grid */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {grids.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGrid(grid.id)}
                      className="btn-secondary-pill"
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        color: '#EF4444',
                        borderColor: '#FECACA',
                        background: '#FEF2F2',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      title="Discard this order grid"
                    >
                      <X size={12} color="#EF4444" />
                      <span>Close</span>
                    </button>
                  )}

                  {/* Interactive working "+" Button to add more walk-in grids */}
                  <button
                    type="button"
                    className="btn-secondary-pill"
                    onClick={handleAddGrid}
                    title="Add another walk-in grid at the same time"
                    style={{
                      padding: '5px 9px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#007AFF',
                      borderColor: '#BFDBFE',
                      background: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={16} color="#007AFF" strokeWidth={2.5} />
                    <span style={{ fontSize: 11 }}>Add Grid</span>
                  </button>
                </div>
              </div>

              {/* Table & Customer Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Table / Counter
                  </label>
                  <select
                    className="ios-select"
                    value={grid.table}
                    onChange={(e) => handleUpdateGridField(grid.id, 'table', e.target.value)}
                  >
                    {tables.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    value={grid.customer}
                    onChange={(e) => handleUpdateGridField(grid.id, 'customer', e.target.value)}
                    placeholder="Walk-in Diner"
                  />
                </div>
              </div>

              {/* Payment Mode Selection */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Payment Settlement
                </label>
                <select
                  className="ios-select"
                  value={grid.payment}
                  onChange={(e) => handleUpdateGridField(grid.id, 'payment', e.target.value)}
                >
                  <option value="Cash Settled">Cash Settled</option>
                  <option value="Card Terminal Settled">Card Terminal Settled (Pine Labs)</option>
                  <option value="UPI QR Settled">UPI QR Settled (GPay / PhonePe / Paytm)</option>
                </select>
              </div>

              {/* Selected Tray (With Dish Removal and Quantity Adjustment) */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Selected Items ({totalQty}):
                  </label>
                  {grid.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearTray(grid.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      title="Clear all dishes from this order"
                    >
                      <Trash2 size={11} color="#EF4444" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>

                {grid.items.length > 0 ? (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 12,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    {grid.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: 8,
                          padding: '6px 10px',
                          gap: 8
                        }}
                      >
                        {/* Item Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#0F172A',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            ₹{item.price} each
                          </div>
                        </div>

                        {/* Quantity Controls: [-] [qty] [+] */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              background: '#F1F5F9',
                              borderRadius: 6,
                              padding: 2
                            }}
                          >
                            {/* Decrease or Remove if 1 */}
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(grid.id, item.id, -1)}
                              style={{
                                width: 24,
                                height: 24,
                                border: 'none',
                                background: '#FFFFFF',
                                borderRadius: 5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              title={item.quantity === 1 ? 'Remove dish' : 'Decrease quantity'}
                            >
                              {item.quantity === 1 ? (
                                <Trash2 size={12} color="#EF4444" />
                              ) : (
                                <Minus size={12} color="#475569" />
                              )}
                            </button>

                            <span
                              style={{
                                minWidth: 24,
                                textAlign: 'center',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#0F172A'
                              }}
                            >
                              {item.quantity}
                            </span>

                            {/* Increase Quantity */}
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(grid.id, item.id, 1)}
                              style={{
                                width: 24,
                                height: 24,
                                border: 'none',
                                background: '#FFFFFF',
                                borderRadius: 5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                              title="Increase quantity"
                            >
                              <Plus size={12} color="#007AFF" />
                            </button>
                          </div>

                          {/* Item Subtotal */}
                          <div
                            style={{
                              minWidth: 50,
                              textAlign: 'right',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#0F172A'
                            }}
                          >
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </div>

                          {/* Direct Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveDish(grid.id, item.id)}
                            style={{
                              width: 26,
                              height: 26,
                              border: 'none',
                              background: 'rgba(239, 68, 68, 0.1)',
                              borderRadius: 5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Remove this dish"
                          >
                            <Trash2 size={12} color="#EF4444" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Tray Total Calculation */}
                    <div
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        paddingTop: 8,
                        marginTop: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>
                        Taxes: Inclusive in dish prices
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                        Total: ₹{total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      borderRadius: 10,
                      border: '1px dashed #CBD5E1',
                      color: '#64748B',
                      fontSize: 12
                    }}
                  >
                    No dishes selected yet. Tap any dish below to add it.
                  </div>
                )}
              </div>

              {/* Quick Menu Picker */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}
                >
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Tap Dishes to Add:
                  </label>
                  <div style={{ position: 'relative', width: 140 }}>
                    <Search
                      size={11}
                      color="#94A3B8"
                      style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="Search..."
                      value={grid.search}
                      onChange={(e) => handleUpdateGridField(grid.id, 'search', e.target.value)}
                      style={{ padding: '3px 8px 3px 22px', fontSize: 11, height: 26 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    maxHeight: 220,
                    overflowY: 'auto',
                    paddingRight: 2
                  }}
                >
                  {filteredMenu.map((dish) => {
                    const existingItem = grid.items.find((i) => i.id === dish.id);
                    const qty = existingItem ? existingItem.quantity : 0;

                    return (
                      <button
                        key={dish.id}
                        type="button"
                        className="btn-secondary-pill"
                        style={{
                          padding: '7px 9px',
                          fontSize: 12,
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          position: 'relative',
                          borderColor: qty > 0 ? '#93C5FD' : '#E5E7EB',
                          background: qty > 0 ? '#EFF6FF' : '#F9FAFB'
                        }}
                        onClick={() => handleAddDish(grid.id, dish)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                          {qty > 0 && (
                            <span
                              style={{
                                background: '#007AFF',
                                color: '#FFF',
                                borderRadius: 8,
                                padding: '1px 5px',
                                fontSize: 10,
                                fontWeight: 700
                              }}
                            >
                              x{qty}
                            </span>
                          )}
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: qty > 0 ? '#1E3A8A' : 'var(--text-primary)',
                              fontWeight: qty > 0 ? 600 : 500
                            }}
                          >
                            {dish.name}
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--primary-blue)', flexShrink: 0, marginLeft: 4 }}>
                          ₹{dish.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Confirm & Punch Button */}
              <button
                type="button"
                className="btn-primary-pill full-width"
                onClick={() => handlePunchOrder(grid)}
                disabled={grid.items.length === 0}
                style={{
                  opacity: grid.items.length === 0 ? 0.5 : 1,
                  cursor: grid.items.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <CheckCircle2 size={16} />
                <span>
                  Confirm & Punch Order to Live Stack (₹{total})
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
