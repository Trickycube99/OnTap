import React, { useState } from 'react';
import {
  X,
  Camera,
  Trash2,
  Check,
  AlertCircle,
  Tag,
  Sparkles,
  Utensils,
  Plus
} from 'lucide-react';
import { playTapSound, playSuccessChime } from '../utils/audio';
import { DEFAULT_CUTLERY_IMAGE } from '../data/initialData';
import { COMMON_CATEGORIES } from '../utils/menuAiParser';

export default function EditDishModal(props) {
  if (!props.dish) return null;
  return <EditDishForm key={props.dish.id} {...props} />;
}

function EditDishForm({
  dish,
  menu = [],
  onSave,
  onClose
}) {

  const [name, setName] = useState(dish.name || '');
  const [category, setCategory] = useState(dish.category || 'Main Course');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(
    dish.category && !COMMON_CATEGORIES.includes(dish.category)
  );
  const [price, setPrice] = useState(dish.price !== undefined ? String(dish.price) : '');
  const [isVeg, setIsVeg] = useState(dish.isVeg !== false);
  const [isAvailable, setIsAvailable] = useState(dish.isAvailable !== false);
  const [image, setImage] = useState(dish.image || null);
  const [bullets, setBullets] = useState(
    Array.isArray(dish.bullets) ? dish.bullets.join(', ') : (dish.bullets || '')
  );
  const [tags, setTags] = useState(
    Array.isArray(dish.tags) ? dish.tags.join(', ') : (dish.tags || '')
  );
  const [pairingDishId, setPairingDishId] = useState(dish.pairingDishId || '');
  const [prepTime, setPrepTime] = useState(dish.prepTime || '10-15 mins');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Image Upload with Canvas Resizing to ~25KB max 400px JPEG
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        setImage(compressedDataUrl);
        setIsUploading(false);
      };
      img.onerror = () => {
        setIsUploading(false);
        alert('Failed to process image file. Please try another.');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    playTapSound();

    const priceNum = parseFloat(price);
    if (!name.trim()) {
      setErrorMessage('Dish name is required.');
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage('Please enter a valid price in ₹.');
      return;
    }

    const effectiveCategory = isCustomCategory ? (customCategory.trim() || 'Specialties') : category;

    const bulletsArray = bullets
      ? bullets.split(',').map((s) => s.trim()).filter(Boolean)
      : ['Freshly prepared with authentic ingredients'];

    const tagsArray = tags
      ? tags.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const updatedDish = {
      ...dish,
      name: name.trim(),
      category: effectiveCategory,
      price: priceNum,
      isVeg,
      isAvailable,
      image,
      bullets: bulletsArray,
      tags: tagsArray,
      prepTime: prepTime.trim() || '10-15 mins',
      pairingDishId: pairingDishId ? (isNaN(Number(pairingDishId)) ? pairingDishId : Number(pairingDishId)) : null,
      updatedAt: new Date().toISOString()
    };

    playSuccessChime();
    onSave(updatedDish);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-drag-pill" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="card-heading" style={{ fontSize: 18 }}>Edit Menu Item</div>
            <div className="card-meta-text">Changes update across all customer table QR menus & POS instantly</div>
          </div>
          <button
            className="nav-icon-btn"
            onClick={onClose}
            style={{ width: 32, height: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: '#FEE2E2',
              color: '#DC2626',
              fontSize: 12,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Dish Photo Section */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              DISH PHOTO
            </label>
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                padding: '12px',
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                borderRadius: 14
              }}
            >
              <img
                src={image || DEFAULT_CUTLERY_IMAGE}
                alt="Dish preview"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  objectFit: 'cover',
                  border: '1px solid #CBD5E1'
                }}
                onError={(e) => {
                  e.target.src = DEFAULT_CUTLERY_IMAGE;
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'var(--primary-blue)',
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isUploading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Camera size={14} />
                    <span>{isUploading ? 'Compressing...' : (image ? 'Change Photo' : 'Upload Photo')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileChange}
                      disabled={isUploading}
                    />
                  </label>

                  {image && (
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: '#FEE2E2',
                        color: '#DC2626',
                        border: '1px solid #FCA5A5',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 6 }}>
                  PNG, JPG, or WebP format
                </div>
              </div>
            </div>
          </div>

          {/* Dish Name */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              DISH NAME *
            </label>
            <input
              type="text"
              className="ios-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
              required
            />
          </div>

          {/* Category & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                CATEGORY
              </label>
              {!isCustomCategory ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="ios-select"
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                  >
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__custom__">+ Custom Category...</option>
                  </select>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="ios-input"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter new category"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="nav-icon-btn"
                    onClick={() => setIsCustomCategory(false)}
                    title="Choose from standard list"
                    style={{ width: 36, height: 36 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                PRICE (₹ INR) *
              </label>
              <input
                type="number"
                step="1"
                min="0"
                className="ios-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="280"
                required
              />
            </div>
          </div>

          {/* Dietary Type & Availability */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                DIETARY TYPE
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsVeg(true)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    border: isVeg ? '2px solid #16A34A' : '1px solid #CBD5E1',
                    background: isVeg ? '#DCFCE7' : '#FFFFFF',
                    color: isVeg ? '#15803D' : '#64748B',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
                  <span>Veg</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsVeg(false)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    border: !isVeg ? '2px solid #DC2626' : '1px solid #CBD5E1',
                    background: !isVeg ? '#FEE2E2' : '#FFFFFF',
                    color: !isVeg ? '#DC2626' : '#64748B',
                    fontWeight: 700,
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                  <span>Non-Veg</span>
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                AVAILABILITY
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsAvailable(true)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    border: isAvailable ? '2px solid #007AFF' : '1px solid #CBD5E1',
                    background: isAvailable ? '#EFF6FF' : '#FFFFFF',
                    color: isAvailable ? '#1D4ED8' : '#64748B',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  In Stock
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvailable(false)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: 6,
                    border: !isAvailable ? '2px solid #64748B' : '1px solid #CBD5E1',
                    background: !isAvailable ? '#F1F5F9' : '#FFFFFF',
                    color: !isAvailable ? '#475569' : '#64748B',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  Sold Out
                </button>
              </div>
            </div>
          </div>

          {/* Description / Ingredients */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              DESCRIPTION / INGREDIENTS
            </label>
            <input
              type="text"
              className="ios-input"
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              placeholder="e.g. Clay oven roasted, simmered in rich creamy tomato gravy"
            />
          </div>

          {/* Tags & Pairing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                TAGS (COMMA-SEPARATED)
              </label>
              <input
                type="text"
                className="ios-input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. Bestseller, Chef Special"
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                UPSELL RECOMMENDED PAIRING
              </label>
              <select
                className="ios-select"
                value={pairingDishId}
                onChange={(e) => setPairingDishId(e.target.value)}
              >
                <option value="">None (No Upsell)</option>
                {menu
                  .filter((m) => m.id !== dish.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (₹{m.price})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary-pill"
              onClick={onClose}
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-pill"
              style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Check size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
