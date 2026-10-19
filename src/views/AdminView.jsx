import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Receipt,
  User,
  Palette,
  TrendingUp,
  Download,
  AlertOctagon,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Award,
  Send,
  QrCode,
  Tag,
  Copy,
  Check,
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Save,
  ShieldCheck,
  Utensils,
  Eye,
  EyeOff,
  UserPlus,
  UserCheck,
  UserX,
  X,
  DollarSign,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import BankReconciliationView from './BankReconciliationView';
import InventoryView from './InventoryView';
import PunchWalkInOrders from '../components/PunchWalkInOrders';
import { broadcastSyncEvent, SYNC_EVENTS, subscribeSyncEvents } from '../utils/sync';
import { STORAGE_KEYS, saveData } from '../utils/storage';
import { DEFAULT_CUTLERY_IMAGE } from '../data/initialData';
import { getActiveBusiness, getBusinesses, updateBusiness } from '../utils/businessManager';
import { purgeBusinessAccountComplete } from '../utils/systematicDatabase';

// Coupons & Offers Helpers (placed outside component for purity)
const isOfferExpired = (offer) => {
  if (!offer || !offer.expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return offer.expiryDate < today;
};

export default function AdminView({
  activeBusinessId = 'biz_advait',
  orders,
  setOrders,
  menu,
  setMenu,
  expenses,
  setExpenses,
  staff,
  setStaff,
  theme,
  setTheme,
  chef,
  setChef,
  checklists = [],
  setChecklists,
  offers = [],
  setOffers,
  activeAdminTab: externalActiveAdminTab,
  setActiveAdminTab: externalSetActiveAdminTab,
  onOpenTableQr,
  onDeleteAccountComplete
}) {
  const [internalActiveAdminTab, setInternalActiveAdminTab] = useState('sales');
  const activeAdminTab = externalActiveAdminTab !== undefined ? externalActiveAdminTab : internalActiveAdminTab;
  const setActiveAdminTab = externalSetActiveAdminTab || setInternalActiveAdminTab;
  const [orderSearch, setOrderSearch] = useState('');
  const [showWalkInPunch, setShowWalkInPunch] = useState(false);
  const [payrollDisbursed, setPayrollDisbursed] = useState(false);
  const [liveEodToast, setLiveEodToast] = useState('');

  // Owner Credentials Vault State
  const [showOwnerCredentialsModal, setShowOwnerCredentialsModal] = useState(false);
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [showCounterPin, setShowCounterPin] = useState(false);
  const [copiedOwnerKey, setCopiedOwnerKey] = useState(null);
  const [activeBiz, setActiveBiz] = useState(() => getActiveBusiness() || getBusinesses()[0]);

  // Owner Self-Account Deletion & Data Purge State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmPin, setDeleteConfirmPin] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleOwnerSelfDeleteAccount = async () => {
    playTapSound();
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteAccountError('Please type "DELETE" exactly to confirm account deletion.');
      playAlertChime();
      return;
    }
    const cleanPin = String(deleteConfirmPin || '').trim();
    if (cleanPin !== String(activeBiz?.owner?.pin || '').trim()) {
      setDeleteAccountError('Incorrect Owner Master PIN. Please enter your valid 6-digit PIN.');
      playAlertChime();
      return;
    }

    setIsDeletingAccount(true);
    setDeleteAccountError('');

    try {
      const res = await purgeBusinessAccountComplete({
        businessId: activeBiz.id,
        actorRole: 'owner',
        reason: 'Owner Self-Requested Permanent Account Erasure'
      });

      setIsDeletingAccount(false);

      if (res.success) {
        playSuccessChime();
        setShowDeleteAccountModal(false);
        alert(res.message);
        if (onDeleteAccountComplete) {
          onDeleteAccountComplete(res);
        } else {
          window.location.reload();
        }
      } else {
        setDeleteAccountError(res.error || 'Failed to delete business account.');
        playAlertChime();
      }
    } catch (err) {
      setIsDeletingAccount(false);
      setDeleteAccountError(err.message || 'An error occurred during account deletion.');
      playAlertChime();
    }
  };

  // Real-time synchronization for business & credential updates
  useEffect(() => {
    const handleBizUpdate = () => {
      setActiveBiz(getActiveBusiness() || getBusinesses()[0]);
    };
    window.addEventListener('storage', handleBizUpdate);
    window.addEventListener('flowscape_businesses_updated', handleBizUpdate);
    const unsub = subscribeSyncEvents((event) => {
      if (
        event?.type === SYNC_EVENTS.BUSINESSES_UPDATED ||
        event?.type === SYNC_EVENTS.CREDENTIALS_UPDATED ||
        event?.type === SYNC_EVENTS.CONFIG_UPDATED
      ) {
        handleBizUpdate();
      }
    });
    return () => {
      window.removeEventListener('storage', handleBizUpdate);
      window.removeEventListener('flowscape_businesses_updated', handleBizUpdate);
      if (unsub) unsub();
    };
  }, [activeBusinessId]);

  const handleCopyOwnerCredential = (text, key) => {
    playTapSound();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedOwnerKey(key);
    playSuccessChime();
    setTimeout(() => setCopiedOwnerKey(null), 2000);
  };

  // Real-time synchronization: listen for live EOD checklist submissions from Counter Staff (Tenant Scoped)
  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((msg) => {
      if (!msg) return;
      if (msg.businessId && msg.businessId !== activeBusinessId) return;

      if (msg.type === SYNC_EVENTS.CHECKLIST_SUBMITTED && msg.payload) {
        if (setChecklists) {
          setChecklists((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const exists = list.some((item) => item.id === msg.payload.id);
            if (exists) {
              return list.map((item) => (item.id === msg.payload.id ? msg.payload : item));
            }
            return [msg.payload, ...list];
          });
        }
        const filledAmt = msg.payload.actual?.total ?? 0;
        const submitter = msg.payload.submittedBy || 'Counter Staff';
        setLiveEodToast(
          `⚡ Live EOD Closing Received: ${submitter} submitted calculated filled amount of ₹${Number(filledAmt).toLocaleString('en-IN')}`
        );
        playSuccessChime();
        setTimeout(() => setLiveEodToast(''), 7000);
      }
    }, activeBusinessId);
    return () => unsubscribe();
  }, [setChecklists, activeBusinessId]);

  // Coupons & Offers Management State
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponSearch, setCouponSearch] = useState('');
  const [couponFilter, setCouponFilter] = useState('all'); // 'all' | 'active' | 'expired' | 'inactive'
  const [copiedCouponId, setCopiedCouponId] = useState(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percent',
    value: '',
    minOrderAmount: '',
    maxDiscount: '',
    expiryDate: '',
    description: '',
    isActive: true
  });

  // Expense Logger Form State
  const [expCategory, setExpCategory] = useState('Ingredients & Produce');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');

  // Payslip Modal State
  const [viewingPayslip, setViewingPayslip] = useState(null);

  // Staff Payroll & Team Management State
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    role: 'Counter Captain & POS Lead',
    phone: '',
    monthlyWage: '',
    monthEndPay: '',
    status: 'active',
    bankAccount: '',
    ifsc: 'HDFC0000128',
    canEditPrice: false,
    canCreateDiscounts: false,
    loginId: '',
    pin: ''
  });
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | 'active' | 'resigned'
  const [staffSearch, setStaffSearch] = useState('');
  const [editingPayInput, setEditingPayInput] = useState({}); // { [staffId]: string }
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffSaveSuccess, setStaffSaveSuccess] = useState(false);
  const [staffSyncFeedback, setStaffSyncFeedback] = useState('');

  // Staff POS Credentials Vault Visibility (Owner Back-Office Only)
  const [revealedStaffPins, setRevealedStaffPins] = useState({});
  const [showAllStaffPins, setShowAllStaffPins] = useState(false);
  const [copiedStaffKey, setCopiedStaffKey] = useState(null);

  const handleCopyCredential = (text, key) => {
    try {
      navigator.clipboard.writeText(text);
      playSuccessChime();
      setCopiedStaffKey(key);
      setTimeout(() => setCopiedStaffKey(null), 2500);
    } catch {}
  };

  // Menu Management Modal State
  const [showAddDishModal, setShowAddDishModal] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishCategory, setNewDishCategory] = useState('Signatures');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishVeg, setNewDishVeg] = useState(true);
  const [newDishBullets, setNewDishBullets] = useState('');
  const [newDishTags, setNewDishTags] = useState("Chef's Special");
  const [newDishImage, setNewDishImage] = useState(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);

  // App Customizer Draft State & Handlers (FR-A5)
  const [customizerDraft, setCustomizerDraft] = useState(() => ({
    restaurantName: theme?.restaurantName || 'Advait Artisanal Kitchen',
    tagline: theme?.tagline || 'Progressive Indian Table & Craft Kitchen',
    welcomeMessage: theme?.welcomeMessage || 'Scan table QR, order effortlessly, and track your kitchen ticket in real time.',
    accentColor: theme?.accentColor || '#007AFF',
    menuLayout: theme?.menuLayout || 'grid',
    upiId: theme?.upiId || '9119069179@nyes',
    logo: theme?.logo || null,
    showAboutChef: theme?.showAboutChef !== false && chef?.showAboutChef !== false
  }));
  const [customizerSaveSuccess, setCustomizerSaveSuccess] = useState(false);
  const [isSavingCustomizer, setIsSavingCustomizer] = useState(false);
  const logoInputRef = useRef(null);

  // Chef Customizer Draft State & Handlers
  const [chefDraft, setChefDraft] = useState(() => ({
    name: chef?.name || 'Rakesh Sharma',
    title: chef?.title || 'Executive Chef & Master Director',
    portrait: chef?.portrait || '/assets/chef_portrait.jpg',
    experienceYears: chef?.experienceYears || 18,
    bio: chef?.bio || '',
    philosophy: chef?.philosophy || '',
    showVerifiedBadge: chef?.showVerifiedBadge ?? (chef?.isVerified ?? true),
    showCredentials: chef?.showCredentials ?? true,
    showHygienePledge: chef?.showHygienePledge ?? true,
    showAboutChef: chef?.showAboutChef !== false && theme?.showAboutChef !== false
  }));
  const chefPhotoInputRef = useRef(null);

  // Sync draft when theme prop changes (React recommended pattern for adjusting state from props)
  const [prevTheme, setPrevTheme] = useState(theme);
  if (theme !== prevTheme) {
    setPrevTheme(theme);
    setCustomizerDraft({
      restaurantName: theme?.restaurantName || 'Advait Artisanal Kitchen',
      tagline: theme?.tagline || 'Progressive Indian Table & Craft Kitchen',
      welcomeMessage: theme?.welcomeMessage || 'Scan table QR, order effortlessly, and track your kitchen ticket in real time.',
      accentColor: theme?.accentColor || '#007AFF',
      menuLayout: theme?.menuLayout || 'grid',
      upiId: theme?.upiId || '9119069179@nyes',
      logo: theme?.logo || null,
      showAboutChef: theme?.showAboutChef !== false && chef?.showAboutChef !== false
    });
  }

  // Sync draft when chef prop changes
  const [prevChef, setPrevChef] = useState(chef);
  if (chef !== prevChef) {
    setPrevChef(chef);
    setChefDraft({
      name: chef?.name || 'Rakesh Sharma',
      title: chef?.title || 'Executive Chef & Master Director',
      portrait: chef?.portrait || '/assets/chef_portrait.jpg',
      experienceYears: chef?.experienceYears || 18,
      bio: chef?.bio || '',
      philosophy: chef?.philosophy || '',
      showVerifiedBadge: chef?.showVerifiedBadge ?? (chef?.isVerified ?? true),
      showCredentials: chef?.showCredentials ?? true,
      showHygienePledge: chef?.showHygienePledge ?? true,
      showAboutChef: chef?.showAboutChef !== false && theme?.showAboutChef !== false
    });
  }

  // Handle chef photo upload with automatic canvas optimization
  const handleChefPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        setChefDraft((prev) => ({ ...prev, portrait: dataUrl }));
        setCustomizerSaveSuccess(false);
        playTapSound();
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleResetChefPhoto = () => {
    playTapSound();
    setChefDraft((prev) => ({ ...prev, portrait: '/assets/chef_portrait.jpg' }));
    setCustomizerSaveSuccess(false);
    if (chefPhotoInputRef.current) {
      chefPhotoInputRef.current.value = '';
    }
  };

  // Handle logo image upload with automatic canvas optimization for fast sync
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Optimize to max 360x180 maintaining aspect ratio for clean localStorage & fast broadcast
        const maxW = 360;
        const maxH = 180;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.92);

        setCustomizerDraft((prev) => ({ ...prev, logo: dataUrl }));
        setCustomizerSaveSuccess(false);
        playTapSound();
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    playTapSound();
    setCustomizerDraft((prev) => ({ ...prev, logo: null }));
    setCustomizerSaveSuccess(false);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  // Save Customizer Settings & Broadcast to all screens in real-time
  const handleSaveCustomizer = () => {
    playTapSound();
    setIsSavingCustomizer(true);

    const isChefVisible = (chefDraft.showAboutChef !== false) && (customizerDraft.showAboutChef !== false);

    const updatedTheme = {
      ...theme,
      ...customizerDraft,
      showAboutChef: isChefVisible
    };

    const updatedChef = {
      ...chef,
      ...chefDraft,
      showAboutChef: isChefVisible,
      isVerified: Boolean(chefDraft.showVerifiedBadge)
    };

    // 1. Update state in parent App
    setTheme(updatedTheme);
    if (setChef) setChef(updatedChef);

    // 2. Persist in active business record
    const activeBiz = getActiveBusiness();
    if (activeBiz?.id) {
      updateBusiness(activeBiz.id, {
        name: customizerDraft.restaurantName,
        tagline: customizerDraft.tagline,
        upiId: customizerDraft.upiId,
        accentColor: customizerDraft.accentColor,
        logo: customizerDraft.logo,
        showAboutChef: isChefVisible,
        chef: updatedChef
      });
    }

    // 3. Save scoped theme and chef to localStorage
    const scopedThemeKey = activeBiz?.id && activeBiz.id !== 'biz_advait'
      ? `${STORAGE_KEYS.THEME}_${activeBiz.id}`
      : STORAGE_KEYS.THEME;
    saveData(scopedThemeKey, updatedTheme);

    const scopedChefKey = activeBiz?.id && activeBiz.id !== 'biz_advait'
      ? `${STORAGE_KEYS.CHEF}_${activeBiz.id}`
      : STORAGE_KEYS.CHEF;
    saveData(scopedChefKey, updatedChef);

    // 4. Real-time broadcast to all open windows/tabs (customer devices, POS terminals)
    broadcastSyncEvent(SYNC_EVENTS.THEME_UPDATED, updatedTheme);
    broadcastSyncEvent(SYNC_EVENTS.CHEF_UPDATED, updatedChef);

    // 5. Success chime & UI feedback
    playSuccessChime();
    setIsSavingCustomizer(false);
    setCustomizerSaveSuccess(true);
    setTimeout(() => setCustomizerSaveSuccess(false), 3500);
  };

  // Sales KPIs calculation in ₹ (System Expected Numbers)
  const totalOrdersCount = orders.length;
  const todayGrossSales = orders.reduce((sum, o) => sum + o.total, 0);
  const weekSales = todayGrossSales * 5.4;
  const monthSales = todayGrossSales * 24.8;

  const cashSplit = orders.filter((o) => o.paymentMode.toLowerCase().includes('cash') || o.paymentMode.toLowerCase().includes('counter')).reduce((s, o) => s + o.total, 0);
  const cardSplit = orders.filter((o) => o.paymentMode.toLowerCase().includes('card')).reduce((s, o) => s + o.total, 0);
  const upiSplit = orders.filter((o) => o.paymentMode.toLowerCase().includes('upi')).reduce((s, o) => s + o.total, 0);

  // EOD Closing Reconciliation & Staff Calculated Filled Amounts
  const todayDateStr = new Date().toLocaleDateString();
  const latestEodReport = useMemo(() => {
    if (!Array.isArray(checklists) || checklists.length === 0) return null;
    const todayReport = checklists.find((c) => c.date === todayDateStr);
    return todayReport || checklists[0] || null;
  }, [checklists, todayDateStr]);

  const hasEodSubmitted = Boolean(latestEodReport);
  const filledCash = latestEodReport?.actual?.cash ?? null;
  const filledCard = latestEodReport?.actual?.card ?? null;
  const filledUpi = latestEodReport?.actual?.upi ?? null;
  const filledTotalRevenue = latestEodReport?.actual?.total ?? null;
  const expectedTotalReport = latestEodReport?.expected?.total ?? todayGrossSales;
  const eodVariance = latestEodReport?.variance ?? (hasEodSubmitted && filledTotalRevenue !== null ? filledTotalRevenue - expectedTotalReport : 0);

  // Effective revenue reflecting staff-calculated filled amounts if submitted
  const effectiveGrossSales = hasEodSubmitted && filledTotalRevenue !== null ? filledTotalRevenue : todayGrossSales;

  // P&L Calculations (FR-A3 & 5.4) in ₹
  const totalRecordedExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netDailyProfit = effectiveGrossSales - totalRecordedExpenses;
  const expectedNetProfit = todayGrossSales - totalRecordedExpenses;

  // Cash vs Obligations in ₹ (Section 5.4)
  const totalUpcomingObligations =
    (theme?.upcomingObligations?.rent || 0) +
    (theme?.upcomingObligations?.payroll || 0) +
    (theme?.upcomingObligations?.emi || 0);
  const totalAvailableFunds = theme?.cashInHand || 0;
  const isCashCrunchAlert = totalAvailableFunds < totalUpcomingObligations;

  // Top Items Analytics (FR-A4)
  const itemCounts = {};
  orders.forEach((o) => {
    o.items.forEach((i) => {
      itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
    });
  });

  const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

  // CSV Export Handler (FR-A2)
  const handleExportCSV = () => {
    playTapSound();
    const headers = ['Order ID', 'Customer', 'Table', 'Status', 'Payment Mode', 'Items', 'Subtotal (INR)', 'GST Tax (INR)', 'Total (INR)', 'Timestamp'];
    const rows = orders.map((o) => [
      o.id,
      `"${o.customerName}"`,
      `"${o.table}"`,
      o.statusLabel,
      `"${o.paymentMode}"`,
      `"${o.items.map((i) => `${i.quantity}x ${i.name}`).join('; ')}"`,
      o.subtotal.toFixed(0),
      o.tax.toFixed(1),
      o.total.toFixed(0),
      `"${o.createdAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `advait_orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessChime();
  };

  // Add Manual Expense (FR-A3)
  const handleAddExpense = (e) => {
    e.preventDefault();
    playTapSound();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newExp = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      category: expCategory,
      description: expDesc || expCategory,
      amount: amt,
      loggedBy: 'Owner / Admin'
    };

    setExpenses((prev) => [newExp, ...prev]);
    broadcastSyncEvent(SYNC_EVENTS.EXPENSE_ADDED, newExp);
    setExpAmount('');
    setExpDesc('');
    playSuccessChime();
  };

  // Delete Expense
  const handleDeleteExpense = (id) => {
    playTapSound();
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Handle Dish Photo Upload with Canvas Resizing & Compression (~25KB)
  const handleDishImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setImageUploadLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Compress and resize image using canvas to ensure lightweight cross-device sync
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setNewDishImage(compressedDataUrl);
        setImageUploadLoading(false);
      };
      img.onerror = () => {
        setImageUploadLoading(false);
        alert('Failed to process image. Please try another file.');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setImageUploadLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Menu Management CRUD (FR-A7)
  const handleAddDishSubmit = (e) => {
    e.preventDefault();
    playTapSound();
    const priceNum = parseFloat(newDishPrice);
    if (!newDishName.trim() || isNaN(priceNum)) return;

    const bulletsArray = newDishBullets
      ? newDishBullets.split(',').map((s) => s.trim())
      : ['Freshly prepared with authentic Indian spices & organic ghee'];
    const tagsArray = newDishTags ? newDishTags.split(',').map((s) => s.trim()) : ['New'];

    const newDish = {
      id: Date.now(),
      name: newDishName.trim(),
      category: newDishCategory,
      price: priceNum,
      isVeg: newDishVeg,
      image: newDishImage || null, // If user uploaded an image use it, otherwise null (defaults to cutlery icon)
      isAvailable: true,
      tags: tagsArray,
      bullets: bulletsArray,
      prepTime: '10-12 mins'
    };

    const updated = [newDish, ...(menu || [])];
    setMenu(updated);
    saveData(STORAGE_KEYS.MENU, updated);
    broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated);
    setShowAddDishModal(false);
    setNewDishName('');
    setNewDishPrice('');
    setNewDishBullets('');
    setNewDishImage(null);
    playSuccessChime();
  };

  const handleDeleteDish = (id) => {
    playTapSound();
    if (window.confirm('Delete this dish from the menu across all devices?')) {
      const updated = (menu || []).filter((d) => d.id !== id);
      setMenu(updated);
      saveData(STORAGE_KEYS.MENU, updated);
      broadcastSyncEvent(SYNC_EVENTS.MENU_UPDATED, updated);
      playAlertChime();
    }
  };

  // Helper to persist staff to active business record & scoped localStorage, and broadcast live
  const persistAndBroadcastStaff = (updatedStaff) => {
    const activeBiz = getActiveBusiness();
    const scopedStaffKey = activeBiz?.id && activeBiz.id !== 'biz_advait'
      ? `${STORAGE_KEYS.STAFF}_${activeBiz.id}`
      : STORAGE_KEYS.STAFF;
    saveData(scopedStaffKey, updatedStaff);
    broadcastSyncEvent(SYNC_EVENTS.STAFF_UPDATED, updatedStaff);
  };

  // User Management & Permissions
  const handleToggleStaffPermission = (staffId, permKey) => {
    playTapSound();
    let targetName = 'Staff member';
    let newPermVal = false;
    const updatedStaff = staff.map((s) => {
      if (s.id === staffId) {
        targetName = s.name;
        newPermVal = !s.permissions?.[permKey];
        return {
          ...s,
          permissions: {
            ...s.permissions,
            [permKey]: newPermVal
          }
        };
      }
      return s;
    });

    // 1. Update parent state
    setStaff(updatedStaff);

    // 2. Persist to storage & broadcast immediately to open POS terminals
    persistAndBroadcastStaff(updatedStaff);

    // 3. Clear, immediate feedback
    const permLabel = permKey === 'canEditPrice' ? 'POS Price Edit' : 'Issue Promo Offers';
    const statusLabel = newPermVal ? '✓ Permission Granted' : '🔒 Permission Locked (Revoked)';
    setStaffSyncFeedback(`${statusLabel}: "${permLabel}" for ${targetName}. Synced live to Counter POS.`);
    setStaffSaveSuccess(true);
    setTimeout(() => {
      setStaffSaveSuccess(false);
      setStaffSyncFeedback('');
    }, 4000);
  };

  // Explicit Save & Broadcast Handler for Staff and Terminal Permissions
  const handleSaveStaffAndPermissions = () => {
    playTapSound();
    setIsSavingStaff(true);

    // 1. Update state in parent App
    const updatedStaff = [...staff];
    setStaff(updatedStaff);

    // 2. Persist in active business record & scoped localStorage & broadcast
    persistAndBroadcastStaff(updatedStaff);

    // 3. Success feedback
    playSuccessChime();
    setIsSavingStaff(false);
    setStaffSyncFeedback('✓ All staff permissions and roles successfully broadcasted to Counter POS.');
    setStaffSaveSuccess(true);
    setTimeout(() => {
      setStaffSaveSuccess(false);
      setStaffSyncFeedback('');
    }, 4000);
  };

  // Staff Payroll Net Pay Calculation (without attendance)
  const getStaffNetPay = (emp) => {
    if (emp.monthEndPay !== undefined && emp.monthEndPay !== null && emp.monthEndPay !== '') {
      return Number(emp.monthEndPay) || 0;
    }
    return Number(emp.monthlyWage) || 0;
  };

  const activeStaffList = staff.filter((emp) => emp.status !== 'resigned');
  const totalNetPayroll = activeStaffList.reduce((sum, emp) => sum + getStaffNetPay(emp), 0);

  const handleOpenAddStaff = () => {
    playTapSound();
    setEditingStaffId(null);
    setStaffFormData({
      name: '',
      role: 'Service Captain & Floor Lead',
      phone: '',
      monthlyWage: '',
      monthEndPay: '',
      status: 'active',
      bankAccount: '',
      ifsc: 'HDFC0000128',
      canEditPrice: false,
      canCreateDiscounts: false,
      loginId: '',
      pin: String(Math.floor(100000 + Math.random() * 900000))
    });
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (emp) => {
    playTapSound();
    setEditingStaffId(emp.id);
    setStaffFormData({
      name: emp.name || '',
      role: emp.role || '',
      phone: emp.phone || '',
      monthlyWage: emp.monthlyWage || '',
      monthEndPay: emp.monthEndPay !== undefined && emp.monthEndPay !== null ? emp.monthEndPay : emp.monthlyWage || '',
      status: emp.status || 'active',
      bankAccount: emp.bankAccount || '',
      ifsc: emp.ifsc || 'HDFC0000128',
      canEditPrice: Boolean(emp.permissions?.canEditPrice),
      canCreateDiscounts: Boolean(emp.permissions?.canCreateDiscounts),
      loginId: emp.loginId || `${(emp.name || '').toLowerCase().replace(/\s+/g, '')}.pos`,
      pin: emp.pin || '440100'
    });
    setShowStaffModal(true);
  };

  const handleSaveStaff = (e) => {
    e?.preventDefault();
    if (!staffFormData.name.trim()) {
      alert('Please enter staff member name');
      return;
    }
    const wage = Number(staffFormData.monthlyWage) || 0;
    if (wage <= 0) {
      alert('Please enter a valid monthly base salary');
      return;
    }
    playTapSound();

    const endPay = staffFormData.monthEndPay !== '' && staffFormData.monthEndPay !== null
      ? Number(staffFormData.monthEndPay) || 0
      : wage;

    const cleanLoginId = (staffFormData.loginId || '').trim() || `${staffFormData.name.trim().toLowerCase().replace(/\s+/g, '')}.pos`;
    const cleanPin = (staffFormData.pin || '').trim() || String(Math.floor(100000 + Math.random() * 900000));
    if (!/^\d{6}$/.test(cleanPin)) {
      alert('Staff POS PIN must be exactly 6 numeric digits.');
      return;
    }

    let updatedStaff;
    if (editingStaffId) {
      // Update existing staff
      updatedStaff = staff.map((s) =>
        s.id === editingStaffId
          ? {
              ...s,
              name: staffFormData.name.trim(),
              role: staffFormData.role.trim() || 'Restaurant Associate',
              phone: staffFormData.phone.trim() || 'N/A',
              monthlyWage: wage,
              monthEndPay: endPay,
              status: staffFormData.status || 'active',
              bankAccount: staffFormData.bankAccount.trim() || s.bankAccount,
              ifsc: staffFormData.ifsc.trim() || s.ifsc || 'HDFC0000128',
              loginId: cleanLoginId,
              pin: cleanPin,
              permissions: {
                ...s.permissions,
                canEditPrice: Boolean(staffFormData.canEditPrice),
                canCreateDiscounts: Boolean(staffFormData.canCreateDiscounts)
              }
            }
          : s
      );
    } else {
      // Add new staff member
      const newStaffMember = {
        id: `st-${Date.now()}`,
        name: staffFormData.name.trim(),
        role: staffFormData.role.trim() || 'Restaurant Associate',
        phone: staffFormData.phone.trim() || 'N/A',
        monthlyWage: wage,
        monthEndPay: endPay,
        status: staffFormData.status || 'active',
        bankAccount: staffFormData.bankAccount.trim() || `9821004812${Math.floor(100 + Math.random() * 900)}`,
        ifsc: staffFormData.ifsc.trim() || 'HDFC0000128',
        loginId: cleanLoginId,
        pin: cleanPin,
        permissions: {
          canEditPrice: Boolean(staffFormData.canEditPrice),
          canCreateDiscounts: Boolean(staffFormData.canCreateDiscounts),
          canViewPnL: false
        }
      };
      updatedStaff = [newStaffMember, ...staff];
    }

    setStaff(updatedStaff);
    persistAndBroadcastStaff(updatedStaff);
    setShowStaffModal(false);
    playSuccessChime();
    setStaffSyncFeedback('✓ Staff records & permissions saved and synced live to Counter POS.');
    setStaffSaveSuccess(true);
    setTimeout(() => {
      setStaffSaveSuccess(false);
      setStaffSyncFeedback('');
    }, 4000);
  };

  const handleToggleResignStaff = (emp) => {
    playTapSound();
    const newStatus = emp.status === 'resigned' ? 'active' : 'resigned';
    const actionLabel = newStatus === 'resigned' ? 'mark as resigned' : 'reactivate';
    if (window.confirm(`Are you sure you want to ${actionLabel} ${emp.name}?`)) {
      const updated = staff.map((s) => (s.id === emp.id ? { ...s, status: newStatus } : s));
      setStaff(updated);
      persistAndBroadcastStaff(updated);
      playSuccessChime();
    }
  };

  const handleDeleteStaff = (emp) => {
    playTapSound();
    if (window.confirm(`Are you sure you want to permanently delete ${emp.name} from staff records?`)) {
      const updated = staff.filter((s) => s.id !== emp.id);
      setStaff(updated);
      persistAndBroadcastStaff(updated);
      playAlertChime();
    }
  };

  const handleSaveInlineMonthEndPay = (staffId) => {
    playTapSound();
    const rawVal = editingPayInput[staffId];
    if (rawVal === undefined || rawVal === '') return;
    const val = Number(rawVal);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid amount');
      return;
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, monthEndPay: val } : s))
    );
    setEditingPayInput((prev) => {
      const copy = { ...prev };
      delete copy[staffId];
      return copy;
    });
    playSuccessChime();
  };

  const handleExecuteBankPayrollBatch = () => {
    playTapSound();
    setPayrollDisbursed(true);
    playSuccessChime();
  };

  const handleExportPayrollCsv = () => {
    playTapSound();
    const headers = [
      'Employee ID',
      'Employee Name',
      'Role',
      'Status',
      'Monthly Base Salary (INR)',
      'Month-End Payout (INR)',
      'Bank IFSC',
      'Beneficiary Account'
    ];
    const rows = staff.map((emp) => {
      const netPay = getStaffNetPay(emp);
      return [
        emp.id,
        `"${emp.name}"`,
        `"${emp.role}"`,
        emp.status === 'resigned' ? 'Resigned' : 'Active',
        emp.monthlyWage,
        netPay,
        emp.ifsc || 'HDFC0000128',
        `"${emp.bankAccount || `9821004812${emp.id.replace('st-', '').replace('s', '')}`}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `advait_bank_payroll_batch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSuccessChime();
  };

  const handleOpenCreateCoupon = () => {
    playTapSound();
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const defaultExpiry = d.toISOString().slice(0, 10);

    setEditingCoupon(null);
    setCouponForm({
      code: '',
      type: 'percent',
      value: '',
      minOrderAmount: '',
      maxDiscount: '',
      expiryDate: defaultExpiry,
      description: '',
      isActive: true
    });
    setShowCouponModal(true);
  };

  const handleOpenEditCoupon = (offer) => {
    playTapSound();
    setEditingCoupon(offer);
    setCouponForm({
      code: offer.code,
      type: offer.type || 'percent',
      value: offer.value.toString(),
      minOrderAmount: offer.minOrderAmount ? offer.minOrderAmount.toString() : '',
      maxDiscount: offer.maxDiscount ? offer.maxDiscount.toString() : '',
      expiryDate: offer.expiryDate || '',
      description: offer.description || '',
      isActive: offer.isActive !== undefined ? offer.isActive : true
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = (e) => {
    if (e) e.preventDefault();
    const cleanCode = couponForm.code.trim().toUpperCase();
    if (!cleanCode) {
      alert('Please enter a coupon code.');
      return;
    }
    const numVal = parseFloat(couponForm.value);
    if (isNaN(numVal) || numVal <= 0) {
      alert('Please enter a valid discount value greater than 0.');
      return;
    }

    const offerData = {
      id: editingCoupon ? editingCoupon.id : `off-${Date.now()}`,
      code: cleanCode,
      type: couponForm.type,
      value: numVal,
      minOrderAmount: couponForm.minOrderAmount ? parseFloat(couponForm.minOrderAmount) : 0,
      maxDiscount: couponForm.maxDiscount ? parseFloat(couponForm.maxDiscount) : null,
      expiryDate: couponForm.expiryDate || null,
      description: couponForm.description.trim() || `${numVal}${couponForm.type === 'percent' ? '%' : '₹'} Off Promo`,
      isActive: couponForm.isActive,
      updatedAt: new Date().toISOString()
    };

    let updatedOffers;
    if (editingCoupon) {
      updatedOffers = offers.map((o) => (o.id === editingCoupon.id ? offerData : o));
    } else {
      updatedOffers = [offerData, ...offers];
    }

    if (setOffers) setOffers(updatedOffers);
    saveData(STORAGE_KEYS.OFFERS, updatedOffers);
    broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updatedOffers);
    playSuccessChime();
    setShowCouponModal(false);
  };

  const handleDeleteCoupon = (coupon) => {
    playTapSound();
    const isExpired = isOfferExpired(coupon);
    const confirmMsg = isExpired
      ? `Delete expired coupon "${coupon.code}"?`
      : `Are you sure you want to delete coupon "${coupon.code}"?`;
    if (window.confirm(confirmMsg)) {
      const updated = offers.filter((o) => o.id !== coupon.id);
      if (setOffers) setOffers(updated);
      saveData(STORAGE_KEYS.OFFERS, updated);
      broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated);
      playAlertChime();
    }
  };

  const handleDeleteAllExpiredCoupons = () => {
    playTapSound();
    const expiredList = offers.filter((o) => isOfferExpired(o));
    if (expiredList.length === 0) return;
    if (window.confirm(`Delete all ${expiredList.length} expired coupon(s)?`)) {
      const updated = offers.filter((o) => !isOfferExpired(o));
      if (setOffers) setOffers(updated);
      saveData(STORAGE_KEYS.OFFERS, updated);
      broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated);
      playSuccessChime();
    }
  };

  const handleToggleCouponActive = (coupon) => {
    playTapSound();
    const updated = offers.map((o) =>
      o.id === coupon.id ? { ...o, isActive: !o.isActive } : o
    );
    if (setOffers) setOffers(updated);
    saveData(STORAGE_KEYS.OFFERS, updated);
    broadcastSyncEvent(SYNC_EVENTS.OFFERS_UPDATED, updated);
  };

  const handleCopyCouponCode = (code, id) => {
    playTapSound();
    navigator.clipboard.writeText(code);
    setCopiedCouponId(id);
    playSuccessChime();
    setTimeout(() => setCopiedCouponId(null), 2000);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 85 }}>
      {/* Title & Executive Credentials Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <div className="screen-title">Owner Back-Office</div>
          <div className="screen-subtitle">Indian Restaurant Analytics, P&amp;L, Operations &amp; Payroll — {activeBiz?.name}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setShowOwnerCredentialsModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
            transition: 'all 0.2s'
          }}
        >
          <KeyRound size={15} />
          <span>Executive Credentials Vault</span>
        </button>
      </div>

      {/* Live EOD Submission Notification Toast */}
      {liveEodToast && (
        <div
          style={{
            background: 'linear-gradient(90deg, #15803D 0%, #16A34A 100%)',
            color: '#FFFFFF',
            padding: '10px 14px',
            borderRadius: 14,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
            animation: 'fadeIn 0.25s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={18} />
            <span>{liveEodToast}</span>
          </div>
          <button
            onClick={() => setLiveEodToast('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="filter-tabs-container" style={{ padding: '0 0 12px' }}>
        {[
          { id: 'sales', label: 'Sales Dashboard', inFooter: true },
          { id: 'orders', label: 'Orders & CSV', inFooter: true },
          { id: 'punch', label: '+ Punch Walk-in', inFooter: false },
          { id: 'pnl', label: 'P&L & Cash Check', inFooter: true },
          { id: 'eod-checklists', label: hasEodSubmitted ? 'EOD Closing Audit (Filled)' : 'EOD Closing Audit', inFooter: false },
          { id: 'offers', label: 'Coupons & Offers', inFooter: true },
          { id: 'bank-rec', label: 'Bank CSV Rec', inFooter: false },
          { id: 'payroll', label: 'Staff Payroll', inFooter: true },
          { id: 'inventory', label: 'Inventory & Wastage', inFooter: false },
          { id: 'menu', label: 'Menu CRUD', inFooter: false },
          { id: 'branding', label: 'App Customizer', inFooter: true }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`capsule-tab ${activeAdminTab === tab.id ? 'active' : ''} ${
              tab.inFooter ? 'admin-footer-tab-mobile-hidden' : ''
            }`}
            onClick={() => {
              playTapSound();
              setActiveAdminTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. SALES DASHBOARD (FR-A1) */}
      {activeAdminTab === 'sales' && (
        <div>
          {/* Quick Zero-Auth Table QR Tent Card Generator Banner */}
          <div
            className="ios-card active-gradient"
            style={{
              padding: '12px 14px',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              border: '1.5px solid rgba(0, 122, 255, 0.25)'
            }}
            onClick={() => {
              playTapSound();
              if (onOpenTableQr) onOpenTableQr();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0, 122, 255, 0.15)'
                }}
              >
                <QrCode size={20} color="#007AFF" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Table QR Tent Cards & Standees
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Contactless QR ordering with zero login barrier for guests
                </div>
              </div>
            </div>
            <button
              className="btn-primary-pill"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={(e) => {
                e.stopPropagation();
                playTapSound();
                if (onOpenTableQr) onOpenTableQr();
              }}
            >
              <span>View QRs</span>
            </button>
          </div>

          {/* DAILY CLOSING EOD RECONCILIATION CARD (Staff Count vs System Expected) */}
          <div
            className="ios-card"
            style={{
              marginBottom: 16,
              border: hasEodSubmitted ? '1.5px solid #86EFAC' : '1.5px dashed #CBD5E1',
              background: hasEodSubmitted
                ? 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)'
                : '#FFFFFF',
              boxShadow: hasEodSubmitted
                ? '0 4px 16px rgba(22, 163, 74, 0.08)'
                : 'none'
            }}
          >
            <div className="card-top-row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="card-heading" style={{ fontSize: 16 }}>
                    Daily Closing EOD (Staff Filled vs Expected)
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 20,
                      background: hasEodSubmitted ? '#DCFCE7' : '#FEF3C7',
                      color: hasEodSubmitted ? '#15803D' : '#B45309',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {hasEodSubmitted ? (
                      <>
                        <CheckCircle2 size={12} />
                        <span>✓ EOD Filled & Audited</span>
                      </>
                    ) : (
                      <>
                        <Clock size={12} />
                        <span>⏳ Awaiting Staff Submission</span>
                      </>
                    )}
                  </span>
                </div>
                <span className="card-meta-text">
                  {hasEodSubmitted
                    ? `Counted and submitted by ${latestEodReport.submittedBy || 'Counter Staff'} (${latestEodReport.staffRole || 'Operator'}) on ${latestEodReport.date} at ${latestEodReport.timestamp || ''}`
                    : 'Actual physical cash in register, Pine Labs card batch, and UPI settlements'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                  onClick={() => {
                    playTapSound();
                    setActiveAdminTab('eod-checklists');
                  }}
                >
                  <FileSpreadsheet size={13} />
                  <span>Audit History</span>
                </button>
              </div>
            </div>

            {hasEodSubmitted ? (
              <div>
                {/* 3 Prominent Metrics Boxes */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    marginBottom: 14
                  }}
                >
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #86EFAC',
                      borderRadius: 14,
                      padding: '10px 12px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.05)'
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#15803D' }}>
                      Calculated Filled Amount
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                      ₹{filledTotalRevenue.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      Physical count + settled
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: 14,
                      padding: '10px 12px'
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                      System Expected Total
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-blue)', marginTop: 2 }}>
                      ₹{expectedTotalReport.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      From orders ({totalOrdersCount})
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#FFFFFF',
                      border: `1px solid ${eodVariance >= 0 ? '#BBF7D0' : '#FECACA'}`,
                      borderRadius: 14,
                      padding: '10px 12px'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: eodVariance >= 0 ? '#15803D' : '#DC2626'
                      }}
                    >
                      Reconciliation Net Variance
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: eodVariance >= 0 ? '#15803D' : '#DC2626',
                        marginTop: 2
                      }}
                    >
                      {eodVariance >= 0
                        ? `+₹${eodVariance.toLocaleString('en-IN')}`
                        : `-₹${Math.abs(eodVariance).toLocaleString('en-IN')}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {eodVariance === 0
                        ? 'Balanced 1:1 match'
                        : eodVariance > 0
                        ? 'Surplus physical cash'
                        : 'Discrepancy shortfall'}
                    </div>
                  </div>
                </div>

                {/* Channel-by-Channel Breakdown Grid */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: latestEodReport.varianceReason ? 10 : 0
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                      padding: '8px 12px',
                      background: '#F9FAFB',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      borderBottom: '1px solid #E5E7EB'
                    }}
                  >
                    <span>Channel</span>
                    <span style={{ textAlign: 'right' }}>Calculated Filled</span>
                    <span style={{ textAlign: 'right' }}>Expected</span>
                    <span style={{ textAlign: 'right' }}>Difference</span>
                  </div>

                  {/* Cash */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                      padding: '8px 12px',
                      fontSize: 12,
                      borderBottom: '1px solid #F3F4F6',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>💵 Counter Cash</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                      ₹{filledCash.toFixed(0)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      ₹{(latestEodReport.expected?.cash ?? cashSplit).toFixed(0)}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: filledCash - (latestEodReport.expected?.cash ?? cashSplit) >= 0 ? '#16A34A' : '#EF4444'
                      }}
                    >
                      {filledCash - (latestEodReport.expected?.cash ?? cashSplit) >= 0
                        ? `+₹${(filledCash - (latestEodReport.expected?.cash ?? cashSplit)).toFixed(0)}`
                        : `-₹${Math.abs(filledCash - (latestEodReport.expected?.cash ?? cashSplit)).toFixed(0)}`}
                    </span>
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                      padding: '8px 12px',
                      fontSize: 12,
                      borderBottom: '1px solid #F3F4F6',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>💳 Card POS Batch</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-blue)' }}>
                      ₹{filledCard.toFixed(0)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      ₹{(latestEodReport.expected?.card ?? cardSplit).toFixed(0)}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: filledCard - (latestEodReport.expected?.card ?? cardSplit) >= 0 ? '#16A34A' : '#EF4444'
                      }}
                    >
                      {filledCard - (latestEodReport.expected?.card ?? cardSplit) >= 0
                        ? `+₹${(filledCard - (latestEodReport.expected?.card ?? cardSplit)).toFixed(0)}`
                        : `-₹${Math.abs(filledCard - (latestEodReport.expected?.card ?? cardSplit)).toFixed(0)}`}
                    </span>
                  </div>

                  {/* UPI */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                      padding: '8px 12px',
                      fontSize: 12,
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>📱 UPI Settlement</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#8B5CF6' }}>
                      ₹{filledUpi.toFixed(0)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      ₹{(latestEodReport.expected?.upi ?? upiSplit).toFixed(0)}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: filledUpi - (latestEodReport.expected?.upi ?? upiSplit) >= 0 ? '#16A34A' : '#EF4444'
                      }}
                    >
                      {filledUpi - (latestEodReport.expected?.upi ?? upiSplit) >= 0
                        ? `+₹${(filledUpi - (latestEodReport.expected?.upi ?? upiSplit)).toFixed(0)}`
                        : `-₹${Math.abs(filledUpi - (latestEodReport.expected?.upi ?? upiSplit)).toFixed(0)}`}
                    </span>
                  </div>
                </div>

                {/* Audit explanation note if provided */}
                {latestEodReport.varianceReason && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      Staff Audit Note:
                    </span>
                    <span style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>
                      "{latestEodReport.varianceReason}"
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: '#F9FAFB',
                  border: '1px dashed #D1D5DB',
                  borderRadius: 12,
                  padding: '14px',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#B45309', marginBottom: 4 }}>
                  <AlertTriangle size={15} />
                  <span>Closing EOD count has not been submitted by counter staff yet today.</span>
                </div>
                Currently, the sales dashboard displays <strong>System Expected Orders Total (₹{todayGrossSales.toFixed(0)})</strong>. As soon as the counter staff fills their physical count, re-confirms in the pop-up modal, and submits, the <strong>Calculated Filled Amount</strong> will be reflected here automatically in real time.
              </div>
            )}
          </div>

          {/* Top 3 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="ios-card active-gradient" style={{ padding: '12px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today's Sales</div>
                {hasEodSubmitted && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 6,
                      background: '#DCFCE7',
                      color: '#15803D'
                    }}
                  >
                    EOD Filled
                  </span>
                )}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
                ₹{(hasEodSubmitted ? filledTotalRevenue : todayGrossSales).toFixed(0)}
              </div>
              <div style={{ fontSize: 10, color: hasEodSubmitted ? '#15803D' : '#16A34A', marginTop: 4 }}>
                {hasEodSubmitted
                  ? `Filled (Expected: ₹${todayGrossSales.toFixed(0)})`
                  : `${totalOrdersCount} orders (Expected)`}
              </div>
            </div>

            <div className="ios-card" style={{ padding: '12px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Week</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                ₹{weekSales.toFixed(0)}
              </div>
              <div style={{ fontSize: 10, color: '#16A34A', marginTop: 4 }}>+18% vs last wk</div>
            </div>

            <div className="ios-card" style={{ padding: '12px 10px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>This Month</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                ₹{monthSales.toFixed(0)}
              </div>
              <div style={{ fontSize: 10, color: '#16A34A', marginTop: 4 }}>Target on track</div>
            </div>
          </div>

          {/* Payment Mode Breakdown (FR-A1) */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Payment Channel Split</span>
                <span className="card-meta-text">
                  {hasEodSubmitted
                    ? 'Comparing Staff Filled Actuals vs System Expected Orders'
                    : 'Settlements distribution for today'}
                </span>
              </div>
              <Receipt size={18} color="#007AFF" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>Cash at Counter</span>
                  <div>
                    {hasEodSubmitted && (
                      <span style={{ color: '#16A34A', fontWeight: 700, marginRight: 8 }}>
                        Filled: ₹{filledCash.toFixed(0)}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Expected: ₹{cashSplit.toFixed(0)} ({todayGrossSales ? ((cashSplit / todayGrossSales) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: '#10B981',
                      width: `${todayGrossSales ? (cashSplit / todayGrossSales) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>Card POS Swipe (Pine Labs)</span>
                  <div>
                    {hasEodSubmitted && (
                      <span style={{ color: 'var(--primary-blue)', fontWeight: 700, marginRight: 8 }}>
                        Filled: ₹{filledCard.toFixed(0)}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Expected: ₹{cardSplit.toFixed(0)} ({todayGrossSales ? ((cardSplit / todayGrossSales) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: '#007AFF',
                      width: `${todayGrossSales ? (cardSplit / todayGrossSales) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>Instant UPI QR (GPay / PhonePe / Paytm)</span>
                  <div>
                    {hasEodSubmitted && (
                      <span style={{ color: '#8B5CF6', fontWeight: 700, marginRight: 8 }}>
                        Filled: ₹{filledUpi.toFixed(0)}
                      </span>
                    )}
                    <span style={{ color: 'var(--text-muted)' }}>
                      Expected: ₹{upiSplit.toFixed(0)} ({todayGrossSales ? ((upiSplit / todayGrossSales) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: '#8B5CF6',
                      width: `${todayGrossSales ? (upiSplit / todayGrossSales) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Total Reconciled Inflow Strip */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#F9FAFB',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontSize: 12,
                  marginTop: 4,
                  borderTop: '1px solid #E5E7EB'
                }}
              >
                <span>
                  {hasEodSubmitted ? (
                    <strong style={{ color: '#15803D' }}>Total Reconciled Filled: ₹{filledTotalRevenue.toFixed(0)}</strong>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>EOD Reconciliation Pending</span>
                  )}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Total Expected Orders: <strong>₹{todayGrossSales.toFixed(0)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Top Selling Items & Peak Hours (FR-A4) */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Top Selling Dishes</span>
                <span className="card-meta-text">Most popular items by portions served</span>
              </div>
              <Award size={18} color="#D97706" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedItems.slice(0, 5).map(([name, count], idx) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: '#F9FAFB',
                    borderRadius: 10
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: idx === 0 ? '#FEF3C7' : '#E5E7EB',
                        color: idx === 0 ? '#D97706' : '#4B5563',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{name}</span>
                  </div>
                  <span className="status-pill tag" style={{ fontSize: 11 }}>
                    {count} portions
                  </span>
                </div>
              ))}
            </div>

            {/* Peak Hours Breakdown */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Peak Service Rush Hours
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60, padding: '4px 0' }}>
                {[
                  { time: '12pm', val: 35 },
                  { time: '1pm', val: 80 },
                  { time: '2pm', val: 95 },
                  { time: '3pm', val: 45 },
                  { time: '7pm', val: 70 },
                  { time: '8pm', val: 90 },
                  { time: '9pm', val: 100 },
                  { time: '10pm', val: 65 }
                ].map((slot) => (
                  <div key={slot.time} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div
                      style={{
                        width: '80%',
                        height: `${slot.val * 0.45}px`,
                        background: slot.val > 70 ? 'var(--primary-blue)' : '#CBD5E1',
                        borderRadius: 3
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{slot.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ORDER HISTORY & CSV EXPORT (FR-A2) */}
      {activeAdminTab === 'orders' && (
        <div>
          {/* Optional inline Punch Walk-in Grid */}
          {showWalkInPunch && (
            <div style={{ marginBottom: 16 }}>
              <PunchWalkInOrders
                activeBusinessId={activeBusinessId}
                orders={orders}
                setOrders={setOrders}
                menu={menu}
                tables={theme?.tables}
                onOrderSubmitted={() => {
                  // Keep open or notify
                }}
              />
            </div>
          )}

          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Complete Order History</span>
                <span className="card-meta-text">Searchable register logs & instant CSV export</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn-secondary-pill"
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#007AFF',
                    borderColor: '#BFDBFE',
                    background: '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  onClick={() => {
                    playTapSound();
                    setShowWalkInPunch(!showWalkInPunch);
                  }}
                  title="Punch walk-in or phone order"
                >
                  <Plus size={14} color="#007AFF" />
                  <span>{showWalkInPunch ? 'Hide Punch Grid' : '+ Punch Walk-in'}</span>
                </button>
                <button
                  className="btn-primary-pill"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={handleExportCSV}
                >
                  <Download size={14} />
                  <span>Export to CSV</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <input
              type="text"
              className="ios-input"
              placeholder="Search by order ID, customer name, table..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {/* Filtered Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders
                .filter(
                  (o) =>
                    o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
                    o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
                    o.table.toLowerCase().includes(orderSearch.toLowerCase())
                )
                .map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      padding: '10px 12px',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{ord.id}</span>
                        <span className="status-pill tag" style={{ fontSize: 9 }}>
                          {ord.table}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {ord.customerName} • {ord.items.length} items • {ord.paymentMode}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-blue)' }}>
                        ₹{ord.total.toFixed(0)}
                      </div>
                      <span className="status-pill done" style={{ fontSize: 9, padding: '2px 6px' }}>
                        {ord.statusLabel}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 2B. DIRECT WALK-IN & PHONE PUNCH ORDERS */}
      {activeAdminTab === 'punch' && (
        <div style={{ marginBottom: 16 }}>
          <PunchWalkInOrders
            activeBusinessId={activeBusinessId}
            orders={orders}
            setOrders={setOrders}
            menu={menu}
            tables={theme?.tables}
            onOrderSubmitted={(newOrder, meta) => {
              const hasOtherGridsWithItems = typeof meta === 'boolean'
                ? meta
                : Boolean(meta?.hasOtherGridsWithItems);
              if (!hasOtherGridsWithItems) {
                setActiveAdminTab('orders');
              }
            }}
          />
        </div>
      )}

      {/* 3. PROFIT & LOSS & CASH CHECK (FR-A3 & Section 5.4) */}
      {activeAdminTab === 'pnl' && (
        <div>
          {/* Section 5.4 Cash vs Profit & Obligations Alert */}
          {isCashCrunchAlert ? (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #F87171',
                borderRadius: 16,
                padding: 14,
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626', fontWeight: 700 }}>
                <AlertOctagon size={20} />
                <span>Section 5.4 Alert: Cash Position Below Fixed Obligations!</span>
              </div>
              <div style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>
                Available Funds (Cash in Hand ₹{totalAvailableFunds.toLocaleString('en-IN')}) is below upcoming obligations (₹{totalUpcomingObligations.toLocaleString('en-IN')}: Rent ₹{theme.upcomingObligations.rent.toLocaleString('en-IN')}, Payroll ₹{theme.upcomingObligations.payroll.toLocaleString('en-IN')}, EMI ₹{theme.upcomingObligations.emi.toLocaleString('en-IN')}) due on {theme.upcomingObligations.dueDate}.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: 16,
                padding: 12,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#16A34A',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={16} />
              <span>Cash position is healthy. Cash in hand exceeds monthly fixed commitments.</span>
            </div>
          )}

          {/* Daily P&L Summary Card */}
          <div className="ios-card completed-gradient" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Daily Profit & Loss Statement (INR)</span>
                <span className="card-meta-text">Gross Sales vs Recorded Operating Expenses</span>
              </div>
              <TrendingUp size={20} color="#16A34A" />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                background: 'rgba(255, 255, 255, 0.9)',
                borderRadius: 14,
                padding: '12px 8px',
                textAlign: 'center',
                marginBottom: 12
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {hasEodSubmitted ? 'Calculated Gross Revenue' : 'Gross Revenue'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-blue)' }}>
                  +₹{effectiveGrossSales.toFixed(0)}
                </div>
                <div style={{ fontSize: 9, color: hasEodSubmitted ? '#15803D' : 'var(--text-muted)', marginTop: 2 }}>
                  {hasEodSubmitted ? `EOD Filled (Exp: ₹${todayGrossSales.toFixed(0)})` : '(System Expected)'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logged Expenses</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
                  -₹{totalRecordedExpenses.toFixed(0)}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  ({expenses.length} entries)
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Real Profit</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: netDailyProfit >= 0 ? '#16A34A' : '#DC2626' }}>
                  ₹{netDailyProfit.toFixed(0)}
                </div>
                <div style={{ fontSize: 9, color: netDailyProfit >= 0 ? '#15803D' : '#DC2626', marginTop: 2 }}>
                  {hasEodSubmitted ? 'Reconciled from count' : `(Expected: ₹${expectedNetProfit.toFixed(0)})`}
                </div>
              </div>
            </div>

            <div className="card-bottom-progress" style={{ marginTop: 12 }}>
              <div className="card-bottom-progress-fill done" style={{ width: '100%' }} />
            </div>
          </div>

          {/* EOD CASH & SETTLEMENTS RECONCILIATION SUMMARY (P&L Level) */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Closing EOD Settlement Reconciliation</span>
                <span className="card-meta-text">
                  {hasEodSubmitted
                    ? `Audited report submitted by ${latestEodReport.submittedBy || 'Counter Staff'} on ${latestEodReport.date} at ${latestEodReport.timestamp || ''}`
                    : 'Physical cash drawer & digital inflow verification status'}
                </span>
              </div>
              <DollarSign size={18} color={hasEodSubmitted ? '#16A34A' : '#64748B'} />
            </div>

            {hasEodSubmitted ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  <div style={{ background: '#F0FDF4', padding: '10px 12px', borderRadius: 12, border: '1px solid #86EFAC' }}>
                    <div style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>Counted Drawer Cash</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                      ₹{(filledCash ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      Expected: ₹{(latestEodReport.expected?.cash ?? cashSplit).toFixed(0)}
                    </div>
                  </div>

                  <div style={{ background: '#EFF6FF', padding: '10px 12px', borderRadius: 12, border: '1px solid #93C5FD' }}>
                    <div style={{ fontSize: 11, color: 'var(--primary-blue)', fontWeight: 600 }}>Bank Digital Settled</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary-blue)', marginTop: 2 }}>
                      ₹{((filledCard ?? 0) + (filledUpi ?? 0)).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      Card: ₹{(filledCard ?? 0).toFixed(0)} | UPI: ₹{(filledUpi ?? 0).toFixed(0)}
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 12, border: '1px solid #CBD5E1' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Reconciled Inflow</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                      ₹{(filledTotalRevenue ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: eodVariance >= 0 ? '#15803D' : '#DC2626', marginTop: 2 }}>
                      Variance: {eodVariance >= 0 ? `+₹${eodVariance.toFixed(0)}` : `-₹${Math.abs(eodVariance).toFixed(0)}`}
                    </div>
                  </div>
                </div>

                {latestEodReport.varianceReason && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: '#F9FAFB', padding: '6px 10px', borderRadius: 8, fontStyle: 'italic' }}>
                    Audit Note: "{latestEodReport.varianceReason}"
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                ⏳ Awaiting today's Closing EOD submission from counter staff. Once staff double-checks and confirms the numbers on the counter terminal, physical cash in drawer and verified settled revenue will be locked and audited here.
              </div>
            )}
          </div>

          {/* Manual Expense Entry Logger (FR-A3) */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Log Manual Expense (INR)</span>
                <span className="card-meta-text">Vegetables, dairy, LPG gas cylinders, staff meals, maintenance</span>
              </div>
              <Plus size={18} color="#007AFF" />
            </div>

            <form onSubmit={handleAddExpense}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Category</label>
                  <select
                    className="ios-select"
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                  >
                    <option value="Ingredients & Produce">Ingredients & Produce</option>
                    <option value="Daily Dairy & Bakery">Daily Dairy & Bakery</option>
                    <option value="Utilities & Gas">Utilities & LPG Gas</option>
                    <option value="Rent Allocation">Rent Daily Allocation</option>
                    <option value="Staff Wages / Food">Staff Food & Advance</option>
                    <option value="Other & Maintenance">Equipment & Maintenance</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Amount (₹)</label>
                  <input
                    type="number"
                    step="10"
                    className="ios-input"
                    placeholder="e.g. 2400"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Description / Vendor</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="e.g. Fresh organic paneer, milk & tandoor coal delivery"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary-pill full-width">
                <Plus size={15} />
                <span>Save Expense to P&L</span>
              </button>
            </form>

            {/* Expenses List */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Recent Logged Expenses:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: '#F9FAFB',
                      borderRadius: 10,
                      fontSize: 12
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{exp.category}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {exp.description} • {exp.date}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: '#DC2626' }}>-₹{exp.amount.toFixed(0)}</span>
                      <button
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}
                        onClick={() => handleDeleteExpense(exp.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3A. EOD CLOSING AUDIT & HISTORICAL RECONCILIATIONS TAB */}
      {activeAdminTab === 'eod-checklists' && (
        <div>
          {/* Header Card */}
          <div className="ios-card active-gradient" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading" style={{ fontSize: 18 }}>
                  End-of-Day (EOD) Closing Audit Trail
                </span>
                <span className="card-meta-text">
                  Historical log of staff physical cash counts, Pine Labs batch settlement slips & UPI reconciliations
                </span>
              </div>
              <FileSpreadsheet size={22} color="#16A34A" />
            </div>

            {/* Quick KPI stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginTop: 12
              }}
            >
              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total EOD Reports</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {checklists.length}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Latest Filled Amount</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D', marginTop: 2 }}>
                  ₹{(filledTotalRevenue ?? 0).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Latest Expected Orders</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 2 }}>
                  ₹{(expectedTotalReport ?? todayGrossSales).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Variance</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: eodVariance >= 0 ? '#15803D' : '#DC2626', marginTop: 2 }}>
                  {eodVariance >= 0 ? `+₹${eodVariance.toFixed(0)}` : `-₹${Math.abs(eodVariance).toFixed(0)}`}
                </div>
              </div>
            </div>
          </div>

          {/* List of EOD Reports */}
          {Array.isArray(checklists) && checklists.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {checklists.map((report, idx) => {
                const actualTotal = report.actual?.total ?? 0;
                const expectedTotal = report.expected?.total ?? 0;
                const variance = report.variance ?? (actualTotal - expectedTotal);
                const hasExceeded = Math.abs(variance) > 200;

                return (
                  <div key={report.id || idx} className="ios-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {report.id}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 20,
                              background: '#DCFCE7',
                              color: '#15803D'
                            }}
                          >
                            ✓ {report.status || 'Audited & Submitted'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Date: <strong>{report.date}</strong> at <strong>{report.timestamp}</strong> | Submitter: <strong>{report.submittedBy || 'Staff'}</strong> ({report.staffRole || 'Operator'})
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Calculated Filled Revenue</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D' }}>
                          ₹{Number(actualTotal).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Grid Table */}
                    <div
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 10
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          padding: '7px 12px',
                          background: '#F9FAFB',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text-secondary)',
                          borderBottom: '1px solid #E5E7EB'
                        }}
                      >
                        <span>Channel</span>
                        <span style={{ textAlign: 'right' }}>Calculated Filled</span>
                        <span style={{ textAlign: 'right' }}>System Expected</span>
                        <span style={{ textAlign: 'right' }}>Variance</span>
                      </div>

                      {/* Cash */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          padding: '8px 12px',
                          fontSize: 12,
                          borderBottom: '1px solid #F3F4F6'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>💵 Counter Cash</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>
                          ₹{(report.actual?.cash ?? 0).toFixed(0)}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{(report.expected?.cash ?? 0).toFixed(0)}
                        </span>
                        <span
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: (report.actual?.cash ?? 0) - (report.expected?.cash ?? 0) >= 0 ? '#16A34A' : '#EF4444'
                          }}
                        >
                          {(report.actual?.cash ?? 0) - (report.expected?.cash ?? 0) >= 0
                            ? `+₹${((report.actual?.cash ?? 0) - (report.expected?.cash ?? 0)).toFixed(0)}`
                            : `-₹${Math.abs((report.actual?.cash ?? 0) - (report.expected?.cash ?? 0)).toFixed(0)}`}
                        </span>
                      </div>

                      {/* Card */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          padding: '8px 12px',
                          fontSize: 12,
                          borderBottom: '1px solid #F3F4F6'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>💳 Card POS Batch</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-blue)' }}>
                          ₹{(report.actual?.card ?? 0).toFixed(0)}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{(report.expected?.card ?? 0).toFixed(0)}
                        </span>
                        <span
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: (report.actual?.card ?? 0) - (report.expected?.card ?? 0) >= 0 ? '#16A34A' : '#EF4444'
                          }}
                        >
                          {(report.actual?.card ?? 0) - (report.expected?.card ?? 0) >= 0
                            ? `+₹${((report.actual?.card ?? 0) - (report.expected?.card ?? 0)).toFixed(0)}`
                            : `-₹${Math.abs((report.actual?.card ?? 0) - (report.expected?.card ?? 0)).toFixed(0)}`}
                        </span>
                      </div>

                      {/* UPI */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          padding: '8px 12px',
                          fontSize: 12,
                          borderBottom: '1px solid #F3F4F6'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>📱 UPI Settlement</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: '#8B5CF6' }}>
                          ₹{(report.actual?.upi ?? 0).toFixed(0)}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          ₹{(report.expected?.upi ?? 0).toFixed(0)}
                        </span>
                        <span
                          style={{
                            textAlign: 'right',
                            fontWeight: 600,
                            color: (report.actual?.upi ?? 0) - (report.expected?.upi ?? 0) >= 0 ? '#16A34A' : '#EF4444'
                          }}
                        >
                          {(report.actual?.upi ?? 0) - (report.expected?.upi ?? 0) >= 0
                            ? `+₹${((report.actual?.upi ?? 0) - (report.expected?.upi ?? 0)).toFixed(0)}`
                            : `-₹${Math.abs((report.actual?.upi ?? 0) - (report.expected?.upi ?? 0)).toFixed(0)}`}
                        </span>
                      </div>

                      {/* Total Row */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
                          padding: '9px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          background: '#F0FDF4'
                        }}
                      >
                        <span>TOTAL SETTLEMENT:</span>
                        <span style={{ textAlign: 'right', color: '#15803D' }}>
                          ₹{Number(actualTotal).toFixed(0)}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          ₹{Number(expectedTotal).toFixed(0)}
                        </span>
                        <span
                          style={{
                            textAlign: 'right',
                            color: variance >= 0 ? '#15803D' : '#DC2626'
                          }}
                        >
                          {variance >= 0 ? `+₹${Number(variance).toFixed(0)}` : `-₹${Math.abs(Number(variance)).toFixed(0)}`}
                        </span>
                      </div>
                    </div>

                    {/* Variance Note if present */}
                    {report.varianceReason && (
                      <div
                        style={{
                          background: hasExceeded ? '#FEF2F2' : '#F8FAFC',
                          border: `1px solid ${hasExceeded ? '#FECACA' : '#E2E8F0'}`,
                          borderRadius: 10,
                          padding: '8px 12px',
                          fontSize: 12,
                          color: hasExceeded ? '#991B1B' : 'var(--text-primary)'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                          {hasExceeded ? '⚠️ Audit Note (Threshold Variance > ₹200):' : 'Audit Note:'}
                        </div>
                        <div style={{ fontStyle: 'italic' }}>"{report.varianceReason}"</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="ios-card"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-muted)'
              }}
            >
              <FileSpreadsheet size={42} color="#9CA3AF" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                No EOD Closing Reports Yet
              </div>
              <div style={{ fontSize: 13, maxWidth: 380, margin: '0 auto 16px', lineHeight: 1.4 }}>
                When counter staff members verify their physical cash drawer, card POS slips, and UPI merchant app settlements at the end of the shift, they will complete the Closing EOD checklist with calculations confirmation. The audited reports will be recorded here permanently.
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3B. DISCOUNTS, COUPONS & PROMO OFFERS ENGINE */}
      {activeAdminTab === 'offers' && (
        <div>
          {/* Header & KPI Summary */}
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="card-title-group">
                <span className="card-heading" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tag size={18} color="#007AFF" />
                  <span>Promo Coupons & Customer Discounts</span>
                </span>
                <span className="card-meta-text">
                  Create, edit, track expiry dates and delete coupons across table QR ordering
                </span>
              </div>
              <button
                className="btn-primary-pill"
                onClick={handleOpenCreateCoupon}
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                <Plus size={15} />
                <span>Create New Coupon</span>
              </button>
            </div>

            {/* Quick KPI Stat Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 14 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Total Coupons</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{offers.length}</div>
              </div>

              <div style={{ background: '#F0FDF4', borderRadius: 12, padding: '10px 12px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Active Deals</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                  {offers.filter((o) => o.isActive && !isOfferExpired(o)).length}
                </div>
              </div>

              <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '10px 12px', border: '1px solid #FECACA' }}>
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Expired</span>
                  {offers.filter((o) => isOfferExpired(o)).length > 0 && (
                    <button
                      onClick={handleDeleteAllExpiredCoupons}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#B91C1C',
                        fontSize: 10,
                        fontWeight: 700,
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="Delete all expired coupons at once"
                    >
                      Delete All
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#B91C1C', marginTop: 2 }}>
                  {offers.filter((o) => isOfferExpired(o)).length}
                </div>
              </div>

              <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '10px 12px', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: 11, color: '#2563EB', fontWeight: 600 }}>Orders Discounted</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8', marginTop: 2 }}>
                  {orders.filter((o) => o.discount && o.discount > 0).length}
                </div>
              </div>
            </div>
          </div>

          {/* Filter & Search Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (${offers.length})` },
                { id: 'active', label: `Active (${offers.filter((o) => o.isActive && !isOfferExpired(o)).length})` },
                { id: 'expired', label: `Expired (${offers.filter((o) => isOfferExpired(o)).length})` },
                { id: 'inactive', label: `Disabled (${offers.filter((o) => !o.isActive && !isOfferExpired(o)).length})` }
              ].map((f) => (
                <button
                  key={f.id}
                  className={`capsule-tab ${couponFilter === f.id ? 'active' : ''}`}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => {
                    playTapSound();
                    setCouponFilter(f.id);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search by code or description..."
              className="ios-input"
              value={couponSearch}
              onChange={(e) => setCouponSearch(e.target.value)}
              style={{ maxWidth: 260, fontSize: 12, padding: '6px 12px' }}
            />
          </div>

          {/* Coupon Cards Grid */}
          {(() => {
            const filteredCoupons = offers.filter((off) => {
              const expired = isOfferExpired(off);
              if (couponFilter === 'active' && (!off.isActive || expired)) return false;
              if (couponFilter === 'expired' && !expired) return false;
              if (couponFilter === 'inactive' && (off.isActive || expired)) return false;

              if (couponSearch.trim()) {
                const q = couponSearch.toLowerCase().trim();
                const matchCode = off.code.toLowerCase().includes(q);
                const matchDesc = off.description && off.description.toLowerCase().includes(q);
                return matchCode || matchDesc;
              }
              return true;
            });

            if (filteredCoupons.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '50px 20px', background: '#F9FAFB', borderRadius: 16, border: '1px dashed #D1D5DB' }}>
                  <Tag size={36} color="#9CA3AF" style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No Coupons Found</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 14 }}>
                    {couponSearch
                      ? `No coupon matches "${couponSearch}".`
                      : couponFilter === 'expired'
                      ? 'No expired coupons! All active coupons are running smoothly.'
                      : 'Create your first discount coupon code to delight diners.'}
                  </div>
                  <button className="btn-primary-pill" onClick={handleOpenCreateCoupon}>
                    <Plus size={14} />
                    <span>Create New Coupon</span>
                  </button>
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12, marginBottom: 20 }}>
                {filteredCoupons.map((off) => {
                  const expired = isOfferExpired(off);
                  return (
                    <div
                      key={off.id}
                      className="ios-card"
                      style={{
                        padding: '14px',
                        border: expired
                          ? '1.5px solid #FECACA'
                          : off.isActive
                          ? '1.5px solid #BBF7D0'
                          : '1px solid #E5E7EB',
                        background: expired ? '#FEF2F2' : '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      {/* Top: Code & Status */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 16,
                                fontWeight: 800,
                                background: expired ? '#FEE2E2' : '#EFF6FF',
                                color: expired ? '#991B1B' : '#007AFF',
                                padding: '4px 8px',
                                borderRadius: 8,
                                letterSpacing: '0.04em'
                              }}
                            >
                              {off.code}
                            </span>
                            <button
                              onClick={() => handleCopyCouponCode(off.code, off.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                color: copiedCouponId === off.id ? '#16A34A' : '#9CA3AF'
                              }}
                              title="Copy coupon code"
                            >
                              {copiedCouponId === off.id ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 12,
                              background: expired ? '#FEE2E2' : off.isActive ? '#DCFCE7' : '#F3F4F6',
                              color: expired ? '#DC2626' : off.isActive ? '#15803D' : '#6B7280',
                              border: `1px solid ${expired ? '#FCA5A5' : off.isActive ? '#86EFAC' : '#E5E7EB'}`
                            }}
                          >
                            {expired ? '🔴 Expired' : off.isActive ? '🟢 Active' : '⚪ Paused'}
                          </span>
                        </div>

                        {/* Discount Value */}
                        <div style={{ fontSize: 20, fontWeight: 800, color: expired ? '#6B7280' : '#111827', marginBottom: 4 }}>
                          {off.type === 'percent' ? `${off.value}% OFF` : `₹${off.value} FLAT OFF`}
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 12.5, color: '#4B5563', lineHeight: 1.4, marginBottom: 8 }}>
                          {off.description || 'Artisanal dining discount offer.'}
                        </div>

                        {/* Rules / Constraints */}
                        <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div>
                            • Min Order:{' '}
                            <strong style={{ color: '#374151' }}>
                              {off.minOrderAmount > 0 ? `₹${off.minOrderAmount}` : 'No Minimum'}
                            </strong>
                          </div>
                          <div>
                            • Validity:{' '}
                            <strong style={{ color: expired ? '#DC2626' : '#374151' }}>
                              {off.expiryDate ? `Until ${off.expiryDate}` : 'Lifetime / No Expiry'}
                            </strong>
                          </div>
                          {off.type === 'percent' && off.maxDiscount && (
                            <div>
                              • Max Discount: <strong>₹{off.maxDiscount}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #E5E7EB',
                          paddingTop: 10
                        }}
                      >
                        {/* Toggle Active Switch */}
                        <button
                          className="btn-secondary-pill"
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            color: off.isActive ? '#D97706' : '#16A34A',
                            borderColor: off.isActive ? '#FDE68A' : '#BBF7D0'
                          }}
                          onClick={() => handleToggleCouponActive(off)}
                          title={off.isActive ? 'Pause coupon' : 'Activate coupon'}
                        >
                          {off.isActive ? 'Pause' : 'Activate'}
                        </button>

                        <div style={{ display: 'flex', gap: 6 }}>
                          {/* Edit Button */}
                          <button
                            className="btn-secondary-pill"
                            style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}
                            onClick={() => handleOpenEditCoupon(off)}
                            title="Edit coupon details"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            className="btn-secondary-pill"
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              gap: 4,
                              color: '#DC2626',
                              borderColor: expired ? '#F87171' : '#FECACA',
                              background: expired ? '#FEE2E2' : '#FFFFFF',
                              fontWeight: expired ? 700 : 500
                            }}
                            onClick={() => handleDeleteCoupon(off)}
                            title={expired ? 'Delete expired coupon' : 'Delete coupon'}
                          >
                            <Trash2 size={12} />
                            <span>{expired ? 'Delete Expired' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. STAFF PAYROLL & TEAM MANAGEMENT */}
      {activeAdminTab === 'payroll' && (
        <div>
          <div className="ios-card" style={{ marginBottom: 16 }}>
            {/* Header row with Add Staff Button */}
            <div className="card-top-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div className="card-title-group">
                <span className="card-heading">Staff Payroll &amp; Team Management (INR)</span>
                <span className="card-meta-text">Manage staff profiles, base salaries, resignations &amp; customizable month-end payouts</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary-pill"
                  onClick={handleSaveStaffAndPermissions}
                  style={{
                    fontSize: 12,
                    padding: '7px 16px',
                    background: '#16A34A',
                    borderColor: '#15803D',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title="Save staff roster & broadcast permissions changes to Counter POS"
                >
                  <Save size={14} />
                  <span>{isSavingStaff ? 'Saving...' : 'Save Staff & Permissions'}</span>
                </button>

                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={handleOpenAddStaff}
                  style={{ fontSize: 12, padding: '7px 14px' }}
                >
                  <UserPlus size={14} />
                  <span>+ Add New Staff</span>
                </button>
              </div>
            </div>

            {/* Real-time Save Confirmation Banner */}
            {staffSaveSuccess && (
              <div
                style={{
                  margin: '12px 0 6px',
                  padding: '10px 14px',
                  background: '#DCFCE7',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12,
                  color: '#15803D',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'fadeIn 0.2s ease-in-out'
                }}
              >
                <CheckCircle2 size={16} color="#16A34A" />
                <span>
                  {staffSyncFeedback || '✓ Staff changes & terminal permissions (Price Editing & Offers) saved and broadcast to all live POS terminals!'}
                </span>
              </div>
            )}

            {/* Business Owner Executive Master Credentials (Owner Back-Office) */}
            <div
              style={{
                marginBottom: 20,
                padding: '18px 20px',
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)',
                color: '#FFFFFF',
                borderRadius: 18,
                boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
                border: '1.5px solid rgba(165, 180, 252, 0.3)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3)'
                    }}
                  >
                    <ShieldCheck size={24} color="#FBBF24" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
                        Executive Owner Master Login Credentials
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 8,
                          background: (activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: (activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? '#6EE7B7' : '#FCA5A5',
                          border: `1px solid ${(activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                        }}
                      >
                        {(activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? '● Verified & Active' : '○ Suspended'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#C7D2FE', marginTop: 2 }}>
                      {activeBiz?.name} • Authorized Back-Office Partition (ID: <code style={{ color: '#E0E7FF' }}>{activeBiz?.id}</code>)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowOwnerCredentialsModal(true)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: 10,
                      padding: '6px 12px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Open Credentials Card</span>
                  </button>
                </div>
              </div>

              {/* 3-Column Master Credentials Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                {/* 1. Owner Login Email */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>
                    Owner Login Email
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#38BDF8', wordBreak: 'break-all' }}>
                      {activeBiz?.owner?.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOwnerCredential(activeBiz?.owner?.email, 'owner_email')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                      title="Copy Owner Email"
                    >
                      {copiedOwnerKey === 'owner_email' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* 2. Owner Master PIN */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Owner Master PIN (6 Digits)
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOwnerPin(!showOwnerPin)}
                      style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}
                    >
                      {showOwnerPin ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showOwnerPin ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#FBBF24', letterSpacing: showOwnerPin ? '0.15em' : '0.3em' }}>
                      {showOwnerPin ? activeBiz?.owner?.pin : '••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOwnerCredential(activeBiz?.owner?.pin, 'owner_pin')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                      title="Copy Master PIN"
                    >
                      {copiedOwnerKey === 'owner_pin' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* 3. Counter POS PIN */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Counter POS PIN (6 Digits)
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCounterPin(!showCounterPin)}
                      style={{ background: 'none', border: 'none', color: '#CBD5E1', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5 }}
                    >
                      {showCounterPin ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showCounterPin ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#34D399', letterSpacing: showCounterPin ? '0.15em' : '0.3em' }}>
                      {showCounterPin ? activeBiz?.counter?.pin : '••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyOwnerCredential(activeBiz?.counter?.pin, 'counter_pin')}
                      style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                      title="Copy Counter POS PIN"
                    >
                      {copiedOwnerKey === 'counter_pin' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11.5, color: '#C7D2FE' }}>
                <KeyRound size={13} color="#A5B4FC" />
                <span>
                  Synchronized in real-time with Developer Console (<strong>#manj</strong>). Use Owner Master PIN to access financial KPIs and Counter PIN to unlock POS stations.
                </span>
              </div>
            </div>

            {/* Staff POS Credentials & Operator Security Vault (Owner Only) */}
            <div
              style={{
                marginTop: 16,
                marginBottom: 20,
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #FAF5FF 0%, #F5F3FF 50%, #EFF6FF 100%)',
                border: '1.5px solid #DDD6FE',
                borderRadius: 16,
                boxShadow: '0 2px 6px rgba(139, 92, 246, 0.06)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: '#7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)'
                    }}
                  >
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#4C1D95' }}>
                        Staff POS Credentials &amp; Operator Security Vault
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: '#EDE9FE',
                          color: '#6D28D9',
                          border: '1px solid #C4B5FD',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Owner Eyes Only
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6D28D9', marginTop: 2 }}>
                      View, reveal, and manage POS terminal login IDs and 6-digit secret PINs for every employee.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary-pill"
                    onClick={() => {
                      playTapSound();
                      setShowAllStaffPins(!showAllStaffPins);
                    }}
                    style={{
                      fontSize: 11.5,
                      padding: '6px 14px',
                      background: showAllStaffPins ? '#F5F3FF' : '#FFFFFF',
                      borderColor: '#8B5CF6',
                      color: '#7C3AED',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {showAllStaffPins ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showAllStaffPins ? 'Mask All PINs' : 'Reveal All PINs'}</span>
                  </button>
                </div>
              </div>

              {/* Vault Table */}
              <div style={{ overflowX: 'auto', background: '#FFFFFF', borderRadius: 12, border: '1px solid #E9D5FF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontSize: 11, fontWeight: 700 }}>
                      <th style={{ padding: '10px 14px' }}>Employee &amp; Role</th>
                      <th style={{ padding: '10px 14px' }}>Staff Login ID</th>
                      <th style={{ padding: '10px 14px' }}>6-Digit Secret PIN</th>
                      <th style={{ padding: '10px 14px' }}>POS Permissions</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((emp) => {
                      const isRevealed = showAllStaffPins || Boolean(revealedStaffPins[emp.id]);
                      const loginId = emp.loginId || `${emp.name.toLowerCase().replace(/\s+/g, '')}.pos`;
                      const pin = emp.pin || '440100';
                      const isResigned = emp.status === 'resigned';

                      return (
                        <tr
                          key={emp.id}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            opacity: isResigned ? 0.65 : 1,
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Name & Role */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: isResigned ? '#E2E8F0' : '#EFF6FF',
                                  color: isResigned ? '#64748B' : '#007AFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 700
                                }}
                              >
                                {emp.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{emp.name}</div>
                                <div style={{ fontSize: 10.5, color: '#64748B' }}>{emp.role}</div>
                              </div>
                            </div>
                          </td>

                          {/* Login ID */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                  padding: '3px 8px',
                                  background: '#F1F5F9',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: 8,
                                  color: '#0F172A'
                                }}
                              >
                                @{loginId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCredential(loginId, `login_${emp.id}`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: copiedStaffKey === `login_${emp.id}` ? '#16A34A' : '#94A3B8',
                                  padding: 2
                                }}
                                title="Copy Login ID"
                              >
                                {copiedStaffKey === `login_${emp.id}` ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* 6-Digit Secret PIN */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  letterSpacing: isRevealed ? '0.08em' : '0.2em',
                                  padding: '3px 10px',
                                  background: isRevealed ? '#FEF3C7' : '#F8FAFC',
                                  border: `1px solid ${isRevealed ? '#FCD34D' : '#E2E8F0'}`,
                                  color: isRevealed ? '#92400E' : '#334155',
                                  borderRadius: 8
                                }}
                              >
                                {isRevealed ? pin : '••••••'}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  playTapSound();
                                  setRevealedStaffPins((prev) => ({
                                    ...prev,
                                    [emp.id]: !prev[emp.id]
                                  }));
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}
                                title={isRevealed ? 'Hide PIN' : 'Reveal PIN'}
                              >
                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyCredential(pin, `pin_${emp.id}`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: copiedStaffKey === `pin_${emp.id}` ? '#16A34A' : '#94A3B8',
                                  padding: 2
                                }}
                                title="Copy 6-digit PIN"
                              >
                                {copiedStaffKey === `pin_${emp.id}` ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* Permissions */}
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  background: emp.permissions?.canEditPrice ? '#DCFCE7' : '#F1F5F9',
                                  color: emp.permissions?.canEditPrice ? '#15803D' : '#94A3B8',
                                  fontWeight: 600
                                }}
                              >
                                {emp.permissions?.canEditPrice ? 'Price Edit: Yes' : 'No Price Edit'}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  background: emp.permissions?.canCreateDiscounts ? '#DCFCE7' : '#F1F5F9',
                                  color: emp.permissions?.canCreateDiscounts ? '#15803D' : '#94A3B8',
                                  fontWeight: 600
                                }}
                              >
                                {emp.permissions?.canCreateDiscounts ? 'Offers: Yes' : 'No Offers'}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              className={`status-pill ${isResigned ? 'rejected' : 'done'}`}
                              style={{ fontSize: 9.5, padding: '2px 8px' }}
                            >
                              {isResigned ? 'Resigned' : 'Active'}
                            </span>
                          </td>

                          {/* Action */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-secondary-pill"
                              style={{ padding: '4px 8px', fontSize: 11, gap: 4 }}
                              onClick={() => handleOpenEditStaff(emp)}
                              title="Edit Credentials & Permissions"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 12px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'all', label: `All (${staff.length})` },
                  { id: 'active', label: `Active (${staff.filter((s) => s.status !== 'resigned').length})` },
                  { id: 'resigned', label: `Resigned (${staff.filter((s) => s.status === 'resigned').length})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    className={`capsule-tab ${staffFilter === f.id ? 'active' : ''}`}
                    style={{ fontSize: 11.5, padding: '4px 12px' }}
                    onClick={() => {
                      playTapSound();
                      setStaffFilter(f.id);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                className="ios-input"
                placeholder="Search staff by name or role..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                style={{ maxWidth: 240, fontSize: 12, padding: '6px 12px' }}
              />
            </div>

            {/* Staff Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staff
                .filter((emp) => {
                  if (staffFilter === 'active' && emp.status === 'resigned') return false;
                  if (staffFilter === 'resigned' && emp.status !== 'resigned') return false;
                  if (staffSearch.trim()) {
                    const q = staffSearch.toLowerCase();
                    return (
                      (emp.name && emp.name.toLowerCase().includes(q)) ||
                      (emp.role && emp.role.toLowerCase().includes(q)) ||
                      (emp.phone && emp.phone.includes(q))
                    );
                  }
                  return true;
                })
                .map((emp) => {
                  const isResigned = emp.status === 'resigned';
                  const netPay = getStaffNetPay(emp);
                  const isCustomPay = emp.monthEndPay !== undefined && emp.monthEndPay !== null && Number(emp.monthEndPay) !== Number(emp.monthlyWage);
                  const isEditingInline = editingPayInput[emp.id] !== undefined;

                  return (
                    <div
                      key={emp.id}
                      style={{
                        padding: '14px',
                        background: isResigned ? '#F8FAFC' : '#FFFFFF',
                        border: `1.5px solid ${isResigned ? '#CBD5E1' : '#E2E8F0'}`,
                        borderRadius: 14,
                        opacity: isResigned ? 0.8 : 1,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Top Row: Name, Role, Status & Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{emp.name}</span>
                            <span
                              className={`status-pill ${isResigned ? 'rejected' : 'done'}`}
                              style={{ fontSize: 9.5, padding: '2px 8px' }}
                            >
                              {isResigned ? 'Resigned' : 'Active'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                            {emp.role} {emp.phone && `• ${emp.phone}`}
                          </div>

                          {/* POS Credentials Pill Row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 8 }}>
                              <span style={{ color: '#64748B', fontWeight: 600 }}>Login ID:</span>
                              <strong style={{ fontFamily: 'monospace', color: '#0F172A' }}>@{emp.loginId || `${emp.name.toLowerCase().replace(/\s+/g, '')}.pos`}</strong>
                              <button
                                type="button"
                                onClick={() => handleCopyCredential(emp.loginId || `${emp.name.toLowerCase().replace(/\s+/g, '')}.pos`, `card_login_${emp.id}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedStaffKey === `card_login_${emp.id}` ? '#16A34A' : '#94A3B8', padding: 1 }}
                                title="Copy Login ID"
                              >
                                {copiedStaffKey === `card_login_${emp.id}` ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                              </button>
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 8 }}>
                              <KeyRound size={11} color="#7C3AED" />
                              <span style={{ color: '#64748B', fontWeight: 600 }}>POS PIN:</span>
                              <strong style={{ fontFamily: 'monospace', letterSpacing: (showAllStaffPins || revealedStaffPins[emp.id]) ? '0.05em' : '0.2em', color: (showAllStaffPins || revealedStaffPins[emp.id]) ? '#92400E' : '#0F172A' }}>
                                {showAllStaffPins || revealedStaffPins[emp.id] ? (emp.pin || '440100') : '••••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  playTapSound();
                                  setRevealedStaffPins((prev) => ({ ...prev, [emp.id]: !prev[emp.id] }));
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 1 }}
                                title="Toggle PIN visibility"
                              >
                                {showAllStaffPins || revealedStaffPins[emp.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyCredential(emp.pin || '440100', `card_pin_${emp.id}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedStaffKey === `card_pin_${emp.id}` ? '#16A34A' : '#94A3B8', padding: 1 }}
                                title="Copy 6-digit PIN"
                              >
                                {copiedStaffKey === `card_pin_${emp.id}` ? <Check size={11} color="#16A34A" /> : <Copy size={11} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Top-Right Action Buttons */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-secondary-pill"
                            style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}
                            onClick={() => {
                              playTapSound();
                              setViewingPayslip({
                                ...emp,
                                grossPay: emp.monthlyWage,
                                netPay
                              });
                            }}
                            title="View / Print Salary Payslip"
                          >
                            <Receipt size={12} />
                            <span>Payslip</span>
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-pill"
                            style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}
                            onClick={() => handleOpenEditStaff(emp)}
                            title="Edit staff details and base salary"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-pill"
                            style={{
                              padding: '4px 10px',
                              fontSize: 11,
                              gap: 4,
                              color: isResigned ? '#16A34A' : '#D97706',
                              borderColor: isResigned ? '#BBF7D0' : '#FDE68A',
                              background: isResigned ? '#F0FDF4' : '#FFFBEB'
                            }}
                            onClick={() => handleToggleResignStaff(emp)}
                            title={isResigned ? "Reactivate staff member" : "Mark as resigned"}
                          >
                            {isResigned ? <UserCheck size={12} /> : <UserX size={12} />}
                            <span>{isResigned ? 'Reactivate' : 'Resign'}</span>
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-pill"
                            style={{ padding: '4px 8px', fontSize: 11, color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => handleDeleteStaff(emp)}
                            title="Permanently delete staff record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Financial Row: Base Salary & Month-End Payout */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: 10,
                          marginTop: 12,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          padding: 10,
                          borderRadius: 12
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Monthly Base Salary</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                            ₹{Number(emp.monthlyWage || 0).toLocaleString('en-IN')}
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8' }}> /month</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Month-End Final Payout</span>
                            {isCustomPay && (
                              <span style={{ fontSize: 9.5, padding: '1px 6px', background: '#FEF3C7', color: '#B45309', borderRadius: 6, fontWeight: 700 }}>
                                Custom Payout
                              </span>
                            )}
                          </div>

                          {!isEditingInline ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: isResigned ? '#64748B' : '#16A34A' }}>
                                ₹{netPay.toLocaleString('en-IN')}
                              </span>
                              <button
                                type="button"
                                className="btn-secondary-pill"
                                style={{ padding: '3px 8px', fontSize: 10.5, gap: 4 }}
                                onClick={() => {
                                  playTapSound();
                                  setEditingPayInput((prev) => ({
                                    ...prev,
                                    [emp.id]: String(netPay)
                                  }));
                                }}
                                title="Edit the exact amount this staff member receives at month-end"
                              >
                                <Edit2 size={11} />
                                <span>Edit Pay</span>
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>₹</span>
                              <input
                                type="number"
                                className="ios-input"
                                value={editingPayInput[emp.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditingPayInput((prev) => ({ ...prev, [emp.id]: val }));
                                }}
                                placeholder="e.g. 28000"
                                style={{ maxWidth: 130, padding: '4px 8px', fontSize: 13, fontWeight: 700 }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn-primary-pill"
                                style={{ padding: '5px 10px', fontSize: 11, background: '#16A34A', borderColor: '#16A34A' }}
                                onClick={() => handleSaveInlineMonthEndPay(emp.id)}
                              >
                                <Check size={12} />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary-pill"
                                style={{ padding: '5px 8px', fontSize: 11 }}
                                onClick={() => {
                                  playTapSound();
                                  setEditingPayInput((prev) => {
                                    const copy = { ...prev };
                                    delete copy[emp.id];
                                    return copy;
                                  });
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Permissions Toggles (FR-A6) */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="status-pill tag"
                          style={{
                            background: emp.permissions?.canEditPrice ? '#DCFCE7' : '#F1F5F9',
                            color: emp.permissions?.canEditPrice ? '#16A34A' : '#64748B',
                            border: '1px solid',
                            borderColor: emp.permissions?.canEditPrice ? '#BBF7D0' : '#E2E8F0',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleToggleStaffPermission(emp.id, 'canEditPrice')}
                        >
                          {emp.permissions?.canEditPrice ? '✓ Can Edit POS Price' : 'No Price Edit'}
                        </button>

                        <button
                          type="button"
                          className="status-pill tag"
                          style={{
                            background: emp.permissions?.canCreateDiscounts ? '#DCFCE7' : '#F1F5F9',
                            color: emp.permissions?.canCreateDiscounts ? '#16A34A' : '#64748B',
                            border: '1px solid',
                            borderColor: emp.permissions?.canCreateDiscounts ? '#BBF7D0' : '#E2E8F0',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleToggleStaffPermission(emp.id, 'canCreateDiscounts')}
                        >
                          {emp.permissions?.canCreateDiscounts ? '✓ Can Issue Offers' : 'No Offers'}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Bottom Save Staff & Permissions Bar */}
            <div
              style={{
                marginTop: 14,
                padding: '12px 16px',
                background: '#F0FDF4',
                border: '1.5px solid #86EFAC',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={16} color="#16A34A" />
                  <span>Sync Changes to Counter POS &amp; Terminals</span>
                </div>
                <div style={{ fontSize: 11, color: '#15803D' }}>
                  Save all wage modifications, month-end payouts, and terminal permissions (Edit Price &amp; Issue Offers).
                </div>
              </div>

              <button
                type="button"
                className="btn-primary-pill"
                onClick={handleSaveStaffAndPermissions}
                style={{
                  fontSize: 12,
                  padding: '8px 20px',
                  background: '#16A34A',
                  borderColor: '#15803D',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)'
                }}
              >
                <Save size={14} />
                <span>{isSavingStaff ? 'Saving...' : 'Save Staff & Permissions'}</span>
              </button>
            </div>

            {/* Corporate Bank Salary Disbursal Card */}
            <div
              style={{
                marginTop: 14,
                padding: '14px',
                background: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E5E7EB'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Corporate Bank Payroll Batch Disbursal</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Direct NEFT/IMPS Salary Transmission via ICICI/HDFC Corporate CMS • {activeStaffList.length} Active Staff
                  </div>
                </div>
                <span className="status-pill done" style={{ fontSize: 10 }}>
                  Statutory Verified
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn-primary-pill"
                  style={{ fontSize: 12, padding: '7px 14px', background: '#0284C7' }}
                  onClick={handleExecuteBankPayrollBatch}
                >
                  <Send size={13} />
                  <span>Execute Bank Salary Disbursal (₹{totalNetPayroll.toLocaleString('en-IN')})</span>
                </button>

                <button
                  className="btn-secondary-pill"
                  style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={handleExportPayrollCsv}
                >
                  <Download size={13} />
                  <span>Export Bank Batch CSV</span>
                </button>
              </div>

              {payrollDisbursed && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} />
                  <span>Bank payment batch #CMS-SAL-OCT2026 executed successfully! Transaction reference: <strong>HDFC-CMS-994182</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: BANK STATEMENT CSV RECONCILIATION */}
      {activeAdminTab === 'bank-rec' && (
        <BankReconciliationView orders={orders} theme={theme} />
      )}

      {/* PHASE 3: INVENTORY & RECIPE COSTING */}
      {activeAdminTab === 'inventory' && (
        <InventoryView menu={menu} />
      )}



      {/* 5. MENU MANAGEMENT CRUD (FR-A7) */}
      {activeAdminTab === 'menu' && (
        <div>
          <div className="ios-card" style={{ marginBottom: 16 }}>
            <div className="card-top-row">
              <div className="card-title-group">
                <span className="card-heading">Menu Management (Full CRUD)</span>
                <span className="card-meta-text">Create, edit & manage restaurant items</span>
              </div>
              <button
                className="btn-primary-pill"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => {
                  playTapSound();
                  setShowAddDishModal(true);
                }}
              >
                <Plus size={14} />
                <span>Add New Dish</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menu.map((dish) => (
                <div
                  key={dish.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: 14
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img
                      src={dish.image || DEFAULT_CUTLERY_IMAGE}
                      alt={dish.name}
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = DEFAULT_CUTLERY_IMAGE;
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{dish.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--primary-blue)', fontWeight: 600 }}>
                        ₹{dish.price.toFixed(0)} • {dish.category}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="nav-icon-btn"
                      style={{ width: 30, height: 30, color: '#DC2626' }}
                      onClick={() => handleDeleteDish(dish.id)}
                      title="Delete Dish"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. APP CUSTOMIZER (FR-A5) */}
      {activeAdminTab === 'branding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {/* Main Customizer Settings Card */}
          <div className="ios-card">
            <div className="card-top-row" style={{ marginBottom: 16 }}>
              <div className="card-title-group">
                <span className="card-heading">App Customizer & Branding Studio</span>
                <span className="card-meta-text">Upload your restaurant logo, customize colors, and configure live guest dining touchpoints</span>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `${customizerDraft.accentColor}1A`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Palette size={18} color={customizerDraft.accentColor || '#007AFF'} />
              </div>
            </div>

            {/* Hidden file input for logo */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Section A: Restaurant Brand Logo */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Restaurant Brand Logo
                  </label>
                  <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> Reflects on all headers, footers & receipts
                  </span>
                </div>

                {customizerDraft.logo ? (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: 14,
                      padding: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 80,
                          height: 54,
                          borderRadius: 10,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          backgroundImage: 'linear-gradient(45deg, #F1F5F9 25%, transparent 25%), linear-gradient(-45deg, #F1F5F9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #F1F5F9 75%), linear-gradient(-45deg, transparent 75%, #F1F5F9 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 4,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                        }}
                      >
                        <img
                          src={customizerDraft.logo}
                          alt="Custom Brand Logo"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Custom Logo Active</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>PNG / Scaled for instant &lt;50ms cross-tab broadcast</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() => logoInputRef.current?.click()}
                        style={{ fontSize: 12, padding: '7px 12px' }}
                      >
                        <Upload size={13} color="#007AFF" />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={handleRemoveLogo}
                        style={{ fontSize: 12, padding: '7px 12px', color: '#DC2626', borderColor: '#FECACA' }}
                        title="Remove custom logo and return to default initials"
                      >
                        <Trash2 size={13} color="#DC2626" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: 14,
                      padding: '20px 16px',
                      textAlign: 'center',
                      background: '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = customizerDraft.accentColor || '#007AFF'; e.currentTarget.style.background = '#F0F9FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#EFF6FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px'
                      }}
                    >
                      <Upload size={20} color={customizerDraft.accentColor || '#007AFF'} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                      Click to Upload Restaurant Brand Logo
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      PNG, JPG, SVG, WebP • Auto-optimized for instant multi-device synchronization
                    </div>
                  </div>
                )}
              </div>

              {/* Section B: Brand Identity Text */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Restaurant Name
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    value={customizerDraft.restaurantName}
                    onChange={(e) => {
                      setCustomizerDraft({ ...customizerDraft, restaurantName: e.target.value });
                      setCustomizerSaveSuccess(false);
                    }}
                    placeholder="e.g. Advait Artisanal Kitchen"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Tagline / Cuisine Description
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    value={customizerDraft.tagline || ''}
                    onChange={(e) => {
                      setCustomizerDraft({ ...customizerDraft, tagline: e.target.value });
                      setCustomizerSaveSuccess(false);
                    }}
                    placeholder="e.g. Progressive Indian Table & Craft Kitchen"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Customer Welcome Greeting
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    value={customizerDraft.welcomeMessage}
                    onChange={(e) => {
                      setCustomizerDraft({ ...customizerDraft, welcomeMessage: e.target.value });
                      setCustomizerSaveSuccess(false);
                    }}
                    placeholder="Scan table QR, order effortlessly, and track your kitchen ticket in real time."
                  />
                </div>
              </div>

              {/* Section C: Brand Accent Color & Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Brand Accent Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { hex: '#007AFF', label: 'Royal Blue' },
                      { hex: '#10B981', label: 'Emerald' },
                      { hex: '#8B5CF6', label: 'Purple' },
                      { hex: '#F59E0B', label: 'Amber Gold' },
                      { hex: '#E11D48', label: 'Rose Red' },
                      { hex: '#0F172A', label: 'Midnight Slate' }
                    ].map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setCustomizerDraft({ ...customizerDraft, accentColor: col.hex });
                          setCustomizerSaveSuccess(false);
                        }}
                        title={col.label}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: col.hex,
                          border: customizerDraft.accentColor.toLowerCase() === col.hex.toLowerCase()
                            ? '3px solid #0F172A'
                            : '2px solid #FFFFFF',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                          cursor: 'pointer',
                          outline: 'none',
                          padding: 0
                        }}
                      />
                    ))}

                    {/* Custom HTML5 Color Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                      <input
                        type="color"
                        value={customizerDraft.accentColor}
                        onChange={(e) => {
                          setCustomizerDraft({ ...customizerDraft, accentColor: e.target.value });
                          setCustomizerSaveSuccess(false);
                        }}
                        style={{
                          width: 30,
                          height: 30,
                          padding: 0,
                          border: '1px solid #CBD5E1',
                          borderRadius: '50%',
                          cursor: 'pointer',
                          background: 'none'
                        }}
                        title="Pick custom color"
                      />
                      <span style={{ fontSize: 11, color: '#64748B', fontFamily: 'monospace', fontWeight: 600 }}>
                        {customizerDraft.accentColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Customer Menu Layout
                  </label>
                  <select
                    className="ios-select"
                    value={customizerDraft.menuLayout}
                    onChange={(e) => {
                      setCustomizerDraft({ ...customizerDraft, menuLayout: e.target.value });
                      setCustomizerSaveSuccess(false);
                    }}
                  >
                    <option value="grid">Grid (Cards with rich photos)</option>
                    <option value="list">Compact List (Fast navigation)</option>
                  </select>
                </div>
              </div>

              {/* Section D: Instant UPI Merchant ID */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  UPI Merchant ID / VPA (Customer QR &amp; Instant App Payment)
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="e.g. merchant@upi"
                  value={customizerDraft.upiId || ''}
                  onChange={(e) => {
                    setCustomizerDraft({ ...customizerDraft, upiId: e.target.value.trim() });
                    setCustomizerSaveSuccess(false);
                  }}
                />
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Customer instant UPI QR code scans and app redirects (GPay, PhonePe, Paytm, CRED) will directly credit this UPI address.
                </div>
              </div>

              {/* Section E: Executive Chef Profile & Credentials Studio */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={16} color={customizerDraft.accentColor || '#007AFF'} />
                      <span>About Chef Profile &amp; Accreditation Studio</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Customize the chef's portrait, biography, and choose whether to display official verification badges or hide the entire section.
                    </div>
                  </div>

                  {/* Quick Profile Presets */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary-pill"
                      onClick={() => {
                        playTapSound();
                        setChefDraft((prev) => ({
                          ...prev,
                          showAboutChef: true,
                          showVerifiedBadge: true,
                          showCredentials: true,
                          showHygienePledge: true
                        }));
                        setCustomizerDraft((prev) => ({ ...prev, showAboutChef: true }));
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{ fontSize: 11, padding: '5px 10px', background: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0', fontWeight: 600 }}
                      title="Turn ON chef section and enable all verification badges, diplomas and hygiene pledge"
                    >
                      <ShieldCheck size={12} color="#16A34A" />
                      <span>Full Master Chef &amp; Accreditation</span>
                    </button>

                    <button
                      type="button"
                      className="btn-secondary-pill"
                      onClick={() => {
                        playTapSound();
                        setChefDraft((prev) => ({
                          ...prev,
                          showAboutChef: true,
                          showVerifiedBadge: false,
                          showCredentials: false,
                          showHygienePledge: false
                        }));
                        setCustomizerDraft((prev) => ({ ...prev, showAboutChef: true }));
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{ fontSize: 11, padding: '5px 10px', background: '#F1F5F9', color: '#475569', borderColor: '#CBD5E1', fontWeight: 600 }}
                      title="Show ONLY chef portrait, name, designation & bio (Zero badges or diplomas)"
                    >
                      <Utensils size={12} color="#475569" />
                      <span>Minimalist Profile (Name &amp; Story Only)</span>
                    </button>

                    <button
                      type="button"
                      className="btn-secondary-pill"
                      onClick={() => {
                        playTapSound();
                        setChefDraft((prev) => ({
                          ...prev,
                          showAboutChef: false
                        }));
                        setCustomizerDraft((prev) => ({ ...prev, showAboutChef: false }));
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{ fontSize: 11, padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA', fontWeight: 600 }}
                      title="Completely hide the About Chef section from all customer interfaces"
                    >
                      <EyeOff size={12} color="#DC2626" />
                      <span>Hide Entire Chef Section</span>
                    </button>
                  </div>
                </div>

                {/* Master Visibility Switch: Show or Hide the Entire About Chef Section */}
                <div
                  style={{
                    background: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#F0FDF4' : '#FEF2F2',
                    border: `1.5px solid ${(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#BBF7D0' : '#FECACA'}`,
                    borderRadius: 14,
                    padding: '12px 16px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#DCFCE7' : '#FEE2E2',
                        color: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#16A34A' : '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? (
                        <Eye size={22} />
                      ) : (
                        <EyeOff size={22} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#166534' : '#991B1B', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Customer Interface Chef Visibility:</span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#16A34A' : '#DC2626',
                            color: '#FFFFFF',
                            fontWeight: 700
                          }}
                        >
                          {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? 'VISIBLE (ON)' : 'HIDDEN (OFF)'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#15803D' : '#B91C1C', marginTop: 2 }}>
                        {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false)
                          ? "The entire 'Chef & Story' tab, credentials button, and story profile are visible on customer screens."
                          : "The whole 'About Chef' section is completely hidden from customer screens (bottom navigation, menu button, and URLs)."}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      const nextState = !(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false);
                      setChefDraft((prev) => ({ ...prev, showAboutChef: nextState }));
                      setCustomizerDraft((prev) => ({ ...prev, showAboutChef: nextState }));
                      setCustomizerSaveSuccess(false);
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#16A34A' : '#DC2626',
                      color: '#FFFFFF',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? (
                      <>
                        <EyeOff size={15} />
                        <span>Hide Entire Chef Section</span>
                      </>
                    ) : (
                      <>
                        <Eye size={15} />
                        <span>Show Chef Section to Customers</span>
                      </>
                    )}
                  </button>
                </div>

                {!(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <EyeOff size={15} color="#D97706" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Chef Section is Currently Hidden for Customers:</strong> You can still edit the portrait, bio, and settings below. Your changes will be saved and preserved for whenever you turn the section back ON.
                    </span>
                  </div>
                )}

                {/* Hidden Chef Photo File Input */}
                <input
                  ref={chefPhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleChefPhotoUpload}
                  style={{ display: 'none' }}
                />

                {/* Chef Photo Upload Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                    <img
                      src={chefDraft.portrait || '/assets/chef_portrait.jpg'}
                      alt="Chef portrait preview"
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2.5px solid ${customizerDraft.accentColor || '#007AFF'}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    />
                    {chefDraft.showVerifiedBadge && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          background: '#007AFF',
                          color: '#FFFFFF',
                          borderRadius: '50%',
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid #FFFFFF'
                        }}
                      >
                        <CheckCircle2 size={11} strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Chef Portrait / Photo</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
                      Upload high-resolution chef portrait or paste image link.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() => chefPhotoInputRef.current?.click()}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                      >
                        <Upload size={13} color="#007AFF" />
                        <span>Upload Photo</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={handleResetChefPhoto}
                        style={{ fontSize: 12, padding: '6px 12px', color: '#64748B' }}
                      >
                        <span>Reset Default</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chef Text Fields: Name & Title */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Chef Name
                    </label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="e.g. Rakesh Sharma"
                      value={chefDraft.name}
                      onChange={(e) => {
                        setChefDraft({ ...chefDraft, name: e.target.value });
                        setCustomizerSaveSuccess(false);
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Chef Designation / Title
                    </label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="e.g. Executive Chef & Master Director"
                      value={chefDraft.title}
                      onChange={(e) => {
                        setChefDraft({ ...chefDraft, title: e.target.value });
                        setCustomizerSaveSuccess(false);
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Years of Culinary Mastery
                    </label>
                    <input
                      type="number"
                      className="ios-input"
                      placeholder="18"
                      value={chefDraft.experienceYears}
                      onChange={(e) => {
                        setChefDraft({ ...chefDraft, experienceYears: Number(e.target.value) || 0 });
                        setCustomizerSaveSuccess(false);
                      }}
                    />
                  </div>
                </div>

                {/* Chef Text Fields: Bio & Philosophy */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Chef Biography &amp; Culinary Experience (Text)
                    </label>
                    <textarea
                      className="ios-input"
                      rows={3}
                      placeholder="Describe the chef's culinary journey, background, and artisanal craft..."
                      value={chefDraft.bio}
                      onChange={(e) => {
                        setChefDraft({ ...chefDraft, bio: e.target.value });
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{ resize: 'vertical', minHeight: 65 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                      Culinary Story &amp; Philosophy Quote
                    </label>
                    <textarea
                      className="ios-input"
                      rows={2}
                      placeholder="Chef's personal food quote or philosophy..."
                      value={chefDraft.philosophy}
                      onChange={(e) => {
                        setChefDraft({ ...chefDraft, philosophy: e.target.value });
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{ resize: 'vertical', minHeight: 50 }}
                    />
                  </div>
                </div>

                {/* Section E Toggles: Verification Badges & Credentials Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                    Display &amp; Verification Toggles:
                  </div>

                  {/* Toggle 1: Show Verified Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={14} color="#16A34A" />
                        <span>Show Verified Master Chef Badge &amp; FSSAI Audit Button</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Displays "Officially Verified Master Chef" badge, portrait checkmark, and FSSAI hash audit verification button.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setChefDraft({ ...chefDraft, showVerifiedBadge: !chefDraft.showVerifiedBadge });
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: 'none',
                        background: chefDraft.showVerifiedBadge ? '#16A34A' : '#CBD5E1',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {chefDraft.showVerifiedBadge ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  {/* Toggle 2: Show Accredited Diplomas & Audits */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Award size={14} color="#D97706" />
                        <span>Show Accredited Diplomas &amp; Audits Credentials Section</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Displays Government of India (IHM Pusa), Indian Culinary Forum (ICF), and FoSTaC certified diplomas grid.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setChefDraft({ ...chefDraft, showCredentials: !chefDraft.showCredentials });
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: 'none',
                        background: chefDraft.showCredentials ? '#D97706' : '#CBD5E1',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {chefDraft.showCredentials ? 'Visible' : 'Hidden'}
                    </button>
                  </div>

                  {/* Toggle 3: Show Hygiene & Sourcing Pledge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} color="#8B5CF6" />
                        <span>Show FSSAI Hygiene &amp; Quality Sourcing Pledge</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Displays 100% stone-ground spices, pure A2 Gir cow ghee, and microbial testing quality pledge card.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setChefDraft({ ...chefDraft, showHygienePledge: !chefDraft.showHygienePledge });
                        setCustomizerSaveSuccess(false);
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: 'none',
                        background: chefDraft.showHygienePledge ? '#8B5CF6' : '#CBD5E1',
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {chefDraft.showHygienePledge ? 'Visible' : 'Hidden'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section F: Live Interactive Customer Header & Chef Preview */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={13} color={customizerDraft.accentColor || '#007AFF'} />
                  <span>Live Customer Dining Preview</span>
                </div>

                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E2E8F0',
                    borderRadius: 16,
                    padding: 14,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                  }}
                >
                  {/* Mock Customer Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: 12,
                      borderBottom: '1px solid #F1F5F9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          padding: 2
                        }}
                      >
                        {customizerDraft.logo ? (
                          <img
                            src={customizerDraft.logo}
                            alt="Logo preview"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 800, color: customizerDraft.accentColor }}>
                            {(customizerDraft.restaurantName || 'AD').substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                          {customizerDraft.restaurantName || 'Your Restaurant'}
                        </div>
                        <div style={{ fontSize: 10, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                          <ShieldCheck size={10} color="#16A34A" /> FSSAI 5-Star Clean Dining
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: `${customizerDraft.accentColor}1A`,
                        color: customizerDraft.accentColor,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Utensils size={10} />
                      <span>Table 04</span>
                    </div>
                  </div>

                  {/* Mock Menu Banner */}
                  <div style={{ paddingTop: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                      {customizerDraft.restaurantName || 'Your Restaurant'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      {customizerDraft.welcomeMessage || 'Welcome to Table 04! Order fresh dishes directly to your table.'}
                    </div>
                  </div>

                  {/* Mock Chef Profile Preview */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Live Chef Profile Dining Tab Preview:</span>
                      <span style={{ fontSize: 10, color: (chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                        {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? '● Active on Customer Screen' : '○ Hidden from Customer Screen'}
                      </span>
                    </div>

                    {(chefDraft.showAboutChef !== false && customizerDraft.showAboutChef !== false) ? (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12 }}>
                        {chefDraft.showVerifiedBadge && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span className="status-pill done" style={{ fontSize: 10, padding: '2px 8px' }}>
                              <ShieldCheck size={11} /> Officially Verified Master Chef
                            </span>
                            <span style={{ fontSize: 10, color: '#64748B' }}>Lic: FSSAI-LIC-10026011009821</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                            <img
                              src={chefDraft.portrait || '/assets/chef_portrait.jpg'}
                              alt="Chef"
                              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${customizerDraft.accentColor || '#007AFF'}` }}
                            />
                            {chefDraft.showVerifiedBadge && (
                              <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#007AFF', color: '#FFF', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle2 size={9} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{chefDraft.name || 'Chef Name'}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{chefDraft.title} • {chefDraft.experienceYears}+ Yrs Mastery</div>
                          </div>
                        </div>
                        {chefDraft.bio && (
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 8, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {chefDraft.bio}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {chefDraft.showCredentials && (
                            <span style={{ fontSize: 9.5, padding: '2px 6px', background: '#FEF3C7', color: '#B45309', borderRadius: 6, fontWeight: 600 }}>
                              Govt. Accredited Diplomas
                            </span>
                          )}
                          {chefDraft.showHygienePledge && (
                            <span style={{ fontSize: 9.5, padding: '2px 6px', background: '#DCFCE7', color: '#15803D', borderRadius: 6, fontWeight: 600 }}>
                              FSSAI Hygiene &amp; Sourcing
                            </span>
                          )}
                          {!chefDraft.showCredentials && !chefDraft.showVerifiedBadge && !chefDraft.showHygienePledge && (
                            <span style={{ fontSize: 9.5, padding: '2px 6px', background: '#F1F5F9', color: '#475569', borderRadius: 6, fontWeight: 600 }}>
                              Minimalist Chef Profile Active
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#FEF2F2', border: '1.5px dashed #FCA5A5', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', padding: 8, background: '#FEE2E2', borderRadius: '50%', color: '#DC2626', marginBottom: 8 }}>
                          <EyeOff size={20} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                          About Chef Section is Currently Hidden
                        </div>
                        <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
                          Customer devices will not see the "Chef &amp; Story" tab in bottom navigation, chef credential badges, or the story page. The customer bottom dock will only display Menu, Orders, and Call Waiter.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section F: Prominent Save & Apply Button */}
              <div style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="btn-primary-ios"
                  onClick={handleSaveCustomizer}
                  disabled={isSavingCustomizer}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    fontSize: 15,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: customizerSaveSuccess ? '#16A34A' : (customizerDraft.accentColor || '#007AFF'),
                    borderColor: customizerSaveSuccess ? '#16A34A' : (customizerDraft.accentColor || '#007AFF'),
                    boxShadow: customizerSaveSuccess ? '0 4px 14px rgba(22, 163, 74, 0.35)' : `0 4px 14px ${customizerDraft.accentColor}40`,
                    transition: 'all 0.2s ease',
                    cursor: isSavingCustomizer ? 'not-allowed' : 'pointer'
                  }}
                >
                  {customizerSaveSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Settings &amp; Logo Saved and Synced!</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>{isSavingCustomizer ? 'Saving & Syncing...' : 'Save & Apply Customizer Settings'}</span>
                    </>
                  )}
                </button>

                <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 8 }}>
                  ⚡ Real-Time Sync: Changes are saved to this restaurant business and broadcasted immediately (&lt;50ms) to customer dining phones, QR menus, and POS stations.
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone: Account Deletion Card */}
          <div className="ios-card" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <AlertTriangle size={18} color="#EF4444" />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#DC2626' }}>
                    Danger Zone: Delete Business Account
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 540, lineHeight: 1.5 }}>
                  Permanently erase {activeBiz?.name}. Clears user email and credentials from Firebase Authentication and completely destroys all orders, menus, staff payroll, and operational database records. Non-PII tax audit logs are sealed for legal retention (GST Act Sec 36).
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowDeleteAccountModal(true);
                  setDeleteConfirmText('');
                  setDeleteConfirmPin('');
                  setDeleteAccountError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 12,
                  background: '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                  transition: 'all 0.2s'
                }}
              >
                <Trash2 size={16} />
                <span>Delete Business Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Dish Modal (FR-A7) */}
      {showAddDishModal && (
        <div className="modal-overlay" onClick={() => setShowAddDishModal(false)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />
            <div className="card-heading" style={{ fontSize: 18, marginBottom: 4 }}>Add New Menu Item</div>
            <div className="card-meta-text" style={{ marginBottom: 14 }}>Will appear in real-time on customer QR menu</div>

            <form onSubmit={handleAddDishSubmit}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Dish Name</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="e.g. Tandoori Stuffed Kulcha Platter"
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Category</label>
                  <select
                    className="ios-select"
                    value={newDishCategory}
                    onChange={(e) => setNewDishCategory(e.target.value)}
                  >
                    <option value="Signatures">Signatures</option>
                    <option value="Mains & Sides">Mains & Sides</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Price (₹)</label>
                  <input
                    type="number"
                    step="5"
                    className="ios-input"
                    placeholder="340"
                    value={newDishPrice}
                    onChange={(e) => setNewDishPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Dietary Type</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={newDishVeg}
                      onChange={() => setNewDishVeg(true)}
                    />
                    <span>Vegetarian (Green Dot)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input
                      type="radio"
                      checked={!newDishVeg}
                      onChange={() => setNewDishVeg(false)}
                    />
                    <span>Non-Vegetarian (Red Dot)</span>
                  </label>
                </div>
              </div>

              {/* Optional Photo Upload */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                  Dish Photo (Optional)
                </label>

                {newDishImage ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#F0FDF4',
                      border: '1.5px solid #86EFAC',
                      borderRadius: 12,
                      padding: '10px 12px'
                    }}
                  >
                    <img
                      src={newDishImage}
                      alt="Uploaded preview"
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>Photo Uploaded ✓</div>
                      <div style={{ fontSize: 11, color: '#166534' }}>Ready to sync across customer devices</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewDishImage(null)}
                      style={{
                        background: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        color: '#DC2626',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      id="dish-photo-file-input"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleDishImageUpload}
                    />
                    <div
                      onClick={() => {
                        const input = document.getElementById('dish-photo-file-input');
                        if (input) input.click();
                      }}
                      style={{
                        border: '1.5px dashed #CBD5E1',
                        borderRadius: 12,
                        padding: '14px',
                        textAlign: 'center',
                        background: '#F8FAFC',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#007AFF', fontSize: 13, fontWeight: 600 }}>
                        <Camera size={16} />
                        <span>{imageUploadLoading ? 'Optimizing photo...' : 'Upload Dish Photo (Optional)'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                        If no photo is uploaded, a default cutlery image will be displayed.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Dish Tags (Comma-separated)</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="Chef's Special, Best Seller"
                  value={newDishTags}
                  onChange={(e) => setNewDishTags(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Bullet Description (Comma-separated)</label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="Slow tandoor baked, stuffed with spiced paneer & served with chhole"
                  value={newDishBullets}
                  onChange={(e) => setNewDishBullets(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary-pill full-width">
                Save & Add to QR Menu
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal (INR) without attendance */}
      {viewingPayslip && (() => {
        const baseWage = Number(viewingPayslip.monthlyWage || 0);
        const finalNetPay = Number(viewingPayslip.netPay ?? viewingPayslip.monthEndPay ?? baseWage);
        const adjustment = finalNetPay - baseWage;
        const isResigned = viewingPayslip.status === 'resigned';

        return (
          <div className="modal-overlay" onClick={() => setViewingPayslip(null)}>
            <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '92%' }}>
              <div className="modal-drag-pill" />
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div className="card-heading" style={{ fontSize: 18 }}>Monthly Salary Payslip</div>
                <div className="card-meta-text">
                  {theme?.restaurantName || 'Advait Artisanal Kitchen'} • Period: {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div
                style={{
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 14,
                  padding: 14,
                  fontSize: 12,
                  marginBottom: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Employee Name:</span>
                  <strong>{viewingPayslip.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Designation:</span>
                  <span>{viewingPayslip.role}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Employment Status:</span>
                  <span
                    className={`status-pill ${isResigned ? 'rejected' : 'done'}`}
                    style={{ fontSize: 9.5, padding: '2px 8px' }}
                  >
                    {isResigned ? 'Resigned' : 'Active Staff'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Bank Account:</span>
                  <span style={{ fontFamily: 'monospace' }}>{viewingPayslip.bankAccount || 'Direct Bank NEFT'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
                  <span style={{ fontFamily: 'monospace' }}>{viewingPayslip.ifsc || 'HDFC0000128'}</span>
                </div>

                <div style={{ borderTop: '1px solid #E5E7EB', margin: '8px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Monthly Base Salary:</span>
                  <strong>₹{baseWage.toLocaleString('en-IN')}</strong>
                </div>

                {adjustment !== 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      color: adjustment > 0 ? '#16A34A' : '#DC2626'
                    }}
                  >
                    <span>{adjustment > 0 ? 'Month-End Incentive / Bonus:' : 'Month-End Adjustment / Deduction:'}</span>
                    <span style={{ fontWeight: 700 }}>
                      {adjustment > 0 ? `+₹${adjustment.toLocaleString('en-IN')}` : `-₹${Math.abs(adjustment).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderTop: '1px solid #E5E7EB',
                    paddingTop: 8,
                    marginTop: 6,
                    fontSize: 15,
                    fontWeight: 700
                  }}
                >
                  <span>Net Month-End Payout (INR):</span>
                  <span style={{ color: isResigned ? '#64748B' : '#16A34A' }}>₹{finalNetPay.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-primary-pill full-width"
                  onClick={() => {
                    playTapSound();
                    window.print();
                  }}
                >
                  <span>Print / Download Payslip</span>
                </button>
                <button
                  className="btn-secondary-pill"
                  onClick={() => setViewingPayslip(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD / EDIT STAFF MODAL SHEET */}
      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)} style={{ zIndex: 9999 }}>
          <div
            className="modal-content-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: '92%', borderRadius: 20, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="#007AFF" />
                <span className="card-heading" style={{ fontSize: 17 }}>
                  {editingStaffId ? 'Edit Staff Member' : 'Add New Staff Member'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStaffModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStaff}>
              {/* Full Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="e.g. Rahul Sharma"
                  value={staffFormData.name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              {/* Designation / Role */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Role / Designation *
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder="e.g. Service Captain & Floor Lead"
                  value={staffFormData.role}
                  onChange={(e) => setStaffFormData({ ...staffFormData, role: e.target.value })}
                  required
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {[
                    'Executive Chef',
                    'Sous Chef',
                    'Service Captain & Floor Lead',
                    'Cashier & Counter POS Lead',
                    'Steward & Server',
                    'Kitchen Helper'
                  ].map((roleTitle) => (
                    <button
                      key={roleTitle}
                      type="button"
                      onClick={() => setStaffFormData({ ...staffFormData, role: roleTitle })}
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: '1px solid #CBD5E1',
                        background: staffFormData.role === roleTitle ? '#007AFF' : '#F8FAFC',
                        color: staffFormData.role === roleTitle ? '#FFFFFF' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {roleTitle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone & Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="+91 98765 43210"
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Employment Status
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setStaffFormData({ ...staffFormData, status: 'active' })}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: staffFormData.status === 'active' ? '#16A34A' : '#E2E8F0',
                        background: staffFormData.status === 'active' ? '#DCFCE7' : '#F8FAFC',
                        color: staffFormData.status === 'active' ? '#15803D' : '#64748B',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStaffFormData({ ...staffFormData, status: 'resigned' })}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: staffFormData.status === 'resigned' ? '#DC2626' : '#E2E8F0',
                        background: staffFormData.status === 'resigned' ? '#FEE2E2' : '#F8FAFC',
                        color: staffFormData.status === 'resigned' ? '#B91C1C' : '#64748B',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Resigned
                    </button>
                  </div>
                </div>
              </div>

              {/* POS Terminal Credentials Section (Owner Controlled) */}
              <div
                style={{
                  padding: 12,
                  background: '#F5F3FF',
                  border: '1.5px solid #DDD6FE',
                  borderRadius: 12,
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <KeyRound size={14} color="#7C3AED" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#5B21B6' }}>
                    Staff POS Terminal Login Credentials (Owner Controlled)
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#4C1D95', display: 'block', marginBottom: 4 }}>
                      Staff Login ID *
                    </label>
                    <input
                      type="text"
                      className="ios-input"
                      placeholder="e.g. rahul.pos"
                      value={staffFormData.loginId}
                      onChange={(e) => setStaffFormData({ ...staffFormData, loginId: e.target.value })}
                      required
                      style={{ fontFamily: 'monospace', fontWeight: 600 }}
                    />
                    <span style={{ fontSize: 9.5, color: '#6D28D9', marginTop: 2, display: 'block' }}>Used on live POS station</span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#4C1D95' }}>
                        6-Digit POS PIN *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randPin = String(Math.floor(100000 + Math.random() * 900000));
                          setStaffFormData((prev) => ({ ...prev, pin: randPin }));
                        }}
                        style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                      >
                        🎲 Auto-Gen
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      className="ios-input"
                      placeholder="Enter 6-digit PIN"
                      value={staffFormData.pin}
                      onChange={(e) => setStaffFormData({ ...staffFormData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      required
                      style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}
                    />
                    <span style={{ fontSize: 9.5, color: '#6D28D9', marginTop: 2, display: 'block' }}>Employee secret PIN</span>
                  </div>
                </div>
              </div>

              {/* Salary Section: Base Salary & Month-End Pay */}
              <div
                style={{
                  padding: 12,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', display: 'block', marginBottom: 4 }}>
                      Monthly Base Salary (₹) *
                    </label>
                    <input
                      type="number"
                      className="ios-input"
                      placeholder="e.g. 28000"
                      value={staffFormData.monthlyWage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStaffFormData((prev) => ({
                          ...prev,
                          monthlyWage: val,
                          monthEndPay: prev.monthEndPay === '' || prev.monthEndPay === prev.monthlyWage ? val : prev.monthEndPay
                        }));
                      }}
                      required
                      min="0"
                    />
                    <span style={{ fontSize: 10, color: '#64748B', marginTop: 2, display: 'block' }}>Regular monthly wage</span>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#16A34A', display: 'block', marginBottom: 4 }}>
                      Month-End Payout (₹)
                    </label>
                    <input
                      type="number"
                      className="ios-input"
                      placeholder="e.g. 30000"
                      value={staffFormData.monthEndPay}
                      onChange={(e) => setStaffFormData({ ...staffFormData, monthEndPay: e.target.value })}
                      min="0"
                    />
                    <span style={{ fontSize: 10, color: '#64748B', marginTop: 2, display: 'block' }}>Custom payout this month</span>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 8 }}>
                  💡 Owner can edit how much pay any staff member receives at month-end. Leave Month-End Payout equal to Base Salary if no adjustment.
                </div>
              </div>

              {/* Bank Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Bank Account No.
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="e.g. 982100481239"
                    value={staffFormData.bankAccount}
                    onChange={(e) => setStaffFormData({ ...staffFormData, bankAccount: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    className="ios-input"
                    placeholder="e.g. HDFC0000128"
                    value={staffFormData.ifsc}
                    onChange={(e) => setStaffFormData({ ...staffFormData, ifsc: e.target.value })}
                  />
                </div>
              </div>

              {/* POS Permissions */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Role &amp; Terminal Permissions:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={staffFormData.canEditPrice}
                      onChange={(e) => setStaffFormData({ ...staffFormData, canEditPrice: e.target.checked })}
                    />
                    <span>Allow staff to edit item prices on Counter POS</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={staffFormData.canCreateDiscounts}
                      onChange={(e) => setStaffFormData({ ...staffFormData, canCreateDiscounts: e.target.checked })}
                    />
                    <span>Allow staff to issue custom offers &amp; discounts</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit" className="btn-primary-pill full-width">
                  {editingStaffId ? 'Save Changes' : 'Add Staff to Payroll'}
                </button>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => setShowStaffModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT COUPON MODAL */}
      {showCouponModal && (
        <div className="modal-overlay" onClick={() => setShowCouponModal(false)} style={{ zIndex: 9999 }}>
          <div
            className="modal-content-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480, width: '92%', borderRadius: 20, padding: 20 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color="#007AFF" />
                <span className="card-heading" style={{ fontSize: 17 }}>
                  {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Promo Coupon'}
                </span>
              </div>
              <button
                onClick={() => setShowCouponModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoupon}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ADVAIT25"
                    className="ios-input"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                    style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Discount Type *
                  </label>
                  <select
                    className="ios-select"
                    value={couponForm.type}
                    onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}
                  >
                    <option value="percent">Percentage (%) Off</option>
                    <option value="flat">Flat Amount (₹) Off</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Discount Value * {couponForm.type === 'percent' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder={couponForm.type === 'percent' ? 'e.g. 15' : 'e.g. 100'}
                    className="ios-input"
                    value={couponForm.value}
                    onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Minimum Order (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="e.g. 500 (0 for none)"
                    className="ios-input"
                    value={couponForm.minOrderAmount}
                    onChange={(e) => setCouponForm({ ...couponForm, minOrderAmount: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="ios-input"
                    value={couponForm.expiryDate}
                    onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 250 (Optional)"
                    className="ios-input"
                    value={couponForm.maxDiscount}
                    onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })}
                    disabled={couponForm.type !== 'percent'}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                  Description / Campaign Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. 15% Off on Dinner & Craft Beverages"
                  className="ios-input"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <input
                  type="checkbox"
                  id="couponIsActiveCheck"
                  checked={couponForm.isActive}
                  onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#007AFF' }}
                />
                <label htmlFor="couponIsActiveCheck" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Enable and activate this coupon immediately
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn-primary-pill full-width" style={{ padding: '10px' }}>
                  <CheckCircle2 size={16} />
                  <span>{editingCoupon ? 'Update Coupon' : 'Publish Coupon'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-pill"
                  onClick={() => setShowCouponModal(false)}
                  style={{ padding: '10px 16px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EXECUTIVE OWNER CREDENTIALS MODAL */}
      {showOwnerCredentialsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => setShowOwnerCredentialsModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              color: '#F8FAFC'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)'
                  }}
                >
                  <KeyRound size={20} color="#FFFFFF" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                    Executive Credentials Vault
                  </h3>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    {activeBiz?.name} • Multi-Tenant Partition ({activeBiz?.id})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerCredentialsModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 10,
                background: (activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${(activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: (activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? '#34D399' : '#F87171' }}>
                <ShieldCheck size={15} />
                <span>{(activeBiz?.status === 'active' && activeBiz?.emailVerified !== false) ? 'Account Active & Verified' : 'Account Suspended'}</span>
              </div>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                Plan: <strong style={{ color: '#E2E8F0' }}>{activeBiz?.plan || 'Enterprise'}</strong>
              </span>
            </div>

            {/* Credentials Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {/* 1. Owner Login Email */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  OWNER ADMIN LOGIN EMAIL
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#38BDF8', wordBreak: 'break-all' }}>
                    {activeBiz?.owner?.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyOwnerCredential(activeBiz?.owner?.email, 'modal_email')}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                  >
                    {copiedOwnerKey === 'modal_email' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* 2. Owner Master PIN */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    OWNER MASTER PIN (6 DIGITS)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOwnerPin(!showOwnerPin)}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {showOwnerPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showOwnerPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#F59E0B', letterSpacing: showOwnerPin ? '0.15em' : '0.25em' }}>
                    {showOwnerPin ? activeBiz?.owner?.pin : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyOwnerCredential(activeBiz?.owner?.pin, 'modal_pin')}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                  >
                    {copiedOwnerKey === 'modal_pin' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* 3. Counter Staff POS PIN */}
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    COUNTER POS PIN (6 DIGITS)
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCounterPin(!showCounterPin)}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {showCounterPin ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>{showCounterPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#10B981', letterSpacing: showCounterPin ? '0.15em' : '0.25em' }}>
                    {showCounterPin ? activeBiz?.counter?.pin : '••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyOwnerCredential(activeBiz?.counter?.pin, 'modal_counter_pin')}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                  >
                    {copiedOwnerKey === 'modal_counter_pin' ? <Check size={16} color="#34D399" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5, margin: '0 0 16px' }}>
              These credentials authenticate this specific restaurant tenant. Any credentials changes made in Developer Console (<strong>#manj</strong>) or via Password Reset are updated here in real time.
            </p>

            <button
              type="button"
              className="btn-primary-pill full-width"
              onClick={() => setShowOwnerCredentialsModal(false)}
              style={{ padding: '11px', justifyContent: 'center' }}
            >
              Close Credentials Vault
            </button>

            {/* Danger Zone: Account Deletion */}
            <div
              style={{
                marginTop: 16,
                padding: '14px',
                borderRadius: 14,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={15} color="#EF4444" />
                <span style={{ fontSize: 12, fontWeight: 800, color: '#F87171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Danger Zone: Account Deletion
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 10px', lineHeight: 1.4 }}>
                Permanently delete this business account. Wipes user email &amp; credentials from Firebase Authentication and completely erases orders, menus, staff, and database history. Non-PII tax records are sealed for statutory legal retention (GST Act Sec 36).
              </p>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowOwnerCredentialsModal(false);
                  setShowDeleteAccountModal(true);
                  setDeleteConfirmText('');
                  setDeleteConfirmPin('');
                  setDeleteAccountError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#F87171',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Trash2 size={14} />
                <span>Delete Business Account &amp; Erase All Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* OWNER BUSINESS ACCOUNT DELETION MODAL */}
      {showDeleteAccountModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16
          }}
          onClick={() => {
            if (!isDeletingAccount) setShowDeleteAccountModal(false);
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#0F172A',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 22,
              padding: 26,
              boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.25)',
              color: '#F8FAFC'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <AlertOctagon size={22} color="#EF4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                    Permanently Delete Business Account
                  </h3>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>
                    {activeBiz?.name} • {activeBiz?.owner?.email}
                  </span>
                </div>
              </div>
              {!isDeletingAccount && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Critical Warning Callout */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 12,
                lineHeight: 1.5,
                color: '#FECACA'
              }}
            >
              <strong style={{ color: '#F87171', display: 'block', marginBottom: 4 }}>
                ⚠️ Irreversible Data Erasure Notice:
              </strong>
              • User email (<strong>{activeBiz?.owner?.email}</strong>) and password/credentials will be permanently wiped from Firebase Users &amp; Authentication.<br />
              • All live orders, active menus, staff credentials, checklists, and local database partitions will be destroyed.<br />
              • Statutory Compliance: Under Indian GST Act (Sec 36) &amp; DPDP Act 2023, a sealed, non-PII financial &amp; tax audit record will be preserved for the mandatory 7-year audit retention.
            </div>

            {deleteAccountError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #EF4444',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 16,
                  fontSize: 12,
                  color: '#FCA5A5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <AlertTriangle size={15} color="#EF4444" />
                <span>{deleteAccountError}</span>
              </div>
            )}

            {/* Verification Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0', display: 'block', marginBottom: 6 }}>
                  Type <span style={{ color: '#EF4444', fontFamily: 'monospace' }}>DELETE</span> to confirm intent:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  disabled={isDeletingAccount}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#F8FAFC',
                    fontSize: 14,
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0', display: 'block', marginBottom: 6 }}>
                  Enter your 6-digit Owner Master PIN:
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={deleteConfirmPin}
                  onChange={(e) => setDeleteConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  disabled={isDeletingAccount}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#F8FAFC',
                    fontSize: 16,
                    fontFamily: 'monospace',
                    letterSpacing: '0.25em',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94A3B8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isDeletingAccount ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleOwnerSelfDeleteAccount}
                disabled={
                  isDeletingAccount ||
                  deleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                  deleteConfirmPin.trim().length !== 6
                }
                style={{
                  flex: 1.6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px',
                  borderRadius: 10,
                  background:
                    deleteConfirmText.trim().toUpperCase() === 'DELETE' &&
                    deleteConfirmPin.trim().length === 6 &&
                    !isDeletingAccount
                      ? '#EF4444'
                      : 'rgba(239, 68, 68, 0.3)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor:
                    deleteConfirmText.trim().toUpperCase() === 'DELETE' &&
                    deleteConfirmPin.trim().length === 6 &&
                    !isDeletingAccount
                      ? 'pointer'
                      : 'not-allowed',
                  boxShadow:
                    deleteConfirmText.trim().toUpperCase() === 'DELETE' &&
                    deleteConfirmPin.trim().length === 6 &&
                    !isDeletingAccount
                      ? '0 4px 14px rgba(239, 68, 68, 0.4)'
                      : 'none'
                }}
              >
                {isDeletingAccount ? (
                  <span>Erasing All Data...</span>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Permanently Erase Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
