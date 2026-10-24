import React, { useState } from 'react';
import {
  Boxes,
  TrendingDown,
  Plus,
  PackageOpen,
  Download
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { triggerCsvDownload } from '../utils/salesBridge';

export default function InventoryView({ menu: _menu }) {
  const [ingredients, setIngredients] = useState([]);
  const [wastageLog, setWastageLog] = useState([]);

  // Add Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngCat, setNewIngCat] = useState('Dairy & Fats');
  const [newIngStock, setNewIngStock] = useState('');
  const [newIngUnit, setNewIngUnit] = useState('kg');
  const [newIngReorder, setNewIngReorder] = useState('5');
  const [newIngCost, setNewIngCost] = useState('');

  // Wastage Form
  const [selectedIng, setSelectedIng] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteReason, setWasteReason] = useState('');

  const handleExportInventoryCsv = () => {
    playTapSound();
    let exportItems = ingredients.length > 0 ? ingredients : [
      { id: 'ING-01', name: 'Amul Fresh Malai Paneer', category: 'Dairy & Fats', inStock: 18.5, unit: 'kg', costPerUnit: 340, reorderLevel: 5 },
      { id: 'ING-02', name: 'Daawat Rozana Basmati Rice', category: 'Grains & Staples', inStock: 45.0, unit: 'kg', costPerUnit: 95, reorderLevel: 10 },
      { id: 'ING-03', name: 'Fresh Farm Chicken Breast', category: 'Meat & Poultry', inStock: 22.0, unit: 'kg', costPerUnit: 240, reorderLevel: 8 },
      { id: 'ING-04', name: 'Fortune Refined Sunflower Oil', category: 'Oils & Fats', inStock: 30.0, unit: 'litres', costPerUnit: 135, reorderLevel: 10 },
      { id: 'ING-05', name: 'Fresh Red Onions (Nashik)', category: 'Produce & Veg', inStock: 50.0, unit: 'kg', costPerUnit: 35, reorderLevel: 15 },
      { id: 'ING-06', name: 'Fresh Vine Tomatoes (Bengaluru)', category: 'Produce & Veg', inStock: 35.0, unit: 'kg', costPerUnit: 40, reorderLevel: 10 },
      { id: 'ING-07', name: 'Everest Shahi Garam Masala', category: 'Spices & Seasoning', inStock: 4.5, unit: 'kg', costPerUnit: 480, reorderLevel: 1.5 },
      { id: 'ING-08', name: 'Amul Butter Salted (100g blocks)', category: 'Dairy & Fats', inStock: 14.0, unit: 'kg', costPerUnit: 520, reorderLevel: 4 }
    ];

    const headers = [
      'Item Code',
      'Ingredient / Raw Material',
      'Inventory Category',
      'Current Stock in Store',
      'Unit of Measure',
      'Unit Purchase Cost (INR)',
      'Total Stock Value (INR)',
      'Minimum Reorder Threshold',
      'Stock Health Status'
    ];

    const rows = exportItems.map((ing) => {
      const stock = Number(ing.inStock || 0);
      const cost = Number(ing.costPerUnit || 0);
      const val = stock * cost;
      const reorder = Number(ing.reorderLevel || 0);
      const status = stock <= reorder ? 'CRITICAL LOW STOCK' : 'Healthy Stock';

      return [
        ing.id || 'ING-01',
        ing.name,
        ing.category,
        stock.toFixed(2),
        ing.unit,
        cost.toFixed(2),
        val.toFixed(2),
        reorder.toFixed(2),
        status
      ];
    });

    triggerCsvDownload(headers, rows, `kitchen_inventory_stock_register_${new Date().toISOString().slice(0, 10)}.csv`);
    playSuccessChime();
  };

  const handleAddIngredient = (e) => {
    e.preventDefault();
    playTapSound();
    if (!newIngName.trim()) return;

    const newItem = {
      id: `ing-${Date.now()}`,
      name: newIngName.trim(),
      category: newIngCat,
      inStock: parseFloat(newIngStock) || 0,
      unit: newIngUnit.trim() || 'units',
      reorderLevel: parseFloat(newIngReorder) || 0,
      costPerUnit: parseFloat(newIngCost) || 0
    };

    setIngredients((prev) => [...prev, newItem]);
    if (!selectedIng) setSelectedIng(newItem.name);
    setNewIngName('');
    setNewIngStock('');
    setNewIngCost('');
    setShowAddForm(false);
    playSuccessChime();
  };

  const handleLogWastage = (e) => {
    e.preventDefault();
    playTapSound();
    const qtyNum = parseFloat(wasteQty);
    if (!qtyNum || isNaN(qtyNum) || !selectedIng) return;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div className="screen-title">Kitchen Stock & Wastage</div>
          <div className="screen-subtitle">Real-time raw ingredient tracking, low supplies, and waste recording</div>
        </div>
        <button
          type="button"
          className="btn-secondary-pill"
          onClick={handleExportInventoryCsv}
          style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          title="Export kitchen ingredient stock register to CSV"
        >
          <Download size={14} />
          <span>Export Stock (CSV)</span>
        </button>
      </div>

      {/* Top Inventory Metrics */}
      <div className="responsive-kpi-grid-3" style={{ marginBottom: 16 }}>
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wasted Items</div>
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
          <button
            type="button"
            className="btn-secondary-pill"
            style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => {
              playTapSound();
              setShowAddForm(!showAddForm);
            }}
          >
            <Plus size={13} />
            <span>{showAddForm ? 'Cancel' : 'Add Item'}</span>
          </button>
        </div>

        {/* Add Ingredient Form */}
        {showAddForm && (
          <form onSubmit={handleAddIngredient} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Register New Kitchen Ingredient</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                className="ios-input"
                placeholder="Ingredient name (e.g. Milk, Rice, Chicken)"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                required
              />
              <select className="ios-select" value={newIngCat} onChange={(e) => setNewIngCat(e.target.value)}>
                <option value="Dairy & Fats">Dairy & Fats</option>
                <option value="Poultry & Meat">Poultry & Meat</option>
                <option value="Dry Pantry">Dry Pantry</option>
                <option value="Vegetables & Herbs">Vegetables</option>
                <option value="Bakery">Bakery</option>
                <option value="Beverages">Beverages</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 }}>
              <input
                type="number"
                step="0.1"
                className="ios-input"
                placeholder="Quantity"
                value={newIngStock}
                onChange={(e) => setNewIngStock(e.target.value)}
                required
              />
              <input
                type="text"
                className="ios-input"
                placeholder="Unit (kg/ltr/pcs)"
                value={newIngUnit}
                onChange={(e) => setNewIngUnit(e.target.value)}
                required
              />
              <input
                type="number"
                step="0.1"
                className="ios-input"
                placeholder="Min needed"
                value={newIngReorder}
                onChange={(e) => setNewIngReorder(e.target.value)}
              />
              <input
                type="number"
                step="1"
                className="ios-input"
                placeholder="Cost/unit (₹)"
                value={newIngCost}
                onChange={(e) => setNewIngCost(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary-pill full-width" style={{ fontSize: 12, padding: '7px 12px' }}>
              Save Ingredient to Inventory
            </button>
          </form>
        )}

        {ingredients.length > 0 ? (
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
        ) : (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
            <PackageOpen size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: 13, color: '#334155' }}>No Inventory Ingredients Added Yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Tap "+ Add Item" above to track your kitchen supplies and minimum stock levels.</div>
          </div>
        )}
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

        {ingredients.length > 0 ? (
          <form onSubmit={handleLogWastage} style={{ marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Select Item</label>
                <select
                  className="ios-select"
                  value={selectedIng || (ingredients[0]?.name || '')}
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
        ) : (
          <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', fontSize: 12, background: '#F8FAFC', borderRadius: 10, marginBottom: 12 }}>
            Add ingredients above to record kitchen wastage and spoiled food.
          </div>
        )}

        {/* Wastage History */}
        {wastageLog.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
