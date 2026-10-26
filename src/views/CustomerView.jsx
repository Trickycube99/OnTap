import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Clock,
  Flame,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  X,
  CreditCard,
  QrCode,
  ArrowRight,
  MessageSquare,
  Bell,
  Check,
  AlertTriangle,
  User,
  Edit2,
  Utensils,
  Tag,
  Copy,
  XCircle,
  RotateCcw
} from 'lucide-react';
import QRCode from 'qrcode';
import { playTapSound, playSuccessChime, playAlertChime } from '../utils/audio';
import { getTranslation } from '../utils/i18n';
import { broadcastSyncEvent, SYNC_EVENTS } from '../utils/sync';
import { DEFAULT_CUTLERY_IMAGE } from '../data/initialData';
import { getActiveBusiness } from '../utils/businessManager';
import {
  wipeAllCustomerData,
  isCustomerSessionExpired,
  detectFreshQrScan,
  markQrScanConsumed,
  initCustomerInactivityWatcher,
  getCustomerStorageKeys
} from '../utils/customerSessionManager';
import DmcaModal from '../components/DmcaModal';
import LegalModal from '../components/LegalModal';
import CookieBanner from '../components/CookieBanner';
import SlideModal from '../components/SlideModal';
import cookingAnimationGif from '../assets/output-onlinegiftools.gif';
import { COMPANY_LEGAL_INFO } from '../utils/privacyCompliance';

export default function CustomerView({
  activeBusinessId = '',
  menu,
  chef,
  theme,
  activeTable,
  _setActiveTable,
  orders,
  cart,
  setCart,
  onPlaceOrder,
  onGoToChef,
  searchQuery,
  offers,
  language = 'en',
  onOpenStaffPortal,
  activeTab = 'menu',
  setActiveTab
}) {
  const t = (key) => getTranslation(language, key);

  const isCurrentBizSuspended = useMemo(() => {
    const biz = getActiveBusiness();
    return biz ? biz.status === 'suspended' : false;
  }, [activeBusinessId]);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [itemNoteInput, setItemNoteInput] = useState('');
  
  // Diner Identification State (Scoped strictly to this browser tab session via sessionStorage)
  // Survives page refresh within the same tab, but prompts again when opening a new tab
  const customerStorageKeys = useMemo(() => getCustomerStorageKeys(activeBusinessId), [activeBusinessId]);
  const dinerNameKey = customerStorageKeys.dinerName;
  const dinerPhoneKey = customerStorageKeys.dinerPhone;
  const dinerOrderIdsKey = customerStorageKeys.orderIds;
  const dinerLegacyOrderKey = customerStorageKeys.lastOrderId;

  const [customerName, setCustomerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(dinerNameKey) || sessionStorage.getItem('ontap_diner_name') || '';
    }
    return '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(dinerPhoneKey) || sessionStorage.getItem('ontap_diner_phone') || '';
    }
    return '';
  });
  const [showNameModal, setShowNameModal] = useState(false);
  const [showOrderStatusTipModal, setShowOrderStatusTipModal] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(dinerNameKey) || sessionStorage.getItem('ontap_diner_name') || '';
    }
    return '';
  });
  const [customerPhoneInput, setCustomerPhoneInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(dinerPhoneKey) || sessionStorage.getItem('ontap_diner_phone') || '';
    }
    return '';
  });
  const [nameError, setNameError] = useState('');
  const [showDmcaModal, setShowDmcaModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('privacy');
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Session Notification Banner State
  const [sessionNotice, setSessionNotice] = useState(null);

  // Master customer interface wipe function
  const handleWipeCustomerInterface = (reason = 'inactivity') => {
    wipeAllCustomerData(activeBusinessId);
    if (typeof setCart === 'function') setCart([]);
    setPlacedOrderIds([]);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNameInput('');
    setCustomerPhoneInput('');
    setShowNameModal(true);
    setOrderNote('');
    setAppliedPromo(null);
    setPromoInput('');
    setPromoMessage('');
    setIsCartOpen(false);
    setShowUpiModal(false);
    setCustomizingItem(null);
    setItemNoteInput('');
    setSelectedCategory('All');
    setVegOnly(false);
    setShowOrderStatusTipModal(false);
    try {
      sessionStorage.removeItem('ontap_order_status_tip_seen');
    } catch (e) {}
    if (typeof setActiveTab === 'function') setActiveTab('menu');

    if (reason === 'inactivity') {
      setSessionNotice({
        type: 'warning',
        text: 'Session refreshed after inactivity. Fresh menu loaded.'
      });
      setTimeout(() => setSessionNotice(null), 8000);
    } else if (reason === 'qr_rescan') {
      setSessionNotice({
        type: 'info',
        text: 'Welcome! A fresh dining session has started.'
      });
      setTimeout(() => setSessionNotice(null), 8000);
    }
  };

  // 1. Initial check on mount: wipe if session expired (>2 hours) or if fresh QR was scanned
  useEffect(() => {
    if (isCustomerSessionExpired()) {
      handleWipeCustomerInterface('inactivity');
    } else if (detectFreshQrScan()) {
      handleWipeCustomerInterface('qr_rescan');
      markQrScanConsumed(activeTable);
    }
  }, [activeTable, activeBusinessId]);

  // 2. Continuous 2-hour inactivity watcher and tab close wipe listener
  useEffect(() => {
    const cleanup = initCustomerInactivityWatcher({
      bizId: activeBusinessId,
      onInactivityExpire: () => {
        handleWipeCustomerInterface('inactivity');
      }
    });
    return cleanup;
  }, [activeBusinessId]);

  const [placedOrderIds, setPlacedOrderIds] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(dinerOrderIdsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        // fallback
      }
      const legacy = sessionStorage.getItem(dinerLegacyOrderKey) || '';
      return legacy ? [legacy] : [];
    }
    return [];
  });
  const lastPlacedOrderId = placedOrderIds[0] || '';
  const setLastPlacedOrderId = (newId) => {
    if (!newId) {
      setPlacedOrderIds([]);
    } else {
      setPlacedOrderIds((prev) => [newId, ...prev.filter((id) => id !== newId)]);
    }
  };

  const [orderNote, setOrderNote] = useState('');
  const [paymentMode, setPaymentMode] = useState('counter'); // 'counter' | 'upi'
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoMessage, setPromoMessage] = useState('');
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [localQrDataUrl, setLocalQrDataUrl] = useState('');
  const [serverCalledAlert, setServerCalledAlert] = useState(false);
  const secretTapCount = useRef(0);
  const secretTapTimer = useRef(null);

  // Dynamic category list derived directly from active business menu
  const categoryKeys = useMemo(() => {
    const uniqueCats = Array.from(new Set((menu || []).map((item) => item.category).filter(Boolean)));
    const allPill = { id: 'All', label: language === 'hi' ? 'सभी व्यंजन' : 'All' };
    const customPills = uniqueCats.map((cat) => {
      let label = cat;
      if (language === 'hi') {
        if (cat === 'Signatures') label = 'शेफ स्पेशल';
        else if (cat === 'Mains & Sides') label = 'मुख्य भोजन व स्नैक्स';
        else if (cat === 'Beverages') label = 'पेय पदार्थ';
        else if (cat === 'Desserts') label = 'मिठाइयां';
        else if (cat === 'Tandoor & Starters') label = 'तंदूर व स्टार्टर्स';
        else if (cat === 'Biryani & Rice') label = 'बिरयानी व चावल';
        else if (cat === 'Curries & Mains') label = 'करी व मुख्य भोजन';
        else if (cat === 'Breads') label = 'रोटी व नान';
        else if (cat === 'Specialty Teas') label = 'स्पेशल चाय';
        else if (cat === 'Bakery & Bites') label = 'बेकरी व स्नैक्स';
        else if (cat === 'Cold Brews') label = 'कोल्ड ब्रू';
      }
      return { id: cat, label };
    });
    return [allPill, ...customPills];
  }, [menu, language]);

  // Derive active category safely ensuring it exists in current menu
  const effectiveCategory = categoryKeys.some((c) => c.id === selectedCategory) ? selectedCategory : 'All';

  // Filter menu
  const safeMenu = Array.isArray(menu) ? menu : [];
  const filteredMenu = safeMenu.filter((item) => {
    const matchesCat = effectiveCategory === 'All' || item.category === effectiveCategory;
    const matchesVeg = !vegOnly || item.isVeg;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.bullets && item.bullets.some((b) => b.toLowerCase().includes(searchQuery.toLowerCase()))) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCat && matchesVeg && matchesSearch;
  });

  // Calculate cart subtotal (GST is included in dish prices by restaurant owner)
  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = 0; // GST billing removed - included directly in dish prices
  const isPromoEligible = Boolean(appliedPromo && (!appliedPromo.minOrderAmount || cartSubtotal >= Number(appliedPromo.minOrderAmount)));
  const activePromo = isPromoEligible ? appliedPromo : null;
  const discountAmount = activePromo
    ? activePromo.type === 'percent'
      ? Number(
          Math.min(
            activePromo.maxDiscount || Infinity,
            (cartSubtotal * Number(activePromo.value)) / 100
          ).toFixed(2)
        )
      : Number(Math.min(Number(appliedPromo.value), cartSubtotal).toFixed(2))
    : 0;
  const cartTotal = Math.max(0, Number((cartSubtotal - discountAmount).toFixed(2)));
  const totalItemCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // Suggestable item for upsell (FR-C8)
  const upsellPairingId = theme?.upsellPairingId;
  const suggestableItem = useMemo(() => {
    // If explicitly set to none, empty, null, 0, or false -> show NOTHING on the upsell column
    if (
      upsellPairingId === 'none' ||
      upsellPairingId === null ||
      upsellPairingId === 0 ||
      upsellPairingId === '' ||
      upsellPairingId === false
    ) {
      return null;
    }
    // If a specific pairing dish ID is configured, find that dish
    let candidate = null;
    if (upsellPairingId !== undefined) {
      candidate = safeMenu.find((item) => String(item.id) === String(upsellPairingId)) || null;
    } else {
      // If no preference configured at all, check if dish id 3 exists; otherwise return null
      candidate = safeMenu.find((item) => item.id === 3) || null;
    }
    // Do not suggest dishes that are marked Out of Stock!
    if (candidate && candidate.isAvailable === false) {
      return null;
    }
    return candidate;
  }, [upsellPairingId, safeMenu]);

  // Find all orders placed by this diner session on this table:
  // All ordered tickets are retained in the live status stack strictly for this session
  // and are completely wiped when the tab is closed, when the QR is scanned again, or after 2 hours of inactivity!
  const customerOrders = useMemo(() => {
    if (!placedOrderIds || placedOrderIds.length === 0) {
      return [];
    }
    const matched = (orders || []).filter((o) => o && placedOrderIds.includes(o.id));
    return matched.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders, placedOrderIds]);

  // Keep single activeCustomerOrder reference for backward compatibility
  const activeCustomerOrder = customerOrders[0] || null;

  // Sound and visual feedback when live status updates in real time for ANY ticket in customer stack
  const prevStatusesRef = useRef({});
  useEffect(() => {
    customerOrders.forEach((order) => {
      const prevStatus = prevStatusesRef.current[order.id];
      if (prevStatus && prevStatus !== order.status) {
        if (order.status === 'cooking' || order.status === 'in-progress') {
          playAlertChime();
        } else if (order.status === 'ready' || order.status === 'served' || order.status === 'done') {
          playSuccessChime();
        } else if (order.status === 'rejected') {
          playAlertChime();
        }
      }
      prevStatusesRef.current[order.id] = order.status;
    });
  }, [customerOrders]);

  const handleReorderItems = (orderToReorder) => {
    playTapSound();
    const targetOrder = orderToReorder || activeCustomerOrder;
    if (targetOrder?.items && targetOrder.items.length > 0) {
      setCart([...targetOrder.items]);
      if (setActiveTab) setActiveTab('cart');
    } else {
      if (setActiveTab) setActiveTab('menu');
    }
  };

  const handleDismissOrder = (orderIdToDismiss) => {
    playTapSound();
    if (orderIdToDismiss) {
      setPlacedOrderIds((prev) => {
        const next = prev.filter((id) => id !== orderIdToDismiss);
        if (typeof window !== 'undefined') {
          if (next.length > 0) {
            sessionStorage.setItem(dinerOrderIdsKey, JSON.stringify(next));
            sessionStorage.setItem(dinerLegacyOrderKey, next[0]);
          } else {
            sessionStorage.removeItem(dinerOrderIdsKey);
            sessionStorage.removeItem(dinerLegacyOrderKey);
            sessionStorage.removeItem('ontap_customer_last_order_id');
          }
          try {
            localStorage.removeItem(dinerOrderIdsKey);
            localStorage.removeItem(dinerLegacyOrderKey);
          } catch (e) {}
        }
        return next;
      });
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(dinerOrderIdsKey);
        sessionStorage.removeItem(dinerLegacyOrderKey);
        sessionStorage.removeItem('ontap_customer_last_order_id');
        try {
          localStorage.removeItem(dinerOrderIdsKey);
          localStorage.removeItem(dinerLegacyOrderKey);
        } catch (e) {}
      }
      setPlacedOrderIds([]);
      if (setActiveTab) setActiveTab('menu');
    }
  };

  const handleDecreaseItemQty = (itemId) => {
    playTapSound();
    setCart((prevCart) => {
      const index = prevCart.findIndex((ci) => ci.id === itemId);
      if (index === -1) return prevCart;
      const updated = [...prevCart];
      const currentItem = updated[index];
      if (currentItem.quantity <= 1) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...currentItem, quantity: currentItem.quantity - 1 };
      }
      return updated;
    });
  };

  const handleSaveDinerName = (e) => {
    if (e) e.preventDefault();
    const cleanName = customerNameInput.trim() || `${activeTable} Guest`;

    setCustomerName(cleanName);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(dinerNameKey, cleanName);
      sessionStorage.setItem('ontap_diner_name', cleanName);
      if (customerPhoneInput.trim()) {
        sessionStorage.setItem(dinerPhoneKey, customerPhoneInput.trim());
        sessionStorage.setItem('ontap_diner_phone', customerPhoneInput.trim());
      }
      try {
        localStorage.removeItem(dinerNameKey);
        localStorage.removeItem(`flowscape_diner_name_${activeBusinessId}`);
        localStorage.removeItem('flowscape_diner_name');
      } catch (err) {}
    }
    setCustomerPhone(customerPhoneInput.trim());
    setShowNameModal(false);
    setNameError('');
    playSuccessChime();
  };

  const handleAddToCart = (item, note = '') => {
    if (item.isAvailable === false) {
      playAlertChime();
      alert(language === 'hi' ? 'यह व्यंजन इस समय समाप्त (Out of Stock) है।' : 'Sorry, this dish is currently out of stock.');
      return;
    }
    playTapSound();
    setCart((prevCart) => {
      const existing = prevCart.find((ci) => ci.id === item.id && ci.note === note);
      if (existing) {
        return prevCart.map((ci) =>
          ci.id === item.id && ci.note === note ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prevCart, { ...item, quantity: 1, note }];
    });
  };

  const handleUpdateQuantity = (cartItemIndex, delta) => {
    playTapSound();
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[cartItemIndex];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        updated.splice(cartItemIndex, 1);
      } else {
        updated[cartItemIndex] = { ...item, quantity: newQty };
      }
      return updated;
    });
  };

  // Helper to check if a coupon has expired
  const isOfferExpired = (offer) => {
    if (!offer || !offer.expiryDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return offer.expiryDate < today;
  };

  const handleApplyPromo = (codeToApply) => {
    playTapSound();
    const raw = codeToApply || promoInput;
    if (!raw || !raw.trim()) {
      setPromoMessage(language === 'hi' ? 'कृपया कूपन कोड दर्ज करें।' : 'Please enter a coupon code.');
      playAlertChime();
      return;
    }

    const cleanCode = raw.trim().toUpperCase();
    const found = (offers || []).find((o) => o.code && o.code.trim().toUpperCase() === cleanCode);

    if (!found) {
      setAppliedPromo(null);
      setPromoMessage(
        language === 'hi'
          ? `अमान्य कूपन कोड "${cleanCode}"`
          : `Coupon "${cleanCode}" does not exist.`
      );
      playAlertChime();
      return;
    }

    if (!found.isActive) {
      setAppliedPromo(null);
      setPromoMessage(
        language === 'hi'
          ? `कूपन "${cleanCode}" वर्तमान में निष्क्रिय है`
          : `Coupon "${cleanCode}" is currently disabled.`
      );
      playAlertChime();
      return;
    }

    if (isOfferExpired(found)) {
      setAppliedPromo(null);
      setPromoMessage(
        language === 'hi'
          ? `यह कूपन ${found.expiryDate} को समाप्त हो चुका है`
          : `This coupon expired on ${found.expiryDate}.`
      );
      playAlertChime();
      return;
    }

    if (found.minOrderAmount && cartSubtotal < Number(found.minOrderAmount)) {
      setAppliedPromo(null);
      setPromoMessage(
        language === 'hi'
          ? `न्यूनतम ऑर्डर मूल्य ₹${found.minOrderAmount} आवश्यक है (वर्तमान ट्रे: ₹${cartSubtotal.toFixed(0)})`
          : `Minimum order of ₹${found.minOrderAmount} required (Current tray: ₹${cartSubtotal.toFixed(0)}).`
      );
      playAlertChime();
      return;
    }

    setAppliedPromo(found);
    setPromoInput(found.code);
    const discPreview =
      found.type === 'percent'
        ? `${found.value}% Off (Save ₹${((cartSubtotal * found.value) / 100).toFixed(0)})`
        : `Flat ₹${found.value} Off`;
    setPromoMessage(
      language === 'hi'
        ? `✓ लागू हुआ: ${found.code} (${discPreview})`
        : `✓ Applied: ${found.code} (${discPreview})`
    );
    playSuccessChime();
  };

  const handleRemovePromo = () => {
    playTapSound();
    setAppliedPromo(null);
    setPromoInput('');
    setPromoMessage(language === 'hi' ? 'कूपन हटा दिया गया' : 'Coupon removed.');
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (isCurrentBizSuspended) {
      alert(language === 'hi'
        ? 'ऑर्डर स्वीकार नहीं किए जा रहे हैं: यह प्रतिष्ठान वर्तमान में निलंबित है। कृपया काउंटर स्टाफ से संपर्क करें।'
        : 'Ordering is temporarily paused for this establishment. Please place orders directly with counter staff.'
      );
      return;
    }

    if (paymentMode === 'upi') {
      setShowUpiModal(true);
      return;
    }

    completeOrderPlacement('Pay at Counter (Pending)');
  };

  const completeOrderPlacement = (finalPaymentStatus) => {
    const finalCustomerName = (customerName || '').trim() || `${activeTable} Guest`;
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const newOrderId = `ORD-${Date.now().toString(36).toUpperCase()}-${orderNum}`;
    const newOrder = {
      id: newOrderId,
      orderNumber: orderNum,
      businessId: activeBusinessId,
      customerName: finalCustomerName,
      table: activeTable,
      phone: customerPhone.trim() || 'Walk-in',
      createdAt: new Date().toISOString(),
      status: 'received',
      statusLabel: 'Received by Kitchen',
      items: [...cart],
      orderNote: orderNote.trim(),
      paymentMode: paymentMode === 'upi' ? 'UPI Instant QR' : 'Pay at Counter',
      paymentStatus: finalPaymentStatus,
      subtotal: cartSubtotal,
      tax: tax,
      discount: discountAmount,
      appliedPromoCode: appliedPromo ? appliedPromo.code : null,
      total: cartTotal,
      progressPercent: 20
    };

    // 1. Local state update
    onPlaceOrder(newOrder);

    // Save this diner's placed tickets strictly to sessionStorage (retained across refreshes, cleared when tab is closed)
    if (typeof window !== 'undefined') {
      try {
        const existingRaw = sessionStorage.getItem(dinerOrderIdsKey);
        const existingList = existingRaw ? JSON.parse(existingRaw) : [];
        const nextList = [newOrderId, ...(Array.isArray(existingList) ? existingList.filter((id) => id !== newOrderId) : [])];
        sessionStorage.setItem(dinerOrderIdsKey, JSON.stringify(nextList));
        sessionStorage.setItem(dinerLegacyOrderKey, newOrderId);
        sessionStorage.setItem('ontap_customer_last_order_id', newOrderId);
        // Ensure legacy localStorage doesn't bleed across browser tabs
        try {
          localStorage.removeItem(dinerOrderIdsKey);
          localStorage.removeItem(dinerLegacyOrderKey);
        } catch (e) {}
      } catch (e) {
        // ignore
      }
    }
    setPlacedOrderIds((prev) => [newOrderId, ...prev.filter((id) => id !== newOrderId)]);

    // 2. Broadcast cross-tab instant sync to Counter POS & Admin!
    broadcastSyncEvent(SYNC_EVENTS.NEW_ORDER, newOrder, activeBusinessId);

    setCart([]);
    setAppliedPromo(null);
    setPromoInput('');
    setPromoMessage('');
    setIsCartOpen(false);
    setShowUpiModal(false);
    playSuccessChime();

    // Notify customer to keep an eye on live order status (shows strictly once per customer dining session)
    let hasSeenTip = false;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        hasSeenTip = sessionStorage.getItem('ontap_order_status_tip_seen') === 'true';
      }
    } catch (e) {}

    if (!hasSeenTip) {
      setShowOrderStatusTipModal(true);
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          sessionStorage.setItem('ontap_order_status_tip_seen', 'true');
        }
      } catch (e) {}
    }

    if (setActiveTab) {
      setActiveTab('track');
    }
  };

  // Call Server action
  const handleCallServer = () => {
    playTapSound();
    broadcastSyncEvent(SYNC_EVENTS.CALL_SERVER, {
      businessId: activeBusinessId,
      table: activeTable,
      customerName: customerName || 'Guest Diner',
      timestamp: new Date().toLocaleTimeString()
    }, activeBusinessId);
    setServerCalledAlert(true);
    playSuccessChime();
    setTimeout(() => setServerCalledAlert(false), 5000);
  };

  // Dynamic UPI Deep Link URL for native mobile apps (GPay, PhonePe, Paytm, CRED)
  const upiVpa = theme?.upiId || '9119069179@nyes';
  const payeeRestaurantName = theme?.restaurantName || 'Restaurant';
  const upiPayUrl = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(payeeRestaurantName)}&am=${cartTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${activeTable || 'Dine-In'} Order`)}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayUrl)}`;

  // Generate crisp local in-browser QR code (instant rendering, zero third-party latency or downtime)
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(upiPayUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF'
      }
    }).then((url) => {
      if (isMounted) setLocalQrDataUrl(url);
    }).catch((err) => {
      console.warn('Local QR generation fallback to web URL', err);
    });
    return () => { isMounted = false; };
  }, [upiPayUrl]);

  const handleCopyUpi = () => {
    playTapSound();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(upiVpa).then(() => {
        setCopiedUpi(true);
        playSuccessChime();
        setTimeout(() => setCopiedUpi(false), 2500);
      }).catch(() => {
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2500);
      });
    } else {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  // Session Notice Banner (Alerts diner if session was wiped due to inactivity or fresh QR re-scan)
  const renderSessionNotice = () => {
    if (!sessionNotice) return null;
    const isWarning = sessionNotice.type === 'warning';
    return (
      <div
        style={{
          marginBottom: 14,
          padding: '12px 16px',
          borderRadius: 16,
          background: isWarning
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.12))'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(16, 185, 129, 0.12))',
          border: isWarning ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: isWarning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: isWarning ? '#ef4444' : '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isWarning ? <AlertTriangle size={18} /> : <RotateCcw size={18} />}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.4 }}>
            {sessionNotice.text}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSessionNotice(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
          }}
          aria-label="Dismiss notice"
        >
          <X size={16} />
        </button>
      </div>
    );
  };

  // Diner Name Pop-up Modal Component (Customer table ordering only)
  const renderNameModal = () => {
    return (
      <SlideModal
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
        maxWidth={400}
        ariaLabel="Diner Welcome & Name"
        contentStyle={{ padding: '24px 20px' }}
      >
        {({ dismiss }) => (
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Dismiss button */}
            <button
              type="button"
              onClick={() => {
                playTapSound();
                dismiss();
              }}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: '#F3F4F6',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6B7280'
            }}
            aria-label="Close"
          >
            <X size={15} />
          </button>

          {/* Modal Header */}
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: theme?.logo ? '#FFFFFF' : 'linear-gradient(135deg, #007AFF 0%, #0056B3 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: '0 6px 14px rgba(0, 122, 255, 0.2)',
                border: theme?.logo ? '2px solid #E2E8F0' : 'none',
                overflow: 'hidden',
                padding: theme?.logo ? 4 : 0
              }}
            >
              {theme?.logo ? (
                <img
                  src={theme.logo}
                  alt={theme.restaurantName}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Utensils size={24} />
              )}
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                padding: '3px 10px',
                borderRadius: 20,
                marginBottom: 8
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>{activeTable}</span>
              <span style={{ fontSize: 11, color: '#93C5FD' }}>•</span>
              <span style={{ fontSize: 11, color: '#1E40AF' }}>{theme.restaurantName || 'Artisanal Kitchen'}</span>
            </div>

            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#111827', margin: 0, letterSpacing: -0.5 }}>
              {language === 'hi' ? 'स्वागत है! नाम दर्ज करें (वैकल्पिक)' : 'Welcome! Enter Name (Optional)'}
            </h2>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 0 }}>
              {language === 'hi'
                ? 'टेबल ऑर्डर के लिए नाम दर्ज करें अथवा सीधे अतिथि के रूप में जारी रखें।'
                : 'Enter your name (optional) or continue directly as Guest Diner.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveDinerName}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                {language === 'hi' ? 'आपका नाम (वैकल्पिक)' : 'Your Name (Optional)'}
              </label>
              <input
                type="text"
                autoFocus
                className="ios-input"
                style={{
                  fontSize: 15,
                  padding: '12px 14px',
                  borderColor: nameError ? '#EF4444' : '#D1D5DB'
                }}
                placeholder={language === 'hi' ? 'उदा. आरव शर्मा (वैकल्पिक)' : 'e.g. Aarav Sharma (Optional)'}
                value={customerNameInput}
                onChange={(e) => {
                  setCustomerNameInput(e.target.value);
                  if (nameError) setNameError('');
                }}
              />
              {nameError && (
                <div style={{ fontSize: 11, color: '#DC2626', fontWeight: 600, marginTop: 4 }}>
                  {nameError}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>
                {language === 'hi' ? 'मोबाइल नंबर (वैकल्पिक - बिल रसीद हेतु)' : 'Phone Number (Optional - for digital bill)'}
              </label>
              <input
                type="tel"
                className="ios-input"
                data-mask="true"
                data-private="true"
                data-sl="mask"
                style={{ fontSize: 14, padding: '10px 14px' }}
                placeholder="+91 98765 43210"
                value={customerPhoneInput}
                onChange={(e) => setCustomerPhoneInput(e.target.value)}
              />
            </div>

            {/* Unbundled Marketing Opt-in Checkbox (Unticked by default - GDPR & DPDP § 6) */}
            <div style={{ marginBottom: 14, padding: '8px 10px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: '#475569', cursor: 'pointer', lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#007AFF', width: 15, height: 15 }}
                />
                <span>
                  {language === 'hi'
                    ? '(वैकल्पिक) मुझे शेफ के विशेष ऑफर्स व डाइनिंग छूट की सूचनाएं एसएमएस/व्हाट्सएप पर भेजें।'
                    : '(Optional) Send me announcements regarding seasonal chef specials and dining rewards.'}
                </span>
              </label>
            </div>

            {/* COPPA / Minor Protection Notice */}
            <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 14, lineHeight: 1.4, textAlign: 'center' }}>
              Intended for diners 13+. Diners under 18 must order under adult supervision.
              By proceeding, you agree to our{' '}
              <button
                type="button"
                onClick={() => {
                  setShowNameModal(false);
                  setLegalInitialTab('terms');
                  setShowLegalModal(true);
                }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', fontSize: 10.5, fontWeight: 600 }}
              >
                Terms
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => {
                  setShowNameModal(false);
                  setLegalInitialTab('privacy');
                  setShowLegalModal(true);
                }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', fontSize: 10.5, fontWeight: 600 }}
              >
                Privacy Policy
              </button>.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="submit"
                className="btn-primary-pill full-width"
                style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700 }}
              >
                <span>{language === 'hi' ? 'नाम सहेजें व आगे बढ़ें' : 'Save Name & Continue'}</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-secondary-pill full-width"
                style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D5DB', background: '#F9FAFB' }}
                onClick={() => {
                  playTapSound();
                  setCustomerName(`${activeTable} Guest`);
                  dismiss();
                }}
              >
                <span>{language === 'hi' ? 'अतिथि के रूप में जारी रखें' : 'Continue as Guest Diner'}</span>
              </button>
            </div>
          </form>
        </div>
        )}
      </SlideModal>
    );
  };

  // First-time Order Status Reminder Popup (Shows once per customer)
  const renderOrderStatusTipModal = () => {
    if (!showOrderStatusTipModal) return null;
    return (
      <div
        className="modal-overlay"
        style={{ zIndex: 9999 }}
        onClick={() => {
          playTapSound();
          setShowOrderStatusTipModal(false);
        }}
      >
        <div
          className="modal-content-sheet"
          style={{ maxWidth: 380, textAlign: 'center', padding: '28px 22px 24px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-drag-pill" />

          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: '#EFF6FF',
              border: '2px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#2563EB'
            }}
          >
            <Bell size={28} />
          </div>

          <div className="card-heading" style={{ fontSize: 18, marginBottom: 8 }}>
            {language === 'hi' ? 'ऑर्डर दर्ज हो गया है!' : 'Order Placed!'}
          </div>

          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.55,
              color: 'var(--text-secondary, #475569)',
              marginBottom: 22
            }}
          >
            {language === 'hi'
              ? 'कृपया अपने ऑर्डर की स्थिति पर नज़र रखें ताकि भोजन तैयार होते ही आपको तुरंत सूचित किया जा सके।'
              : 'Please keep an eye on your live order status here to get notified as soon as your order is ready!'}
          </div>

          <button
            type="button"
            className="btn-primary-pill full-width"
            style={{ padding: '12px 20px', fontSize: 14, fontWeight: 700 }}
            onClick={() => {
              playTapSound();
              setShowOrderStatusTipModal(false);
            }}
          >
            <span>{language === 'hi' ? 'ठीक है (OK)' : 'OK'}</span>
          </button>
        </div>
      </div>
    );
  };

  // VIEW 1: LIVE ORDER TRACKING TAB (FR-C6)
  if (activeTab === 'track') {
    // Final Bill Calculations:
    // Added amount of all tickets minus rejected orders minus already paid by UPI
    const grossTotal = customerOrders.reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
    const rejectedTotal = customerOrders
      .filter((ord) => ord.status === 'rejected')
      .reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
    const acceptedTotal = Math.max(0, grossTotal - rejectedTotal);
    const upiPaidTotal = customerOrders
      .filter((ord) => {
        if (ord.status === 'rejected') return false;
        return (
          ord.paymentMode === 'UPI Instant QR' ||
          (ord.paymentStatus && ord.paymentStatus.toLowerCase().includes('upi') && ord.paymentStatus.toLowerCase().includes('paid')) ||
          (ord.paymentMode && ord.paymentMode.toLowerCase().includes('upi') && !ord.paymentStatus?.toLowerCase().includes('pending'))
        );
      })
      .reduce((sum, ord) => sum + (Number(ord.total) || 0), 0);
    const finalBillDue = Math.max(0, acceptedTotal - upiPaidTotal);

    const totalDishesCount = customerOrders
      .filter((ord) => ord.status !== 'rejected')
      .reduce((sum, ord) => sum + (ord.items || []).reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    const activeTicketsCount = customerOrders.filter(
      (o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected'
    ).length;

    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 110 }}>
        {renderNameModal()}
        {renderOrderStatusTipModal()}
        {renderSessionNotice()}

        {/* Screen Title & Live Pulse Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="screen-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{t('liveOrderTracking')}</span>
              {customerOrders.length > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: activeTicketsCount > 0 ? '#1D4ED8' : '#15803D',
                    background: activeTicketsCount > 0 ? '#EFF6FF' : '#DCFCE7',
                    border: activeTicketsCount > 0 ? '1px solid #BFDBFE' : '1px solid #86EFAC',
                    borderRadius: 20,
                    padding: '3px 9px',
                    letterSpacing: '0.02em'
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: activeTicketsCount > 0 ? '#2563EB' : '#16A34A',
                      boxShadow: activeTicketsCount > 0 ? '0 0 0 2px rgba(37, 99, 235, 0.25)' : 'none'
                    }}
                  />
                  {customerOrders.length > 1
                    ? `${customerOrders.length} Tickets Ordered`
                    : '1 Ticket Ordered'}
                </span>
              )}
            </div>
            <div className="screen-subtitle" style={{ marginTop: 3 }}>
              {(() => {
                const isStall = (activeTable || '').toLowerCase().includes('stand') ||
                                (activeTable || '').toLowerCase().includes('stall') ||
                                theme?.serviceType === 'stall';
                if (isStall) {
                  return language === 'hi'
                    ? `काउंटर ऑर्डर की लाइव स्थिति (${customerOrders.length} टिकट)`
                    : `Real-time kitchen ticket progress for your counter order (${customerOrders.length} ticket${customerOrders.length > 1 ? 's' : ''})`;
                }
                return language === 'hi'
                  ? `${activeTable} के लिए लाइव रसोई प्रगति (${customerOrders.length} टिकट)`
                  : `Real-time kitchen ticket progress for ${activeTable} (${customerOrders.length} ticket${customerOrders.length > 1 ? 's' : ''})`;
              })()}
            </div>
          </div>

          {/* Quick "+ Add More Dishes" CTA button in header */}
          {customerOrders.length > 0 && (
            <button
              className="btn-primary-pill"
              style={{
                padding: '7px 12px',
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)',
                flexShrink: 0
              }}
              onClick={() => {
                playTapSound();
                if (setActiveTab) setActiveTab('menu');
              }}
            >
              <Plus size={14} />
              <span>{language === 'hi' ? 'और व्यंजन जोड़ें' : 'Add Dishes'}</span>
            </button>
          )}
        </div>

        {serverCalledAlert && (
          <div
            style={{
              background: '#DCFCE7',
              border: '1px solid #86EFAC',
              borderRadius: 14,
              padding: '12px 14px',
              color: '#15803D',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14
            }}
          >
            <CheckCircle2 size={16} />
            <span>{t('serverCalled')}</span>
          </div>
        )}

        {/* Live Status Stack */}
        {customerOrders && customerOrders.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {customerOrders.map((order, orderIdx) => {
              const ticketNum = customerOrders.length - orderIdx;
              const isLatestAddition = orderIdx === 0 && customerOrders.length > 1;
              const isStallOrder = (order.table || '').toLowerCase().includes('stand') ||
                                   (order.table || '').toLowerCase().includes('stall') ||
                                   (order.table || '').toLowerCase().includes('counter') ||
                                   (order.table || '').toLowerCase().includes('takeaway') ||
                                   theme?.serviceType === 'stall';
              const orderNumBadge = order.orderNumber || (order.id && order.id.replace(/\D/g, '').slice(-4)) || '---';

              return (
                <div
                  key={order.id}
                  className={`ios-card ${order.status === 'rejected' ? '' : 'active-gradient'}`}
                  style={{
                    padding: '16px',
                    border: order.status === 'rejected'
                      ? '1.5px solid #FCA5A5'
                      : isLatestAddition
                      ? '1.5px solid #60A5FA'
                      : undefined,
                    background: order.status === 'rejected' ? '#FFF5F5' : undefined,
                    position: 'relative',
                    boxShadow: isLatestAddition ? '0 4px 16px rgba(37, 99, 235, 0.12)' : undefined
                  }}
                >
                  {/* Header row: Ticket badge, Order #, Table, Diner, Status & Total */}
                  <div className="card-top-row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {customerOrders.length > 1 && (
                          <span
                            style={{
                              background: isLatestAddition
                                ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                                : '#4B5563',
                              color: '#FFFFFF',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6,
                              letterSpacing: '0.04em',
                              boxShadow: isLatestAddition ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none'
                            }}
                          >
                            {isLatestAddition
                              ? (language === 'hi' ? `टिकट #${ticketNum} (नवीनतम)` : `Ticket #${ticketNum} (Latest)`)
                              : (language === 'hi' ? `टिकट #${ticketNum}` : `Ticket #${ticketNum}`)}
                          </span>
                        )}

                        <span
                          style={{
                            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 6,
                            letterSpacing: '0.04em',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                          }}
                        >
                          Order #{orderNumBadge}
                        </span>

                        <span className="status-pill tag" style={{ fontSize: 11 }}>{order.table}</span>
                      </div>

                      <div className="card-meta-text" style={{ marginTop: 4 }}>
                        {order.customerName && <span>Diner: <strong>{order.customerName}</strong> • </span>}
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        className="status-pill"
                        style={{
                          fontSize: 12,
                          padding: '4px 12px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background:
                            order.status === 'received'
                              ? '#EFF6FF'
                              : (order.status === 'cooking' || order.status === 'in-progress')
                              ? '#FFFBEB'
                              : order.status === 'ready'
                              ? '#FEF08A'
                              : (order.status === 'served' || order.status === 'done')
                              ? '#DCFCE7'
                              : '#FEE2E2',
                          color:
                            order.status === 'received'
                              ? '#1D4ED8'
                              : (order.status === 'cooking' || order.status === 'in-progress')
                              ? '#B45309'
                              : order.status === 'ready'
                              ? '#A16207'
                              : (order.status === 'served' || order.status === 'done')
                              ? '#15803D'
                              : '#DC2626',
                          border:
                            order.status === 'received'
                              ? '1.5px solid #60A5FA'
                              : (order.status === 'cooking' || order.status === 'in-progress')
                              ? '1.5px solid #F59E0B'
                              : order.status === 'ready'
                              ? '1.5px solid #EAB308'
                              : (order.status === 'served' || order.status === 'done')
                              ? '1.5px solid #16A34A'
                              : '1.5px solid #EF4444'
                        }}
                      >
                        {(order.status === 'cooking' || order.status === 'in-progress') && (
                          <img
                            src={cookingAnimationGif}
                            alt=""
                            style={{ width: 16, height: 16, objectFit: 'contain', display: 'inline-block' }}
                            onError={(e) => {
                              e.currentTarget.src = '/output-onlinegiftools.gif';
                            }}
                          />
                        )}
                        {order.status === 'received'
                          ? (language === 'hi' ? 'प्राप्त (Received)' : 'Received')
                          : (order.status === 'cooking' || order.status === 'in-progress')
                          ? (language === 'hi' ? 'पक रहा है (Cooking)' : 'Cooking')
                          : order.status === 'ready'
                          ? (language === 'hi' ? 'तैयार (Ready)' : 'Ready')
                          : (order.status === 'served' || order.status === 'done')
                          ? (language === 'hi' ? 'परोसा गया (Served)' : 'Served')
                          : (language === 'hi' ? 'ऑर्डर अस्वीकृत (Rejected)' : 'Order Rejected')}
                      </span>

                      {order.status === 'rejected' ? (
                        <div style={{ textAlign: 'right', marginTop: 4 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', textDecoration: 'line-through' }}>
                            ₹{(Number(order.total) || 0).toFixed(0)}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626' }}>
                            {language === 'hi' ? 'अस्वीकृत (हटाया गया)' : 'Excluded (-₹0)'}
                          </div>
                        </div>
                      ) : (order.paymentMode === 'UPI Instant QR' || (order.paymentStatus && order.paymentStatus.toLowerCase().includes('upi') && order.paymentStatus.toLowerCase().includes('paid')) || (order.paymentMode && order.paymentMode.toLowerCase().includes('upi') && !order.paymentStatus?.toLowerCase().includes('pending'))) ? (
                        <div style={{ textAlign: 'right', marginTop: 4 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#15803D' }}>
                            ₹{(Number(order.total) || 0).toFixed(0)}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D' }}>
                            {language === 'hi' ? 'UPI भुगतान पूर्ण ✓' : 'Paid by UPI ✓'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right', marginTop: 4 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-blue)' }}>
                            ₹{(Number(order.total) || 0).toFixed(0)}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                            {language === 'hi' ? 'काउंटर पर देय' : 'Pay at Counter'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* If Ticket is Rejected: Display prominent Rejection Details Card */}
                  {order.status === 'rejected' ? (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                        border: '1.5px solid #F87171',
                        borderRadius: 16,
                        padding: '16px 18px',
                        margin: '16px 0 16px',
                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: '#FFFFFF',
                            border: '2px solid #EF4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#DC2626',
                            flexShrink: 0,
                            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.15)'
                          }}
                        >
                          <XCircle size={24} color="#DC2626" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>
                            {language === 'hi' ? 'ऑर्डर अस्वीकृत (Order Rejected)' : 'Order Not Accepted by Kitchen'}
                          </div>
                          <div
                            style={{
                              background: '#FFFFFF',
                              border: '1.5px solid #FCA5A5',
                              borderRadius: 10,
                              padding: '10px 12px',
                              marginBottom: 10
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#991B1B',
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                marginBottom: 3
                              }}
                            >
                              {language === 'hi' ? 'अस्वीकृति का कारण:' : 'Reason for rejection:'}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#B91C1C' }}>
                              {order.rejectReason ||
                                (order.statusLabel
                                  ? order.statusLabel.replace(/^Rejected:\s*/i, '')
                                  : (language === 'hi' ? 'रसोई इस समय ऑर्डर स्वीकार नहीं कर सकी' : 'Kitchen unable to fulfill ticket'))}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45, marginBottom: 12 }}>
                            {language === 'hi'
                              ? 'कृपया दिए गए कारण की समीक्षा करें। आप अपने व्यंजन बदलकर दोबारा ऑर्डर कर सकते हैं।'
                              : 'Please review the reason above. You can easily adjust items in your cart to order again.'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              className="btn-primary-pill"
                              style={{ padding: '7px 12px', fontSize: 12 }}
                              onClick={() => handleReorderItems(order)}
                            >
                              <RotateCcw size={13} />
                              <span>{language === 'hi' ? 'व्यंजन बदलें व दोबारा ऑर्डर' : 'Modify & Re-order'}</span>
                            </button>
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#991B1B',
                                fontSize: 12,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                padding: '4px 8px'
                              }}
                              onClick={() => handleDismissOrder(order.id)}
                            >
                              {language === 'hi' ? 'यह टिकट हटाएं' : 'Dismiss ticket'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 4-Step Status Progress Tracker: Received -> Cooking -> Ready -> Served */}
                      <div style={{ margin: '18px 0 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 8 }}>
                          {/* Connecting track line */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 12,
                              left: 20,
                              right: 20,
                              height: 3,
                              background: '#E5E7EB',
                              zIndex: 1
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                background:
                                  (order.status === 'served' || order.status === 'done')
                                    ? '#10B981'
                                    : '#007AFF',
                                width:
                                  order.status === 'received'
                                    ? '12%'
                                    : (order.status === 'cooking' || order.status === 'in-progress')
                                    ? '42%'
                                    : order.status === 'ready'
                                    ? '75%'
                                    : '100%',
                                transition: 'width 0.4s ease'
                              }}
                            />
                          </div>

                          {[
                            { step: 'received', label: language === 'hi' ? 'प्राप्त' : 'Received' },
                            { step: 'cooking', label: language === 'hi' ? 'पक रहा है' : 'Cooking' },
                            { step: 'ready', label: language === 'hi' ? 'तैयार' : 'Ready' },
                            { step: 'served', label: language === 'hi' ? 'परोसा गया' : 'Served' }
                          ].map((s, idx) => {
                            const statusOrder = ['received', 'cooking', 'ready', 'served'];
                            const normalizedStatus =
                              order.status === 'in-progress'
                                ? 'cooking'
                                : order.status === 'done'
                                ? 'served'
                                : order.status;
                            const currentIndex = statusOrder.indexOf(normalizedStatus);
                            const isPassed = currentIndex >= idx;
                            const isCurrent = currentIndex === idx;

                            return (
                              <div
                                key={s.step}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  zIndex: 2,
                                  width: 70
                                }}
                              >
                                <div
                                  style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    background: isPassed ? '#007AFF' : '#FFFFFF',
                                    border: isPassed ? '2px solid #007AFF' : '2px solid #D1D5DB',
                                    color: isPassed ? '#FFFFFF' : '#9CA3AF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginBottom: 4,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    transform: isCurrent ? 'scale(1.18)' : 'none',
                                    transition: 'transform 0.2s ease'
                                  }}
                                >
                                  {isPassed ? '✓' : idx + 1}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: isPassed ? 700 : 500, color: isPassed ? 'var(--text-primary)' : '#9CA3AF' }}>
                                  {s.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Dynamic Real-Time Live Status Banner for this Ticket */}
                      {order.status === 'received' && (
                        <div
                          style={{
                            background: '#EFF6FF',
                            border: '1.5px solid #60A5FA',
                            borderRadius: 12,
                            padding: '10px 14px',
                            color: '#1E40AF',
                            fontSize: 12.5,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 12
                          }}
                        >
                          <Clock size={17} color="#2563EB" style={{ flexShrink: 0 }} />
                          <span>
                            {language === 'hi'
                              ? 'ऑर्डर रसोई में प्राप्त हुआ! काउंटर स्वीकार करते ही पकना शुरू होगा।'
                              : 'Order Received by Kitchen! Counter acceptance will transition this to Cooking.'}
                          </span>
                        </div>
                      )}

                      {(order.status === 'cooking' || order.status === 'in-progress') && (
                        <div
                          className="customer-cooking-card"
                          style={{
                            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                            border: '1.5px solid #F59E0B',
                            borderRadius: 16,
                            padding: '16px 14px',
                            color: '#92400E',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: 12,
                            marginBottom: 14,
                            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.16)',
                            animation: 'fadeIn 0.3s ease'
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              padding: '12px 18px',
                              background: '#FFFFFF',
                              borderRadius: 14,
                              boxShadow: '0 2px 10px rgba(217, 119, 6, 0.12)',
                              border: '1.5px solid rgba(245, 158, 11, 0.25)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              maxWidth: 240,
                              width: '100%'
                            }}
                          >
                            <img
                              src={cookingAnimationGif}
                              alt="Cooking in Kitchen"
                              style={{
                                width: 140,
                                height: 'auto',
                                maxHeight: 120,
                                objectFit: 'contain',
                                display: 'block'
                              }}
                              onError={(e) => {
                                e.currentTarget.src = '/output-onlinegiftools.gif';
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                              <Flame size={14} color="#D97706" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {language === 'hi' ? 'रसोई में सक्रिय' : 'Live in Kitchen'}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <Flame size={18} color="#D97706" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#B45309' }}>
                              {language === 'hi'
                                ? 'रसोई में व्यंजन पक रहे हैं!'
                                : 'Dishes are Cooking in Kitchen!'}
                            </span>
                          </div>

                          <span style={{ fontSize: 12, fontWeight: 500, color: '#92400E', maxWidth: 360, lineHeight: 1.45 }}>
                            {language === 'hi'
                              ? 'शेफ ब्रिगेड ताजगी से आपका ऑर्डर तैयार कर रही है। जैसे ही तैयार होगा आपको तुरंत सूचित किया जाएगा।'
                              : 'Executive chef brigade is actively preparing your order fresh. You will be alerted the moment it is ready!'}
                          </span>
                        </div>
                      )}

                      {order.status === 'ready' && (() => {
                        return (
                          <div
                            style={{
                              background: '#FEF08A',
                              border: '1.5px solid #EAB308',
                              borderRadius: 12,
                              padding: '12px 14px',
                              color: '#854D0E',
                              fontSize: 13,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              marginBottom: 12
                            }}
                          >
                            <Sparkles size={18} color="#CA8A04" style={{ flexShrink: 0 }} />
                            <span>
                              {isStallOrder ? (
                                language === 'hi'
                                  ? `ऑर्डर #${orderNumBadge} तैयार है! कृपया काउंटर से अपना ऑर्डर प्राप्त करें।`
                                  : `Order #${orderNumBadge} is Ready! Please collect your order from the counter.`
                              ) : (
                                language === 'hi'
                                  ? `टिकट #${ticketNum} के व्यंजन तैयार हैं! सर्विस टीम आपकी टेबल पर ला रही है।`
                                  : `Order #${orderNumBadge} is Ready! Plated hot and on the way to your table right now.`
                              )}
                            </span>
                          </div>
                        );
                      })()}

                      {(order.status === 'served' || order.status === 'done') && (
                        <div
                          style={{
                            background: '#ECFDF5',
                            border: '1.5px solid #10B981',
                            borderRadius: 12,
                            padding: '10px 14px',
                            color: '#065F46',
                            fontSize: 12.5,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 12
                          }}
                        >
                          <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
                          <span>
                            {language === 'hi'
                              ? `टिकट #${ticketNum} के व्यंजन आपकी टेबल पर परोस दिए गए हैं! स्वादिष्ट भोजन का आनंद लें।`
                              : `Ticket #${ticketNum} (Order #${orderNumBadge}) Served to your table! Enjoy your artisanal meal.`}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Ordered Items List for this specific ticket */}
                  <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '12px', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {language === 'hi' ? 'इस टिकट के व्यंजन:' : 'Items on this Ticket:'}
                    </div>
                    <ul className="body-subtask">
                      {(order.items || []).map((item, idx) => (
                        <li key={idx}>
                          <strong>{item.quantity}x</strong> {item.name}
                          {item.note && (
                            <span style={{ color: '#D97706', fontStyle: 'italic', marginLeft: 6 }}>
                              [{item.note}]
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {order.orderNote && (
                      <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic', marginTop: 6, borderTop: '1px dashed #E5E7EB', paddingTop: 6 }}>
                        📝 Note: "{order.orderNote}"
                      </div>
                    )}
                  </div>

                  {/* Payment badge row & ticket dismissal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="status-pill tag">{order.paymentMode}</span>
                      <span className="card-meta-text">{order.paymentStatus}</span>
                    </div>

                    {(order.status === 'served' || order.status === 'done') && (
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle2 size={13} color="#15803D" />
                        <span>{language === 'hi' ? 'परोस दिया गया' : 'Served to Table'}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Final Table Bill Summary Card */}
            {customerOrders.length > 0 && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: 16,
                  padding: '16px',
                  boxShadow: '0 4px 14px rgba(0, 122, 255, 0.08)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {language === 'hi' ? 'टेबल अंतिम बिल सारांश' : 'Final Table Bill Summary'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {customerOrders.length} {customerOrders.length > 1 ? 'tickets ordered' : 'ticket ordered'} • {totalDishesCount} dishes accepted
                    </div>
                  </div>
                  <span
                    style={{
                      background: finalBillDue === 0 && upiPaidTotal > 0 ? '#DCFCE7' : '#DBEAFE',
                      color: finalBillDue === 0 && upiPaidTotal > 0 ? '#15803D' : '#1E40AF',
                      border: finalBillDue === 0 && upiPaidTotal > 0 ? '1px solid #86EFAC' : '1px solid #BFDBFE',
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: 12
                    }}
                  >
                    {finalBillDue === 0 && upiPaidTotal > 0
                      ? (language === 'hi' ? 'पूर्ण भुगतान (UPI) ✓' : 'Fully Paid (UPI) ✓')
                      : (language === 'hi' ? 'काउंटर पर देय' : 'Pay at Counter')}
                  </span>
                </div>

                {/* Per-ticket breakdown */}
                {customerOrders.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {customerOrders.map((ord, idx) => {
                      const isRej = ord.status === 'rejected';
                      const isUpi = !isRej && (
                        ord.paymentMode === 'UPI Instant QR' ||
                        (ord.paymentStatus && ord.paymentStatus.toLowerCase().includes('upi') && ord.paymentStatus.toLowerCase().includes('paid')) ||
                        (ord.paymentMode && ord.paymentMode.toLowerCase().includes('upi') && !ord.paymentStatus?.toLowerCase().includes('pending'))
                      );

                      return (
                        <div
                          key={ord.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 12.5,
                            color: isRej ? '#9CA3AF' : 'var(--text-secondary)',
                            textDecoration: isRej ? 'line-through' : 'none',
                            padding: '3px 0'
                          }}
                        >
                          <div>
                            <span>Ticket #{customerOrders.length - idx} (Order #{ord.orderNumber || ord.id.replace(/\D/g, '').slice(-4)})</span>
                            <span
                              style={{
                                fontSize: 11,
                                marginLeft: 6,
                                fontWeight: 600,
                                color: isRej ? '#DC2626' : isUpi ? '#15803D' : ord.status === 'ready' ? '#A16207' : ord.status === 'cooking' ? '#B45309' : ord.status === 'served' ? '#15803D' : '#1D4ED8'
                              }}
                            >
                              • {isRej ? 'Rejected (Excluded)' : isUpi ? 'Paid via UPI ✓' : (ord.status === 'served' ? 'Served' : ord.status === 'ready' ? 'Ready' : ord.status === 'cooking' ? 'Cooking' : 'Received')}
                            </span>
                          </div>
                          <span style={{ fontWeight: 600, color: isRej ? '#9CA3AF' : 'var(--text-primary)' }}>
                            ₹{(Number(ord.total) || 0).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Mathematical Adjustments: Added Amount of all tickets, - Rejected, - Already Paid UPI */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {customerOrders.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      <span>{language === 'hi' ? 'सभी टिकटों का कुल योग:' : 'Added amount of all tickets:'}</span>
                      <span style={{ fontWeight: 600 }}>₹{grossTotal.toFixed(0)}</span>
                    </div>
                  )}

                  {rejectedTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#DC2626' }}>
                      <span>{language === 'hi' ? 'अस्वीकृत ऑर्डर (हटाया गया):' : 'Minus Rejected order(s):'}</span>
                      <span style={{ fontWeight: 700 }}>- ₹{rejectedTotal.toFixed(0)}</span>
                    </div>
                  )}

                  {upiPaidTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#15803D' }}>
                      <span>{language === 'hi' ? 'पहले से UPI द्वारा भुगतान किया गया:' : 'Minus Already paid by UPI:'}</span>
                      <span style={{ fontWeight: 700 }}>- ₹{upiPaidTotal.toFixed(0)}</span>
                    </div>
                  )}

                  {/* Final Bill Row */}
                  <div
                    style={{
                      borderTop: '1.5px dashed #93C5FD',
                      paddingTop: 10,
                      marginTop: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {language === 'hi' ? 'अंतिम बिल (देय राशि):' : 'Final Bill (Amount Due):'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {finalBillDue === 0 && upiPaidTotal > 0
                          ? (language === 'hi' ? 'सभी स्वीकृत टिकटों का भुगतान हो चुका है' : 'All accepted tickets cleared via UPI')
                          : (language === 'hi' ? 'काउंटर पर देय शेष राशि' : 'Net balance payable at counter')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: finalBillDue === 0 && upiPaidTotal > 0 ? '#15803D' : 'var(--primary-blue)'
                        }}
                      >
                        ₹{finalBillDue.toFixed(0)}
                      </span>
                      {finalBillDue === 0 && upiPaidTotal > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D' }}>✓ Paid in Full</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Global Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                className="btn-secondary-pill"
                style={{ padding: '10px 14px', fontSize: 12.5 }}
                onClick={handleCallServer}
              >
                <Bell size={14} color="#D97706" />
                <span>{t('callServer')}</span>
              </button>

              <button
                className="btn-primary-pill"
                style={{ padding: '10px 14px', fontSize: 12.5 }}
                onClick={() => {
                  playTapSound();
                  if (setActiveTab) setActiveTab('menu');
                }}
              >
                <Plus size={15} />
                <span>{language === 'hi' ? 'और व्यंजन जोड़ें' : 'Add More Dishes'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {language === 'hi' ? 'कोई सक्रिय ऑर्डर नहीं है' : 'No Active Order for this Table'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, marginBottom: 16 }}>
              {language === 'hi'
                ? 'स्वादिष्ट व्यंजनों का आनंद लेने के लिए मेनू से ऑर्डर करें।'
                : 'Browse our artisanal menu and tap dishes to place your order.'}
            </div>
            <button
              className="btn-primary-pill"
              onClick={() => {
                playTapSound();
                if (setActiveTab) setActiveTab('menu');
              }}
            >
              {language === 'hi' ? 'मेनू देखें' : 'Browse Menu'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // VIEW 2: CART / TRAY VIEW (When user clicks on cart bottom tab or floating bar)
  if (activeTab === 'cart' || isCartOpen) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 95 }}>
        {renderNameModal()}
        {renderOrderStatusTipModal()}
        {renderSessionNotice()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div className="screen-title">{t('yourOrderTray')}</div>
            <div className="screen-subtitle">{t('freshlyPreparedFor')} {activeTable}</div>
          </div>
          {isCartOpen && (
            <button
              className="nav-icon-btn"
              onClick={() => setIsCartOpen(false)}
              aria-label="Close Tray"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <ShoppingBag size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t('emptyCart')}</div>
            <div style={{ marginTop: 14 }}>
              <button
                className="btn-primary-pill"
                onClick={() => {
                  playTapSound();
                  setIsCartOpen(false);
                  if (setActiveTab) setActiveTab('menu');
                }}
              >
                {language === 'hi' ? 'मेनू पर जाएं' : 'Browse Menu'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Cart Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {cart.map((cartItem, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: 14
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {cartItem.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--primary-blue)', fontWeight: 600 }}>
                      ₹{(cartItem.price * cartItem.quantity).toFixed(0)}
                    </div>
                    {cartItem.note && (
                      <div style={{ fontSize: 11, color: '#D97706', fontStyle: 'italic', marginTop: 2 }}>
                        Note: "{cartItem.note}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="nav-icon-btn"
                      style={{ width: 28, height: 28 }}
                      onClick={() => handleUpdateQuantity(idx, -1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>
                      {cartItem.quantity}
                    </span>
                    <button
                      className="nav-icon-btn"
                      style={{ width: 28, height: 28 }}
                      onClick={() => handleUpdateQuantity(idx, 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Order Note (FR-C4) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                {t('kitchenServiceNote')}
              </label>
              <input
                type="text"
                className="ios-input"
                placeholder={t('kitchenNotePlaceholder')}
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>

            {/* Coupon Code (FR-P5) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={13} color="#007AFF" />
                  <span>{t('couponCode')}</span>
                </label>
                {appliedPromo && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>
                    Saving ₹{discountAmount.toFixed(0)}!
                  </span>
                )}
              </div>

              {/* Coupon Input & Apply/Remove Buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="ios-input"
                  placeholder={t('couponPlaceholder')}
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyPromo();
                    }
                  }}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                    borderColor: appliedPromo ? '#86EFAC' : '#E5E7EB',
                    background: appliedPromo ? '#F0FDF4' : '#FFFFFF'
                  }}
                />
                {appliedPromo ? (
                  <button
                    type="button"
                    className="btn-secondary-pill"
                    onClick={handleRemovePromo}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#DC2626',
                      borderColor: '#FECACA',
                      background: '#FEF2F2'
                    }}
                  >
                    ✕ Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary-pill"
                    onClick={() => handleApplyPromo()}
                    style={{ minWidth: 70, justifyContent: 'center', fontWeight: 700 }}
                  >
                    {t('apply')}
                  </button>
                )}
              </div>

              {promoMessage && (
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    marginTop: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: appliedPromo ? '#DCFCE7' : '#FEE2E2',
                    color: appliedPromo ? '#15803D' : '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {appliedPromo ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  <span>{promoMessage}</span>
                </div>
              )}

              {/* Available Coupons Carousel (1-Tap Apply) */}
              {offers && offers.filter((o) => o.isActive && !isOfferExpired(o)).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>
                    {language === 'hi' ? 'उपलब्ध ऑफर्स (टैप करके लागू करें):' : 'Available Offers (Tap to Apply):'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
                    {offers
                      .filter((o) => o.isActive && !isOfferExpired(o))
                      .map((off) => {
                        const isCurrent = appliedPromo && appliedPromo.code === off.code;
                        const isEligible = !off.minOrderAmount || cartSubtotal >= Number(off.minOrderAmount);
                        return (
                          <div
                            key={off.id}
                            onClick={() => {
                              if (isCurrent) {
                                handleRemovePromo();
                              } else {
                                handleApplyPromo(off.code);
                              }
                            }}
                            style={{
                              flexShrink: 0,
                              background: isCurrent ? '#F0FDF4' : '#F8FAFC',
                              border: `1.5px dashed ${isCurrent ? '#16A34A' : isEligible ? '#007AFF' : '#CBD5E1'}`,
                              borderRadius: 12,
                              padding: '8px 10px',
                              cursor: 'pointer',
                              minWidth: 165,
                              maxWidth: 220,
                              transition: 'all 0.2s ease',
                              boxShadow: isCurrent ? '0 2px 6px rgba(22, 163, 74, 0.15)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: isCurrent ? '#15803D' : '#007AFF', letterSpacing: '0.04em' }}>
                                {off.code}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 8,
                                  background: isCurrent ? '#DCFCE7' : '#EFF6FF',
                                  color: isCurrent ? '#15803D' : '#007AFF'
                                }}
                              >
                                {isCurrent ? '✓ Applied' : off.type === 'percent' ? `${off.value}% OFF` : `₹${off.value} OFF`}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.3, marginBottom: 4 }}>
                              {off.description}
                            </div>
                            <div style={{ fontSize: 10, color: '#6B7280', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{off.minOrderAmount > 0 ? `Min ₹${off.minOrderAmount}` : 'No Min'}</span>
                              {off.expiryDate && <span>Till {off.expiryDate}</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Diner Name (DPDP Act Compliant: strictly optional, non-blocking) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  {t('yourName')} (Optional)
                </label>
                <input
                  type="text"
                  className="ios-input"
                  placeholder={t('namePlaceholder')}
                  value={customerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerName(val);
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem(dinerNameKey, val);
                      sessionStorage.setItem('ontap_diner_name', val);
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                  {t('phoneNumber')}
                </label>
                <input
                  type="tel"
                  className="ios-input"
                  placeholder={t('phonePlaceholder')}
                  value={customerPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerPhone(val);
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem(dinerPhoneKey, val);
                      sessionStorage.setItem('ontap_diner_phone', val);
                    }
                  }}
                />
              </div>
            </div>

            {/* DPDP Statutory Privacy Micro-Notice & Age Guidance */}
            <div
              style={{
                fontSize: 10,
                color: '#64748B',
                lineHeight: 1.4,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '8px 10px',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6
              }}
            >
              <ShieldCheck size={13} color="#007AFF" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                {language === 'hi'
                  ? '🔒 डेटा संरक्षण सूचना: नाम व मोबाइल नंबर केवल ऑर्डर व डिजिटल रसीद हेतु हैं (वैकल्पिक)। १८ वर्ष से कम आयु के ग्राहक अभिभावक की देखरेख में ऑर्डर करें।'
                  : '🔒 DPDP Notice: Contact info is collected solely for order status & digital receipts (optional). Diners under 18 must order under adult supervision.'}
              </div>
            </div>

            {/* Payment Mode Selector (FR-C7: Pay at counter by default, optional UPI) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                {t('paymentMethod')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                <button
                  type="button"
                  className="ios-card"
                  style={{
                    padding: '12px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: paymentMode === 'counter' ? '2px solid #007AFF' : '1px solid #E5E7EB',
                    background: paymentMode === 'counter' ? '#EFF6FF' : '#FFFFFF'
                  }}
                  onClick={() => setPaymentMode('counter')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <CreditCard size={14} color="#007AFF" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t('payAtCounter')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('payAtCounterDesc')}</div>
                </button>

                <button
                  type="button"
                  className="ios-card"
                  style={{
                    padding: '12px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: paymentMode === 'upi' ? '2px solid #007AFF' : '1px solid #E5E7EB',
                    background: paymentMode === 'upi' ? '#EFF6FF' : '#FFFFFF'
                  }}
                  onClick={() => setPaymentMode('upi')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <QrCode size={14} color="#8B5CF6" />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t('instantUpi')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('instantUpiDesc')}</div>
                </button>
              </div>
            </div>

            {/* Price Breakdown */}
            <div
              style={{
                background: '#F9FAFB',
                padding: 12,
                borderRadius: 14,
                marginBottom: 16,
                fontSize: 13
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
                <span>₹{cartSubtotal.toFixed(0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Taxes</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>Inclusive in dish prices</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#16A34A' }}>
                  <span>{t('discount')} ({appliedPromo.code})</span>
                  <span>-₹{discountAmount.toFixed(0)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: 16,
                  borderTop: '1px solid #E5E7EB',
                  paddingTop: 6,
                  marginTop: 6
                }}
              >
                <span>{t('totalDue')}</span>
                <span style={{ color: 'var(--primary-blue)' }}>₹{cartTotal.toFixed(0)}</span>
              </div>
            </div>

            {/* Confirm & Send to Kitchen Button */}
            <button
              className="btn-primary-pill full-width"
              onClick={handleCheckoutSubmit}
              disabled={cart.length === 0 || isCurrentBizSuspended}
              style={isCurrentBizSuspended ? { opacity: 0.6, cursor: 'not-allowed', background: '#9CA3AF' } : undefined}
            >
              <CheckCircle2 size={18} />
              <span>
                {isCurrentBizSuspended
                  ? (language === 'hi' ? 'ऑर्डरिंग स्थगित है' : 'Ordering Paused')
                  : `${t('confirmOrder')} (₹${cartTotal.toFixed(0)})`}
              </span>
            </button>
          </div>
        )}

        {/* UPI QR & Deep Link Payment Modal (FR-C7) */}
        {showUpiModal && (
          <div className="modal-overlay" onClick={() => setShowUpiModal(false)}>
            <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-drag-pill" />
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div className="card-heading" style={{ fontSize: 19 }}>
                  {language === 'hi' ? 'तत्काल यूपीआई भुगतान' : 'Instant UPI Payment'}
                </div>
                <div className="card-meta-text">
                  Google Pay • PhonePe • Paytm • CRED • BHIM
                </div>
              </div>

              {/* Dynamic QR Code Display for the amount (FR-C7) */}
              <div
                style={{
                  width: 220,
                  height: 220,
                  background: '#FFFFFF',
                  border: '3px solid #111827',
                  borderRadius: 18,
                  margin: '0 auto 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  padding: 8
                }}
              >
                <img
                  src={localQrDataUrl || qrCodeApiUrl}
                  alt={`UPI QR for ₹${cartTotal.toFixed(0)} to ${upiVpa}`}
                  style={{ width: 170, height: 170, objectFit: 'contain' }}
                  onError={(e) => {
                    if (e.target.src !== qrCodeApiUrl) {
                      e.target.src = qrCodeApiUrl;
                    }
                  }}
                />
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: '#007AFF' }}>
                  ₹{cartTotal.toFixed(0)}
                </div>
              </div>

              {/* UPI ID Pill with 1-tap Copy */}
              <div
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 14
                }}
              >
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Pay to UPI ID (VPA)
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', wordBreak: 'break-all' }}>
                    {upiVpa}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    Payee: {payeeRestaurantName} • {activeTable}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUpi}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: copiedUpi ? '#ECFDF5' : '#007AFF',
                    color: copiedUpi ? '#059669' : '#FFFFFF',
                    border: copiedUpi ? '1px solid #A7F3D0' : 'none',
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                  title="Copy UPI ID"
                >
                  {copiedUpi ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedUpi ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* UPI Deep Link Button for mobile devices (FR-C7) */}
              <a
                href={upiPayUrl}
                className="btn-primary-pill full-width"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 8,
                  color: '#FFFFFF',
                  fontWeight: 700
                }}
              >
                <ArrowRight size={16} />
                <span>Open in GPay / PhonePe / Paytm</span>
              </a>

              <button
                className="btn-primary-pill full-width"
                style={{ background: '#16A34A', marginBottom: 8 }}
                onClick={() => {
                  completeOrderPlacement('Paid via UPI QR (Verified)');
                }}
              >
                <CheckCircle2 size={16} />
                <span>Confirm Payment Completed</span>
              </button>

              <button
                className="btn-secondary-pill full-width"
                onClick={() => setShowUpiModal(false)}
              >
                Cancel / Return to Tray
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: MAIN MENU BROWSING (DEFAULT GUEST DINE-IN EXPERIENCE)
  // -------------------------------------------------------------
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 95 }}>
      {renderNameModal()}
      {renderOrderStatusTipModal()}
      {sessionNotice && (
        <div style={{ padding: '12px 18px 0' }}>
          {renderSessionNotice()}
        </div>
      )}
      {/* Screen Title & Welcome with Diner Name Pill */}
      <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {theme?.logo && (
            <img
              src={theme.logo}
              alt={theme.restaurantName}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                objectFit: 'contain',
                background: '#FFFFFF',
                padding: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid #E2E8F0',
                flexShrink: 0
              }}
            />
          )}
          <div>
            <div className="screen-title">{theme.restaurantName}</div>
            <div className="screen-subtitle">
              {(() => {
                const isStall = (activeTable || '').toLowerCase().includes('stand') ||
                                (activeTable || '').toLowerCase().includes('stall') ||
                                theme?.serviceType === 'stall';
                if (isStall) {
                  return language === 'hi'
                    ? 'काउंटर स्टैंड व ईट पर आपका स्वागत है। मेनू देखें और तुरंत ऑर्डर करें।'
                    : 'Welcome! Scan, order effortlessly, and pick up your food by Order Number.';
                }
                return language === 'hi'
                  ? `${activeTable} पर आपका स्वागत है। मेनू देखें और तुरंत ऑर्डर करें।`
                  : (theme.welcomeMessage || `Welcome to ${activeTable}! Order fresh dishes directly to your table.`);
              })()}
            </div>
          </div>
        </div>

        {customerName && (
          <button
            onClick={() => {
              playTapSound();
              setCustomerNameInput(customerName);
              setCustomerPhoneInput(customerPhone);
              setShowNameModal(true);
            }}
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 20,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: '#15803D',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
            title="Diner Name (Tap to edit)"
          >
            <User size={12} color="#15803D" />
            <span>{customerName}</span>
            <Edit2 size={10} color="#15803D" />
          </button>
        )}
      </div>

      {/* Subtle Chef & FSSAI Verification Option (Opt-in) */}
      {(chef?.showAboutChef !== false && theme?.showAboutChef !== false) && (
        <div style={{ padding: '0 18px 10px', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              if (onGoToChef) onGoToChef();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11.5,
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={chef?.showVerifiedBadge !== false ? "Tap to view verified Executive Chef credentials & FSSAI audit" : "Tap to learn about our Executive Chef & culinary story"}
          >
            {chef?.showVerifiedBadge !== false ? (
              <ShieldCheck size={13} color="#16A34A" />
            ) : (
              <Sparkles size={13} color="#007AFF" />
            )}
            <span>
              {language === 'hi'
                ? (chef?.showVerifiedBadge !== false ? `शेफ ${chef?.name || ''} व FSSAI प्रमाण देखें` : `शेफ ${chef?.name || ''} के बारे में जानें`)
                : (chef?.showVerifiedBadge !== false ? `About Chef ${chef?.name || ''} & Credentials` : `About Chef ${chef?.name || ''}`)}
            </span>
            <ChevronRight size={12} color="#94A3B8" />
          </button>
        </div>
      )}

      {/* Suspended Notice for diners */}
      {isCurrentBizSuspended && (
        <div style={{
          margin: '0 18px 12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#DC2626'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, lineHeight: 1.4, fontWeight: 500 }}>
            <strong>{language === 'hi' ? 'ऑर्डरिंग अस्थायी रूप से स्थगित:' : 'Online Ordering Paused:'}</strong>{' '}
            {language === 'hi'
              ? 'इस प्रतिष्ठान का डिजिटल मेनू वर्तमान में केवल देखने के लिए उपलब्ध है। ऑर्डर देने हेतु कृपया काउंटर पर संपर्क करें।'
              : 'Digital ordering is temporarily paused for this establishment. Please place orders directly with our counter staff.'}
          </div>
        </div>
      )}

      {/* Filter / Sub-Nav Tabs (Strict Design System Specification) */}
      <div className="filter-tabs-container">
        {categoryKeys.map((cat) => (
          <button
            key={cat.id}
            className={`capsule-tab ${effectiveCategory === cat.id ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setSelectedCategory(cat.id);
            }}
          >
            {cat.label}
          </button>
        ))}

        {/* Veg-only filter pill */}
        <button
          className={`capsule-tab ${vegOnly ? 'active' : ''}`}
          onClick={() => {
            playTapSound();
            setVegOnly(!vegOnly);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: vegOnly ? '1px solid #16A34A' : 'none'
          }}
        >
          <span className="veg-badge" />
          <span>{t('pureVegOnly')}</span>
        </button>
      </div>

      {/* Active Live Tracking Notification Card (if table has order(s) in kitchen or served) */}
      {customerOrders && customerOrders.length > 0 && (() => {
        const activeTickets = customerOrders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected');
        const latestActive = activeTickets[0] || customerOrders[0];
        const hasActive = activeTickets.length > 0;
        const isMulti = customerOrders.length > 1;
        const allServed = !hasActive && customerOrders.some((o) => o.status === 'served' || o.status === 'done');
        const isAnyCooking = activeTickets.some((t) => t.status === 'cooking' || t.status === 'in-progress') ||
                             (latestActive && (latestActive.status === 'cooking' || latestActive.status === 'in-progress'));

        return (
          <div style={{ padding: '0 16px', marginBottom: 12 }}>
            <div
              className={`ios-card ${allServed ? 'ios-card-highlight' : 'active-gradient'}`}
              style={{
                padding: '12px 14px',
                cursor: 'pointer',
                border: allServed ? '1.5px solid #86EFAC' : isAnyCooking ? '1.5px solid #F59E0B' : isMulti ? '1.5px solid #60A5FA' : undefined,
                boxShadow: allServed ? '0 4px 14px rgba(22, 163, 74, 0.12)' : isAnyCooking ? '0 4px 14px rgba(245, 158, 11, 0.15)' : isMulti ? '0 4px 14px rgba(37, 99, 235, 0.12)' : undefined,
                background: allServed ? '#F0FDF4' : isAnyCooking ? '#FFFDF5' : undefined
              }}
              onClick={() => {
                playTapSound();
                if (setActiveTab) setActiveTab('track');
              }}
            >
              <div className="card-top-row" style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    className={`status-pill ${allServed ? 'ready' : 'progress'}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: allServed ? '#DCFCE7' : isAnyCooking ? '#FFFBEB' : isMulti ? '#EFF6FF' : undefined,
                      color: allServed ? '#15803D' : isAnyCooking ? '#B45309' : isMulti ? '#1D4ED8' : undefined,
                      border: allServed ? '1px solid #86EFAC' : isAnyCooking ? '1px solid #F59E0B' : isMulti ? '1px solid #BFDBFE' : undefined
                    }}
                  >
                    {allServed
                      ? (language === 'hi' ? 'सभी व्यंजन परोसे गए ✓' : 'All Dishes Served ✓')
                      : isAnyCooking
                      ? (language === 'hi' ? 'रसोई में पक रहा है 🔥' : 'Cooking in Kitchen 🔥')
                      : isMulti
                      ? `${activeTickets.length} Active Tickets in Kitchen`
                      : latestActive.statusLabel}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {allServed
                      ? (language === 'hi' ? 'अंतिम बिल देखें' : 'View Final Bill & Stack')
                      : isMulti
                      ? 'Live Orders Stack'
                      : latestActive.id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isAnyCooking && (
                    <img
                      src={cookingAnimationGif}
                      alt="Cooking"
                      style={{ width: 24, height: 24, objectFit: 'contain' }}
                      onError={(e) => {
                        e.currentTarget.src = '/output-onlinegiftools.gif';
                      }}
                    />
                  )}
                  <span className="card-meta-text">{latestActive.table || activeTable} • Tap to View</span>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {allServed ? (
                  language === 'hi'
                    ? 'आपके सभी स्वीकृत व्यंजन परोसे जा चुके हैं। कुल देय बिल व विवरण देखने हेतु टैप करें।'
                    : 'All accepted dishes have been served. Tap to view itemized tickets and final bill amount.'
                ) : isMulti ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {activeTickets.map((t, idx) => (
                      <span
                        key={t.id}
                        style={{
                          background: '#F1F5F9',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.status === 'ready' ? '#A16207' : t.status === 'cooking' ? '#B45309' : '#1D4ED8'
                        }}
                      >
                        Ticket #{activeTickets.length - idx}: {t.status === 'ready' ? 'Ready' : t.status === 'cooking' ? 'Cooking' : 'Received'}
                      </span>
                    ))}
                  </div>
                ) : (
                  `• ${latestActive.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`
                )}
              </div>

              <div className="card-bottom-progress">
                <div
                  className="card-bottom-progress-fill progress"
                  style={{
                    background: allServed ? '#16A34A' : undefined,
                    width: `${
                      allServed
                        ? 100
                        : isMulti
                        ? Math.round(
                            activeTickets.reduce((acc, t) => {
                              const pct = t.status === 'ready' ? 75 : (t.status === 'cooking' || t.status === 'in-progress') ? 42 : 20;
                              return acc + pct;
                            }, 0) / activeTickets.length
                          )
                        : (latestActive.progressPercent || 40)
                    }%`
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Menu Item Cards Feed (Responsive Grid) */}
      <div className="menu-items-grid">
        {filteredMenu.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            {language === 'hi' ? 'कोई व्यंजन नहीं मिला।' : 'No culinary items found matching your filters.'}
          </div>
        ) : (
          filteredMenu.map((item) => {
            const isItemInStock = item.isAvailable !== false;
            return (
              <div
                key={item.id}
                className={`ios-card ${!isItemInStock ? 'opacity-50' : ''}`}
                style={{
                  opacity: isItemInStock ? 1 : 0.6,
                  filter: isItemInStock ? 'none' : 'grayscale(0.7)'
                }}
              >
              <div style={{ display: 'flex', gap: 14 }}>
                {/* Item Image with Veg/Non-veg badge */}
                <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                  <img
                    src={item.image || DEFAULT_CUTLERY_IMAGE}
                    alt={item.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = DEFAULT_CUTLERY_IMAGE;
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 14,
                      objectFit: 'cover'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      background: 'rgba(255, 255, 255, 0.9)',
                      padding: 3,
                      borderRadius: 4,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {item.isVeg ? <span className="veg-badge" /> : <span className="non-veg-badge" />}
                  </div>
                </div>

                {/* Item Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="card-top-row" style={{ marginBottom: 2 }}>
                      <div className="card-heading">{item.name}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-blue)', marginBottom: 4 }}>
                      ₹{item.price.toFixed(0)}
                    </div>

                    {/* Bullet point list describing item */}
                    {item.bullets && item.bullets.length > 0 && (
                      <ul className="body-subtask">
                        {item.bullets.map((bullet, idx) => (
                          <li key={idx}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Badges and Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 8
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {item.tags && item.tags
                        .filter((tag) => tag && !['scanned', 'manual', 'new', 'unassigned'].includes(String(tag).toLowerCase().trim()))
                        .map((tag, idx) => (
                          <span key={idx} className="status-pill tag" style={{ fontSize: 10, padding: '2px 8px' }}>
                            {tag}
                          </span>
                        ))}
                    </div>

                    {isItemInStock ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn-secondary-pill"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          onClick={() => {
                            playTapSound();
                            setCustomizingItem(item);
                            setItemNoteInput('');
                          }}
                          title={t('customNotes')}
                          aria-label="Add instructions"
                        >
                          <MessageSquare size={13} />
                        </button>

                        {cart.filter((ci) => ci.id === item.id).reduce((s, ci) => s + ci.quantity, 0) === 0 ? (
                          <button
                            className="btn-primary-pill"
                            style={{ padding: '6px 16px', fontSize: 13, fontWeight: 700 }}
                            onClick={() => handleAddToCart(item)}
                          >
                            <Plus size={14} />
                            <span>{t('add')}</span>
                          </button>
                        ) : (
                          <div
                            className="menu-qty-stepper"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--primary-blue)',
                              borderRadius: 20,
                              padding: '2px 4px',
                              color: '#FFFFFF',
                              boxShadow: '0 2px 6px rgba(0, 122, 255, 0.3)'
                            }}
                          >
                            <button
                              onClick={() => handleDecreaseItemQty(item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#FFFFFF',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              aria-label="Decrease quantity"
                              title="Decrease quantity"
                            >
                              <Minus size={13} strokeWidth={2.8} />
                            </button>

                            <span
                              style={{
                                minWidth: 20,
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: 13,
                                padding: '0 2px',
                                userSelect: 'none'
                              }}
                            >
                              {cart.filter((ci) => ci.id === item.id).reduce((s, ci) => s + ci.quantity, 0)}
                            </span>

                            <button
                              onClick={() => handleAddToCart(item)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#FFFFFF',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              aria-label="Increase quantity"
                              title="Increase quantity"
                            >
                              <Plus size={13} strokeWidth={2.8} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        className="status-pill pending"
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          padding: '4px 10px',
                          borderRadius: 14
                        }}
                      >
                        {t('soldOut') || 'Sold Out'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* Suggestables Upsell Banner (FR-C8) */}
      {suggestableItem && (
        <div style={{ padding: '16px', marginTop: 8 }}>
          <div
            className="ios-card active-gradient"
            style={{
              padding: '12px 14px',
              border: '1px solid rgba(0, 122, 255, 0.2)'
            }}
          >
            <div className="card-top-row" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} color="#007AFF" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-blue)' }}>
                  {t('chefPairing')}
                </span>
              </div>
              <span className="status-pill tag" style={{ fontSize: 9 }}>+ Add-On</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={suggestableItem.image || DEFAULT_CUTLERY_IMAGE}
                  alt={suggestableItem.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = DEFAULT_CUTLERY_IMAGE;
                  }}
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{suggestableItem.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Just +₹{suggestableItem.price.toFixed(0)}
                  </div>
                </div>
              </div>

              {(() => {
                const sugQty = cart.filter((ci) => ci.id === suggestableItem.id).reduce((s, ci) => s + ci.quantity, 0);
                if (sugQty === 0) {
                  return (
                    <button
                      className="btn-primary-pill"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                      onClick={() => handleAddToCart(suggestableItem, 'Chef Recommended Pairing')}
                    >
                      <Plus size={13} />
                      <span>{t('addPairing')}</span>
                    </button>
                  );
                }
                return (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'var(--primary-blue)',
                      borderRadius: 18,
                      padding: '2px 4px',
                      color: '#FFFFFF'
                    }}
                  >
                    <button
                      onClick={() => handleDecreaseItemQty(suggestableItem.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '3px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} strokeWidth={2.8} />
                    </button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800, fontSize: 12 }}>
                      {sugQty}
                    </span>
                    <button
                      onClick={() => handleAddToCart(suggestableItem, 'Chef Recommended Pairing')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '3px 6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} strokeWidth={2.8} />
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Floating Cart Bar (When Cart Has Items) */}
      {totalItemCount > 0 && (
        <div
          className="floating-cart-bar"
          onClick={() => {
            playTapSound();
            setIsCartOpen(true);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#007AFF',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13
              }}
            >
              {totalItemCount}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t('viewTray')}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>{activeTable} • {t('dineIn')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>₹{cartTotal.toFixed(0)}</span>
            <ChevronRight size={16} />
          </div>
        </div>
      )}

      {/* Per-Item Customization Modal (FR-C4) */}
      {customizingItem && (
        <div className="modal-overlay" onClick={() => setCustomizingItem(null)}>
          <div className="modal-content-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-drag-pill" />
            <div className="card-heading" style={{ marginBottom: 4 }}>
              {t('customNotes')}: {customizingItem.name}
            </div>
            <div className="card-meta-text" style={{ marginBottom: 14 }}>
              {language === 'hi'
                ? 'शेफ आपके स्वाद और प्राथमिकता के अनुसार तैयार करेंगे।'
                : 'Chef will prepare according to your dietary instructions.'}
            </div>

            <textarea
              className="ios-input"
              rows={3}
              placeholder={t('customNotesPlaceholder')}
              value={itemNoteInput}
              onChange={(e) => setItemNoteInput(e.target.value)}
              style={{ resize: 'none', marginBottom: 16 }}
            />

            <button
              className="btn-primary-pill full-width"
              onClick={() => {
                handleAddToCart(customizingItem, itemNoteInput);
                setCustomizingItem(null);
                setItemNoteInput('');
              }}
            >
              <Plus size={16} />
              <span>{t('addToTrayWithNote')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Customer Footer - Strictly Zero Staff Login UI */}
      <footer
        style={{
          marginTop: 32,
          padding: '24px 16px',
          textAlign: 'center',
          borderTop: '1px solid #E5E7EB',
          color: 'var(--text-muted)',
          fontSize: 11
        }}
      >
        {theme?.logo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <img
              src={theme.logo}
              alt={theme.restaurantName}
              style={{
                maxHeight: 38,
                maxWidth: 140,
                objectFit: 'contain',
                opacity: 0.9
              }}
            />
          </div>
        )}
        <div
          style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, userSelect: 'none' }}
          onClick={() => {
            // Invisible floor supervisor bypass: tap 5 times to open terminal prompt
            secretTapCount.current += 1;
            if (secretTapTimer.current) clearTimeout(secretTapTimer.current);
            secretTapTimer.current = setTimeout(() => {
              secretTapCount.current = 0;
            }, 1800);
            if (secretTapCount.current >= 5) {
              secretTapCount.current = 0;
              playTapSound();
              if (onOpenStaffPortal) onOpenStaffPortal();
            }
          }}
        >
          {theme.restaurantName}{theme.fssai ? ` • FSSAI Lic #${theme.fssai}` : ''}
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {theme.tagline || 'Pure Contactless Table QR Ordering • Freshly Crafted & Served Hot'}
        </div>

        {/* Business Physical Address (configured by owner) */}
        {theme.address && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            📍 {theme.address}
          </div>
        )}

        {/* Company Transparency & Platform Operations Details */}
        <div style={{ marginTop: 10, fontSize: 10.5, color: '#64748B', lineHeight: 1.5 }}>
          Platform operated by <strong>{COMPANY_LEGAL_INFO.legalName}</strong><br />
          Platform Office: {COMPANY_LEGAL_INFO.physicalAddress}<br />
          Contact: <a href={`mailto:${COMPANY_LEGAL_INFO.supportEmail}`} style={{ color: 'var(--primary-blue)', textDecoration: 'none' }}>{COMPANY_LEGAL_INFO.supportEmail}</a>
        </div>

        {/* Legal Policies Navigation Row */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, fontSize: 11 }}>
          <button
            type="button"
            onClick={() => {
              setLegalInitialTab('privacy');
              setShowLegalModal(true);
            }}
            style={{ background: 'none', border: 'none', color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', padding: 2 }}
          >
            Privacy Policy
          </button>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <button
            type="button"
            onClick={() => {
              setLegalInitialTab('terms');
              setShowLegalModal(true);
            }}
            style={{ background: 'none', border: 'none', color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', padding: 2 }}
          >
            Terms of Service
          </button>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <button
            type="button"
            onClick={() => {
              setLegalInitialTab('refund');
              setShowLegalModal(true);
            }}
            style={{ background: 'none', border: 'none', color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', padding: 2 }}
          >
            Refund Policy
          </button>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <button
            type="button"
            onClick={() => {
              setLegalInitialTab('cookie');
              setShowLegalModal(true);
            }}
            style={{ background: 'none', border: 'none', color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', padding: 2 }}
          >
            Cookie Policy
          </button>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <button
            type="button"
            onClick={() => {
              setLegalInitialTab('dmca');
              setShowLegalModal(true);
            }}
            style={{ background: 'none', border: 'none', color: '#007AFF', textDecoration: 'underline', cursor: 'pointer', padding: 2 }}
          >
            DMCA Notice
          </button>
        </div>

        {/* Consent & Data Deletion Action Buttons */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowCookieSettings(true);
            }}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#334155',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cookie Preferences
          </button>
        </div>
      </footer>

      {/* Mandatory Diner Name Pop-up Modal */}
      {renderNameModal()}

      {/* Interactive In-App Legal Documents Modal */}
      <LegalModal
        isOpen={showLegalModal}
        initialTab={legalInitialTab}
        onClose={() => setShowLegalModal(false)}
      />

      {/* Cookie Consent Banner in Settings Mode */}
      <CookieBanner
        forceOpen={showCookieSettings}
        onClose={() => setShowCookieSettings(false)}
        onOpenLegal={(tab) => {
          setLegalInitialTab(tab);
          setShowLegalModal(true);
        }}
      />

      {/* DMCA Designated Agent Policy Modal Fallback */}
      <DmcaModal isOpen={showDmcaModal} onClose={() => setShowDmcaModal(false)} />
    </div>
  );
}
