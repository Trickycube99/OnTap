import React, { useState } from 'react';
import {
  Boxes,
  TrendingDown
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';

export default function InventoryView({ menu: _menu }) {
  const [ingredients, setIngredients] = useState([
    { id: 'ing-1', name: 'A2 Gir Cow Clarified Ghee', category: 'Dairy & Fats', inStock: 18.5, unit: 'kg', reorderLevel: 5.0, costPerUnit: 1100 },
    { id: 'ing-2', name: 'Fresh Prime Farm Chicken', category: 'Poultry', inStock: 6.2, unit: 'kg', reorderLevel: 8.0, costPerUnit: 240, isLow: true },
    { id: 'ing-3', name: 'Artisanal Fresh Burrata Cheese', category: 'Dairy & Fats', inStock: 14, unit: 'pieces', reorderLevel: 6, costPerUnit: 180 },
    { id: 'ing-4', name: 'Chikmagalur Single-Origin Coffee Beans', category: 'Dry Pantry', inStock: 12.0, unit: 'kg', reorderLevel: 4.0, costPerUnit: 850 },
    { id: 'ing-5', name: 'Ratnagiri Alphonso Mango Puree', category: 'Beverages', inStock: 8.5, unit: 'litres', reorderLevel: 5.0, costPerUnit: 320 },
    { id: 'ing-6', name: 'Slow Cold-Fermented Sourdough Dough', category: 'Bakery', inStock: 25, unit: 'dough balls', reorderLevel: 10, costPerUnit: 45 }
  ]);

  const [wastageLog, setWastageLog] = useState([
    { id: 'w-1', date: '2026-10-14', ingredient: 'Fresh Prime Farm Chicken', quantity: '1.2 kg', reason: 'Tandoor marinade hold time exceeded (FSSAI audit)', loss: 288 },
    { id: 'w-2', date: '2026-10-12', ingredient: 'Artisanal Fresh Burrata Cheese', quantity: '2 pieces', reason: 'Cold chain transit temperature drop', loss: 360 }
  ]);

  // Wastage Form
  const [selectedIng, setSelectedIng] = useState(ingredients[0].name);
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('');

  const handleLogWastage = (e) => {
    e.preventDefault();
    playTapSound();
    const qtyNum = parseFloat(wasteQty);
    if (!qtyNum || isNaN(qtyNum)) return;

    const matchedIng = ingredients.find((i) => i.name === selectedIng);
    const lossValue = Math.round(qtyNum * (matchedIng ? matchedIng.costPerUnit : 100));

    const newLog = {
      id: `w-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      ingredient: selectedIng,
      quantity: `${qtyNum} ${matchedIng?.unit || 'units'}`,
      reason: wasteReason || 'Prep trim & quality discard',
      loss: lossValue
    };

    setWastageLog((prev) => [newLog, ...prev]);

    // Deduct stock
    setIngredients((prev) =>
      prev.map((i) => (i.name === selectedIng ? { ...i, inStock: Math.max(0, Number((i.inStock - qtyNum).toFixed(1))) } : i))
    );

    setWasteQty('');
    setWasteReason('');
    playSuccessChime();
  };

  const totalInventoryValue = ingredients.reduce((sum, i) => sum + i.inStock * i.costPerUnit, 0);
  const lowStockCount = ingredients.filter((i) => i.inStock <= i.reorderLevel).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div className="screen-title">Kitchen Stock & Wastage</div>
        <div className="screen-subtitle">Check raw ingredients in stock, low supplies, and wasted items</div>
      </div>

      {/* Top Inventory Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Stock Value</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
            ₹{totalInventoryValue.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low Stock Warning</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: lowStockCount > 0 ? '#DC2626' : '#16A34A', marginTop: 2 }}>
            {lowStockCount} Items Low
          </div>
        </div>

        <div className="ios-card" style={{ padding: '10px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wasted Items (This Week)</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706', marginTop: 2 }}>
            ₹{wastageLog.reduce((s, w) => s + w.loss, 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Raw Ingredients Stock Table */}
      <div className="ios-card" style={{ marginBottom: 16 }}>
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Kitchen Ingredients & Supplies</span>
            <span className="card-meta-text">Current stock in kitchen and minimum required</span>
          </div>
          <Boxes size={20} color="#007AFF" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ingredients.map((ing) => {
            const isLow = ing.inStock <= ing.reorderLevel;

            return (
              <div
                key={ing.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: isLow ? '#FEF2F2' : '#F9FAFB',
                  border: isLow ? '1px solid #FCA5A5' : '1px solid #E5E7EB',
                  borderRadius: 14
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{ing.name}</span>
                    {isLow && (
                      <span className="status-pill tag" style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 9 }}>
                        Buy Soon
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Category: {ing.category} • Cost: ₹{ing.costPerUnit}/{ing.unit}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isLow ? '#DC2626' : '#111827' }}>
                    {ing.inStock} {ing.unit}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Min Needed: {ing.reorderLevel} {ing.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kitchen Wastage Logger */}
      <div className="ios-card">
        <div className="card-top-row">
          <div className="card-title-group">
            <span className="card-heading">Record Wasted or Spoiled Food</span>
            <span className="card-meta-text">Keep track of expired, spilled, or spoiled food items</span>
          </div>
          <TrendingDown size={20} color="#DC2626" />
        </div>

        <form onSubmit={handleLogWastage} style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Select Item</label>
              <select
                className="ios-select"
                value={selectedIng}
                onChange={(e) => setSelectedIng(e.target.value)}
              >
                {ingredients.map((i) => (
                  <option key={i.id} value={i.name}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Quantity Wasted</label>
              <input
                type="number"
                step="0.1"
                className="ios-input"
                placeholder="e.g. 1.5"
                value={wasteQty}
                onChange={(e) => setWasteQty(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Reason (e.g. Expired, Burnt)</label>
            <input
              type="text"
              className="ios-input"
              placeholder="e.g. Expired, burnt during cooking, spilled"
              value={wasteReason}
              onChange={(e) => setWasteReason(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary-pill full-width" style={{ background: '#DC2626' }}>
            <span>Save & Deduct from Stock</span>
          </button>
        </form>

        {/* Wastage History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Recent Wasted Items:</div>
          {wastageLog.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: '#F9FAFB',
                borderRadius: 10,
                fontSize: 12
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{w.ingredient} ({w.quantity})</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {w.reason} • {w.date}
                </div>
              </div>
              <span style={{ fontWeight: 700, color: '#DC2626' }}>-₹{w.loss}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
