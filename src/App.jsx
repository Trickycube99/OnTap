import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, QrCode, Lock, Utensils, Layers, ShieldCheck } from 'lucide-react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import TableQrModal from './components/TableQrModal';
import { AdminOwnerLoginGate, CounterLoginGate, QrCodeGate } from './components/AccessGates';
import CustomerView from './views/CustomerView';
import AboutChefView from './views/AboutChefView';
import CounterView from './views/CounterView';
import AdminView from './views/AdminView';
import DeveloperAdminView from './views/DeveloperAdminView';
import AuthActionView from './views/AuthActionView';
import {
  initialMenu,
  verifiedChefData,
  initialOrders,
  initialExpenses,
  initialStaff,
  initialOffers,
  initialTheme
} from './data/initialData';
import { loadData, saveData, resetAllDataToDefault, getScopedKey, STORAGE_KEYS } from './utils/storage';
import {
  getStoredSessions,
  saveStoredSessions,
  isAuthenticated,
  logoutRole,
  resetAllSessions
} from './utils/auth';
import {
  getActiveBusiness,
  setActiveBusiness,
  getBusinesses,
  isDeveloperAuthenticated
} from './utils/businessManager';
import { playNewOrderChime, playTapSound } from './utils/audio';
import { subscribeSyncEvents, SYNC_EVENTS } from './utils/sync';
import confetti from 'canvas-confetti';

/**
 * Check if current guest session has valid QR code access
 * (Customer menu is strictly accessible only via physical table QR codes)
 */
export const checkGuestQrAccess = () => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  const hashParams = new URLSearchParams(hashQuery);
  const hasTableParam = Boolean(
    urlParams.get('table') || hashParams.get('table') ||
    urlParams.get('t') || hashParams.get('t')
  );
  const hasQrParam = Boolean(
    urlParams.get('qr') || hashParams.get('qr')
  );
  const hasSessionQr = typeof sessionStorage !== 'undefined' && (
    sessionStorage.getItem('flowscape_guest_scanned_qr') === 'true' ||
    Boolean(sessionStorage.getItem('flowscape_guest_table'))
  );
  return hasTableParam || hasQrParam || hasSessionQr;
};

export const normalizeStaffCredentials = (staffList) => {
  if (!Array.isArray(staffList)) return [];
  return staffList.map((emp, idx) => {
    const defaultLoginId = emp.loginId || (emp.name ? emp.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.pos' : `staff${idx + 1}.pos`);
    const defaultPin = emp.pin ? String(emp.pin).trim() : String(4401 + idx);
    return {
      ...emp,
      loginId: defaultLoginId,
      pin: defaultPin
    };
  });
};

export default function App() {
  const initialBiz = getActiveBusiness();
  const initialBizId = initialBiz?.id || 'biz_advait';
  const isDefaultBiz = initialBizId === 'biz_advait';

  const [activeBusinessId, setActiveBusinessId] = useState(initialBizId);
  const loadedBusinessIdRef = useRef(initialBizId);

  // Global Shared States (Persisted in localStorage scoped by active business)
  const [menu, setMenu] = useState(() => loadData(getScopedKey(STORAGE_KEYS.MENU, initialBizId), initialMenu));
  const [chef, setChef] = useState(() => loadData(getScopedKey(STORAGE_KEYS.CHEF, initialBizId), verifiedChefData));
  const [orders, setOrders] = useState(() => {
    const loaded = loadData(getScopedKey(STORAGE_KEYS.ORDERS, initialBizId), isDefaultBiz ? initialOrders : []);
    return loaded.map((o) =>
      o.id === 'ORD-8821' && o.status === 'in-progress'
        ? { ...o, status: 'received', statusLabel: 'Received', progressPercent: 25 }
        : o
    );
  });
  const [expenses, setExpenses] = useState(() => loadData(getScopedKey(STORAGE_KEYS.EXPENSES, initialBizId), isDefaultBiz ? initialExpenses : []));
  const [staff, setStaff] = useState(() => {
    const raw = loadData(getScopedKey(STORAGE_KEYS.STAFF, initialBizId), isDefaultBiz ? initialStaff : []);
    return normalizeStaffCredentials(raw);
  });
  const [offers, setOffers] = useState(() => loadData(getScopedKey(STORAGE_KEYS.OFFERS, initialBizId), isDefaultBiz ? initialOffers : []));
  const [theme, setTheme] = useState(() => {
    const loaded = loadData(getScopedKey(STORAGE_KEYS.THEME, initialBizId), initialTheme);
    const activeBiz = getActiveBusiness();
    const bizOverride = activeBiz ? {
      restaurantName: activeBiz.name,
      tagline: activeBiz.tagline || loaded?.tagline,
      upiId: activeBiz.upiId || loaded?.upiId,
      accentColor: activeBiz.accentColor || loaded?.accentColor,
      logo: activeBiz.logo !== undefined ? activeBiz.logo : (loaded?.logo || null),
      tables: Array.isArray(activeBiz.tables) && activeBiz.tables.length > 0 ? activeBiz.tables : (loaded?.tables || initialTheme.tables)
    } : {};
    return {
      ...initialTheme,
      ...loaded,
      ...bizOverride,
      logo: bizOverride.logo !== undefined ? bizOverride.logo : (loaded?.logo || null),
      upiId: loaded?.upiId || bizOverride.upiId || initialTheme.upiId || '9119069179@nyes'
    };
  });
  const [checklists, setChecklists] = useState(() => loadData(getScopedKey(STORAGE_KEYS.CHECKLISTS, initialBizId), []));

  // Authentication State
  const [authSessions, setAuthSessions] = useState(() => getStoredSessions());
  const [authModal, setAuthModal] = useState({ isOpen: false, targetRole: null });
  const [isTableQrOpen, setIsTableQrOpen] = useState(false);

  // Dedicated Firebase Auth Action State (Email Verification & Password Reset)
  const [authActionState, setAuthActionState] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      const mode = urlParams.get('mode') || hashParams.get('mode');
      const oobCode = urlParams.get('oobCode') || hashParams.get('oobCode') || urlParams.get('code') || hashParams.get('code');
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().split('?')[0];

      if (mode === 'verifyEmail' || mode === 'resetPassword') {
        return { mode, oobCode: oobCode || '' };
      }
      if (rawHash === 'verify-email' || rawHash === 'verifyemail') {
        return { mode: 'verifyEmail', oobCode: oobCode || '' };
      }
      if (rawHash === 'reset-password' || rawHash === 'resetpassword') {
        return { mode: 'resetPassword', oobCode: oobCode || '' };
      }
    }
    return null;
  });

  const [switchedFromAdmin, setSwitchedFromAdmin] = useState(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('flowscape_switched_from_admin') === 'true';
    }
    return false;
  });

  const canReturnToAdmin = Boolean(
    switchedFromAdmin ||
    Boolean(authSessions?.admin?.token) ||
    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_switched_from_admin') === 'true') ||
    isDeveloperAuthenticated()
  );

  // Cart & Active Table State (Customer specific, initialized from scanned QR if present)
  const [cart, setCart] = useState([]);
  const [activeTable, setActiveTable] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      const t = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');
      if (t) {
        return t.toLowerCase().startsWith('table') ? t : `Table ${t.padStart(2, '0')}`;
      }
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem('flowscape_guest_table');
        if (stored) return stored;
      }
    }
    return 'Table 04';
  });

  // Navigation & View State
  // Main/Default link belongs to Admin/Owner; Customer view accessible strictly via QR; Developer Console via #manj
  const [currentRole, setCurrentRole] = useState(() => {
    if (typeof window === 'undefined') return 'admin';
    const urlParams = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashQuery);
    const tableParam = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');
    const qrParam = urlParams.get('qr') || hashParams.get('qr');
    const hasSessionQr = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_guest_scanned_qr') === 'true';

    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().split('?')[0];
    const route = rawHash || rawPath;

    // 1. Guest scanning a table QR code: open customer dining view
    if (tableParam || qrParam || (route === 'customer' && hasSessionQr)) {
      return 'customer';
    }

    // 2. Developer Superadmin dashboard (strictly accessible via direct #manj link)
    if (route === 'manj') {
      return 'developer';
    }

    // 3. Counter Staff POS Station
    if (route === 'counter' || route === 'pos' || route === 'kds' || route === 'kitchen') {
      return 'counter';
    }

    // 4. Default / Main link is strictly Owner Admin Back-Office!
    return 'admin';
  });
  const [activeTab, setActiveTab] = useState('menu'); // customer: 'menu','cart','track','chef'
  const [counterSubTab, setCounterSubTab] = useState('orders'); // counter: 'orders','manual','stock','checklist'
  const [adminTab, setAdminTab] = useState('sales');

  // Accessibility, Language & Audio Preferences
  const [language, setLanguage] = useState('en'); // 'en' | 'hi' (PRD Section 7)
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const showAboutChef = chef?.showAboutChef !== false && theme?.showAboutChef !== false;

  useEffect(() => {
    if (!showAboutChef && (activeTab === 'chef' || currentRole === 'chef')) {
      if (currentRole === 'chef') {
        setCurrentRole('customer');
      }
      setActiveTab('menu');
      if (typeof window !== 'undefined' && window.location.hash === '#chef') {
        window.location.hash = 'customer';
      }
    }
  }, [showAboutChef, activeTab, currentRole]);

  // Save changes to localStorage scoped by active business (guarded by loaded business ref to prevent cross-tenant writes)
  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.MENU, activeBusinessId), menu);
    }
  }, [menu, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId), orders);
    }
  }, [orders, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.EXPENSES, activeBusinessId), expenses);
    }
  }, [expenses, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.STAFF, activeBusinessId), staff);
    }
  }, [staff, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.OFFERS, activeBusinessId), offers);
    }
  }, [offers, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.THEME, activeBusinessId), theme);
    }
  }, [theme, activeBusinessId]);

  useEffect(() => {
    if (loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.CHECKLISTS, activeBusinessId), checklists);
    }
  }, [checklists, activeBusinessId]);

  // Dynamic CSS variables for tenant branding (strictly isolated from developer superadmin console)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (currentRole === 'developer') {
      root.style.removeProperty('--primary-blue');
      root.style.removeProperty('--accent-blue-soft');
      return;
    }
    if (theme?.accentColor) {
      root.style.setProperty('--primary-blue', theme.accentColor);
      root.style.setProperty('--accent-blue-soft', `${theme.accentColor}1A`);
    }
  }, [theme?.accentColor, currentRole]);

  // Real-Time Cross-Tab / Cross-Device Synchronization Listener (Tenant-Scoped)
  useEffect(() => {
    const unsubscribe = subscribeSyncEvents((msg) => {
      if (!msg || !msg.type) return;

      // STRICT MULTI-TENANT ISOLATION:
      // Drop any event scoped to a different business!
      if (msg.businessId && msg.businessId !== activeBusinessId && msg.type !== SYNC_EVENTS.BUSINESS_DELETED) {
        return;
      }

      if (msg.type === SYNC_EVENTS.NEW_ORDER) {
        setOrders((prev) => {
          if (prev.some((o) => o.id === msg.payload.id)) return prev;
          return [msg.payload, ...prev];
        });
        if (!isSoundMuted && !msg.isInitial && currentRole === 'counter') {
          playNewOrderChime();
        }
      } else if (msg.type === SYNC_EVENTS.ORDER_STATUS_UPDATED) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === msg.payload.id);
          if (exists) {
            return prev.map((o) => (o.id === msg.payload.id ? { ...o, ...msg.payload } : o));
          }
          return [msg.payload, ...prev];
        });
      } else if (msg.type === SYNC_EVENTS.MENU_UPDATED) {
        setMenu(msg.payload);
      } else if (msg.type === SYNC_EVENTS.OFFERS_UPDATED) {
        setOffers(msg.payload);
      } else if (msg.type === SYNC_EVENTS.EXPENSE_ADDED) {
        setExpenses((prev) => [msg.payload, ...prev]);
      } else if (msg.type === SYNC_EVENTS.CHECKLIST_SUBMITTED) {
        if (msg.payload && msg.payload.id) {
          setChecklists((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (list.some((c) => c.id === msg.payload.id)) {
              return list.map((c) => (c.id === msg.payload.id ? msg.payload : c));
            }
            return [msg.payload, ...list];
          });
        }
      } else if (msg.type === SYNC_EVENTS.THEME_UPDATED) {
        if (msg.payload) setTheme(msg.payload);
      } else if (msg.type === SYNC_EVENTS.CHEF_UPDATED) {
        if (msg.payload) setChef(msg.payload);
      } else if (msg.type === SYNC_EVENTS.STAFF_UPDATED) {
        if (Array.isArray(msg.payload)) setStaff(normalizeStaffCredentials(msg.payload));
      } else if (msg.type === SYNC_EVENTS.BUSINESS_DELETED) {
        if (msg.payload?.businessId === activeBusinessId) {
          const fallbackBiz = getActiveBusiness();
          setActiveBusiness(fallbackBiz.id);
          setActiveBusinessId(fallbackBiz.id);
          window.location.reload();
        }
      }
    }, activeBusinessId);

    return unsubscribe;
  }, [activeBusinessId, currentRole, isSoundMuted]);


  // URL Hash & Parameter Routing Guard
  useEffect(() => {
    const syncFromUrl = () => {
      // 1. Intercept Firebase Auth Action links (Email Verification & Password Reset)
      const urlParams = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);

      const mode = urlParams.get('mode') || hashParams.get('mode');
      const oobCode = urlParams.get('oobCode') || hashParams.get('oobCode') || urlParams.get('code') || hashParams.get('code');

      const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().split('?')[0];
      const route = rawHash || rawPath;

      if (mode === 'verifyEmail' || mode === 'resetPassword' || route === 'verify-email' || route === 'reset-password') {
        setAuthActionState({
          mode: mode || (route.includes('reset') ? 'resetPassword' : 'verifyEmail'),
          oobCode: oobCode || ''
        });
        return; // HALT ROUTING! Do NOT redirect to customer interface!
      }

      const tableParam = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');
      const qrParam = urlParams.get('qr') || hashParams.get('qr');

      // 1. If QR parameters are present, initialize guest table session and open customer menu
      if (tableParam || qrParam) {
        const rawTable = tableParam || '04';
        const cleanTable = rawTable.toLowerCase().startsWith('table')
          ? rawTable
          : `Table ${rawTable.padStart(2, '0')}`;
        setActiveTable(cleanTable);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
          sessionStorage.setItem('flowscape_guest_table', cleanTable);
        }
        setCurrentRole('customer');
        setActiveTab('menu');
        return;
      }

      let targetRole = null;
      if (route === 'manj') {
        targetRole = 'developer';
      } else if (route === 'counter' || route === 'pos' || route === 'kds' || route === 'kitchen') {
        targetRole = 'counter';
      } else if (route === 'portal' || route === 'staff') {
        // Floor staff portal entry
        setAuthModal({ isOpen: true, targetRole: 'counter' });
        return;
      } else if (route === 'chef') {
        targetRole = 'chef';
      } else if (route === 'customer' || route === 'menu') {
        targetRole = 'customer';
      } else {
        // Main / default link: strictly Admin / Owner!
        targetRole = 'admin';
      }

      if (targetRole === 'developer') {
        setCurrentRole('developer');
        return;
      }

      if (targetRole === 'customer' || targetRole === 'chef') {
        const hasQrAccess = checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated();
        if (hasQrAccess) {
          setCurrentRole(targetRole);
          if (targetRole === 'customer') setActiveTab('menu');
          else if (targetRole === 'chef') setActiveTab('chef');
        } else {
          // Guest menu is only accessible via QR: redirect main/default to admin!
          setCurrentRole('admin');
          if (!isAuthenticated('admin')) {
            setAuthModal({ isOpen: true, targetRole: 'admin' });
          }
        }
        return;
      }

      if (targetRole === 'counter') {
        setCurrentRole('counter');
        if (isAuthenticated('counter')) {
          setActiveTab('orders');
          setCounterSubTab('orders');
        } else {
          setAuthModal({ isOpen: true, targetRole: 'counter' });
        }
        return;
      }

      if (targetRole === 'admin') {
        setCurrentRole('admin');
        if (isAuthenticated('admin')) {
          setAdminTab('sales');
          setActiveTab('sales');
        } else {
          setAuthModal({ isOpen: true, targetRole: 'admin' });
        }
        return;
      }
    };

    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [currentRole, showAboutChef, canReturnToAdmin]);

  // Active in-progress orders count
  const activeOrdersCount = orders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected').length;

  // Handle Order Placement from Customer
  const handlePlaceOrder = (newOrder) => {
    const orderWithBiz = { ...newOrder, businessId: activeBusinessId };
    setOrders((prev) => [orderWithBiz, ...prev]);
    // Celebratory confetti
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });
    // Kitchen chime sound
    if (!isSoundMuted) {
      playNewOrderChime();
    }
    setActiveTab('track');
  };

  // Reset demo state helper
  const handleResetDemo = () => {
    playTapSound();
    if (window.confirm('Reset all demo data (menu, orders, expenses, staff & sessions) to fresh defaults?')) {
      resetAllDataToDefault(activeBusinessId);
      resetAllSessions();
      setAuthSessions(getStoredSessions());
      setMenu(initialMenu);
      setChef(verifiedChefData);
      setOrders(activeBusinessId === 'biz_advait' ? initialOrders : []);
      setExpenses(activeBusinessId === 'biz_advait' ? initialExpenses : []);
      setStaff(activeBusinessId === 'biz_advait' ? initialStaff : []);
      setOffers(activeBusinessId === 'biz_advait' ? initialOffers : []);
      setTheme(initialTheme);
      setChecklists([]);
      setCart([]);
    }
  };

  // Helper to load scoped tenant business data
  const loadBusinessData = (bizId, bizObj = null) => {
    loadedBusinessIdRef.current = bizId;
    setCart([]); // Clear any items left in cart from another restaurant

    const isDefault = !bizId || bizId === 'biz_advait';
    const biz = bizObj || getBusinesses().find((b) => b.id === bizId);

    if (biz && Array.isArray(biz.tables) && biz.tables.length > 0) {
      if (!biz.tables.includes(activeTable)) {
        setActiveTable(biz.tables[0]);
      }
    }

    const loadedMenu = loadData(getScopedKey(STORAGE_KEYS.MENU, bizId), initialMenu);
    const loadedOrders = loadData(getScopedKey(STORAGE_KEYS.ORDERS, bizId), isDefault ? initialOrders : []);
    const loadedExpenses = loadData(getScopedKey(STORAGE_KEYS.EXPENSES, bizId), isDefault ? initialExpenses : []);
    const loadedStaff = normalizeStaffCredentials(loadData(getScopedKey(STORAGE_KEYS.STAFF, bizId), isDefault ? initialStaff : []));
    const loadedOffers = loadData(getScopedKey(STORAGE_KEYS.OFFERS, bizId), isDefault ? initialOffers : []);
    const loadedChecklists = loadData(getScopedKey(STORAGE_KEYS.CHECKLISTS, bizId), []);

    const loadedTheme = loadData(getScopedKey(STORAGE_KEYS.THEME, bizId), initialTheme);
    const bizOverride = biz ? {
      restaurantName: biz.name,
      tagline: biz.tagline || loadedTheme?.tagline,
      upiId: biz.upiId || loadedTheme?.upiId,
      accentColor: biz.accentColor || loadedTheme?.accentColor,
      logo: biz.logo !== undefined ? biz.logo : (loadedTheme?.logo || null),
      tables: Array.isArray(biz.tables) && biz.tables.length > 0 ? biz.tables : (loadedTheme?.tables || initialTheme.tables)
    } : {};

    setMenu(loadedMenu);
    setChef(loadData(getScopedKey(STORAGE_KEYS.CHEF, bizId), verifiedChefData));
    setOrders(loadedOrders);
    setExpenses(loadedExpenses);
    setStaff(loadedStaff);
    setOffers(loadedOffers);
    setChecklists(loadedChecklists);
    setTheme({
      ...initialTheme,
      ...loadedTheme,
      ...bizOverride,
      logo: bizOverride.logo !== undefined ? bizOverride.logo : (loadedTheme?.logo || null)
    });
  };

  // Launch / Switch to Tenant Workspace from Developer Superadmin
  const handleSwitchToTenantApp = (biz, targetRole = 'admin') => {
    setActiveBusiness(biz.id);
    setActiveBusinessId(biz.id);
    loadBusinessData(biz.id, biz);

    if (targetRole === 'admin') {
      const currentSessions = getStoredSessions();
      currentSessions.admin = {
        role: 'admin',
        businessId: biz.id,
        businessName: biz.name,
        name: biz.owner.name,
        email: biz.owner.email,
        token: `admin_${biz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: 'admin'
      };
      saveStoredSessions(currentSessions);
      setAuthSessions(currentSessions);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_switched_from_admin', 'true');
      }
      setSwitchedFromAdmin(true);
    }

    setCurrentRole(targetRole);
    window.location.hash = targetRole;
    if (targetRole === 'admin') { setAdminTab('sales'); setActiveTab('sales'); }
    else if (targetRole === 'counter') { setActiveTab('orders'); setCounterSubTab('orders'); }
    else if (targetRole === 'customer') setActiveTab('menu');
  };

  // Switch role helper with Authentication Verification & Hierarchy Enforcement
  const handleRoleSwitch = (role) => {
    playTapSound();
    const sessions = authSessions || getStoredSessions();
    const hasAdminAccess = Boolean(
      switchedFromAdmin ||
      sessions?.admin?.token ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_switched_from_admin') === 'true') ||
      isDeveloperAuthenticated()
    );

    // If switching from admin to counter, record that this session originated from admin
    if (currentRole === 'admin' && role === 'counter') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_switched_from_admin', 'true');
      }
      setSwitchedFromAdmin(true);

      // Ensure an active admin session token is recorded
      const currentSessions = getStoredSessions();
      if (!currentSessions.admin?.token) {
        const activeBiz = getActiveBusiness();
        currentSessions.admin = {
          role: 'admin',
          businessId: activeBiz.id,
          businessName: activeBiz.name,
          name: activeBiz.owner.name,
          email: activeBiz.owner.email,
          token: `admin_${activeBiz.id}_${Date.now()}`,
          authenticatedAt: new Date().toISOString(),
          authenticatedBy: 'admin'
        };
        saveStoredSessions(currentSessions);
        setAuthSessions(currentSessions);
      }
    }

    // Counter person who directly logged into live POS cannot access admin
    if (currentRole === 'counter' && role === 'admin') {
      if (!hasAdminAccess) {
        alert('Access Denied: Counter staff cannot access Owner Back-Office. Counter permissions are limited to Counter POS.');
        return;
      }
    }

    // Developer Superadmin role check (#manj)
    if (role === 'developer') {
      setCurrentRole('developer');
      window.location.hash = 'manj';
      return;
    }

    // Customer Menu Access Check (Accessible ONLY via QR code or admin preview)
    if (role === 'customer' || role === 'chef') {
      const hasQrAccess = checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated();
      if (!hasQrAccess) {
        alert('Access Notice: Guest dining menus are strictly accessible via table QR codes. Please scan a table QR code standee or open from the Admin Back-Office.');
        return;
      }
    }

    // Check authentication with role hierarchy
    if (role !== 'customer' && !isAuthenticated(role, currentRole)) {
      setAuthModal({ isOpen: true, targetRole: role });
      return;
    }

    setCurrentRole(role);
    window.location.hash = role === 'developer' ? 'manj' : role;
    if (role === 'customer') {
      setActiveTab('menu');
    } else if (role === 'chef') {
      setActiveTab('chef');
    } else if (role === 'counter') {
      setActiveTab('orders');
      setCounterSubTab('orders');
    } else if (role === 'admin') {
      setAdminTab('sales');
      setActiveTab('sales');
    }
  };

  // Auth Success Handler
  const handleAuthSuccess = (newSession, matchedBusiness) => {
    const role = newSession.role;

    if (role === 'counter') {
      // Direct login to live POS: strictly clear any admin session and switched-from-admin flag
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('flowscape_switched_from_admin');
      }
      setSwitchedFromAdmin(false);
      const currentSessions = getStoredSessions();
      currentSessions.admin = null;
      saveStoredSessions(currentSessions);
      setAuthSessions(currentSessions);
    } else if (role === 'admin') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_switched_from_admin', 'true');
      }
      setSwitchedFromAdmin(true);
      const updated = getStoredSessions();
      setAuthSessions(updated);
    } else {
      const updated = getStoredSessions();
      setAuthSessions(updated);
    }

    if (newSession.staffId) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('counter_active_staff_id', newSession.staffId);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('counter_active_staff_id');
        }
      } catch {}
    }

    setAuthActionState(null);
    setAuthModal({ isOpen: false, targetRole: null });

    if (matchedBusiness) {
      setActiveBusiness(matchedBusiness.id);
      setActiveBusinessId(matchedBusiness.id);
      loadBusinessData(matchedBusiness.id, matchedBusiness);
    }

    if (role === 'counter') {
      setCurrentRole('counter');
      window.location.hash = 'counter';
      setActiveTab('orders');
      setCounterSubTab('orders');
    } else if (role === 'developer') {
      setCurrentRole('developer');
      window.location.hash = 'manj';
    } else {
      // Direct redirection straight to the Admin Dashboard
      setCurrentRole('admin');
      window.location.hash = 'admin';
      setAdminTab('sales');
      setActiveTab('sales');
    }
  };

  // Logout Role Handler
  const handleLogoutRole = (roleToLogout) => {
    playTapSound();
    logoutRole(roleToLogout);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('flowscape_switched_from_admin');
    }
    setSwitchedFromAdmin(false);
    const updated = getStoredSessions();
    setAuthSessions(updated);

    // Return safely to default Admin / Owner login view, never customer
    setCurrentRole('admin');
    window.location.hash = 'admin';
    setAdminTab('sales');
    setActiveTab('sales');
    setAuthModal({ isOpen: true, targetRole: 'admin' });
  };

  const cartTotal = cart.reduce((a, b) => a + b.price * b.quantity, 0);
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  // Dedicated Render for Email Verification & Password Reset (Without redirecting to customer interface)
  if (authActionState) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', background: '#0B0F19' }}>
        <AuthActionView
          actionState={authActionState}
          theme={theme}
          onOpenLogin={() => {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {}
            setAuthActionState(null);
            setCurrentRole('admin');
            window.location.hash = 'admin';
            setAuthModal({ isOpen: true, targetRole: 'admin' });
          }}
        />

        {/* Mounted AuthModal so clicking 'Go to Owner Login' pops up login smoothly */}
        <AuthModal
          isOpen={authModal.isOpen}
          targetRole={authModal.targetRole || 'admin'}
          activeSessionRole={authSessions?.admin?.token ? 'admin' : authSessions?.counter?.token ? 'counter' : currentRole}
          onSuccess={handleAuthSuccess}
          onClose={() => {
            setAuthModal({ isOpen: false, targetRole: null });
            if (currentRole !== authModal.targetRole) {
              window.location.hash = currentRole || 'admin';
            }
          }}
          theme={theme}
          staff={staff}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Dynamic Header: Clean & Isolated for Customer with QR, Workstation for Authenticated Staff */}
      {currentRole !== 'developer' && (
        (currentRole === 'customer' || currentRole === 'chef'
          ? (checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated())
          : (isAuthenticated(currentRole) || isDeveloperAuthenticated())) && (
          <Header
            chef={chef}
            theme={theme}
            currentRole={currentRole}
            onRoleSwitch={handleRoleSwitch}
            activeTable={activeTable}
            setActiveTable={setActiveTable}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearchOpen={isSearchOpen}
            setIsSearchOpen={setIsSearchOpen}
            activeOrdersCount={activeOrdersCount}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onOpenCart={() => {
              setCurrentRole('customer');
              setActiveTab('cart');
            }}
            onResetDemo={handleResetDemo}
            authSessions={authSessions}
            onLogoutRole={handleLogoutRole}
            onOpenTableQr={() => setIsTableQrOpen(true)}
            language={language}
            onToggleLanguage={() => setLanguage((l) => (l === 'en' ? 'hi' : 'en'))}
            isSoundMuted={isSoundMuted}
            onToggleSound={() => setIsSoundMuted((m) => !m)}
            canReturnToAdmin={canReturnToAdmin}
          />
        )
      )}

      {/* Main Full-Viewport Content Area */}
      <main className="app-main-viewport">
        <div className="app-content-container">
          {/* Dynamic Views Rendering */}
          {(currentRole === 'customer' || currentRole === 'chef') && (
            !(checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated()) ? (
              <QrCodeGate
                onReturnToAdmin={() => handleRoleSwitch('admin')}
              />
            ) : (activeTab === 'chef' || currentRole === 'chef') && showAboutChef ? (
              <AboutChefView
                chef={chef}
                menu={menu}
                theme={theme}
                onAddToCart={(item) => {
                  setCart((prev) => [...prev, { ...item, quantity: 1, note: "Chef's Signature Recommendation" }]);
                  setCurrentRole('customer');
                  setActiveTab('cart');
                }}
                onGoToMenu={() => {
                  setCurrentRole('customer');
                  setActiveTab('menu');
                }}
              />
            ) : (
              <CustomerView
                activeBusinessId={activeBusinessId}
                menu={menu}
                chef={chef}
                theme={theme}
                activeTable={activeTable}
                setActiveTable={setActiveTable}
                orders={orders}
                cart={cart}
                setCart={setCart}
                onPlaceOrder={handlePlaceOrder}
                onGoToChef={() => setActiveTab('chef')}
                searchQuery={searchQuery}
                offers={offers}
                language={language}
                onOpenStaffPortal={() => setAuthModal({ isOpen: true, targetRole: 'counter' })}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )
          )}

          {currentRole === 'counter' && (
            !(isAuthenticated('counter') || canReturnToAdmin || isDeveloperAuthenticated()) ? (
              <CounterLoginGate
                onOpenLogin={() => setAuthModal({ isOpen: true, targetRole: 'counter' })}
                onReturnToAdmin={() => handleRoleSwitch('admin')}
              />
            ) : (
              <CounterView
                activeBusinessId={activeBusinessId}
                orders={orders}
                setOrders={setOrders}
                menu={menu}
                setMenu={setMenu}
                offers={offers}
                setOffers={setOffers}
                theme={theme}
                setTheme={setTheme}
                chef={chef}
                checklists={checklists}
                setChecklists={setChecklists}
                activeSubTab={counterSubTab}
                setActiveSubTab={setCounterSubTab}
                canReturnToAdmin={canReturnToAdmin}
                onReturnToAdmin={() => handleRoleSwitch('admin')}
                staff={staff}
                setStaff={setStaff}
              />
            )
          )}

          {currentRole === 'admin' && (
            !(isAuthenticated('admin') || isDeveloperAuthenticated()) ? (
              <AdminOwnerLoginGate
                onOpenLogin={() => setAuthModal({ isOpen: true, targetRole: 'admin' })}
                onSwitchRole={handleRoleSwitch}
                theme={theme}
              />
            ) : (
              <AdminView
                activeBusinessId={activeBusinessId}
                orders={orders}
                setOrders={setOrders}
                menu={menu}
                setMenu={setMenu}
                expenses={expenses}
                setExpenses={setExpenses}
                staff={staff}
                setStaff={setStaff}
                theme={theme}
                setTheme={setTheme}
                chef={chef}
                setChef={setChef}
                checklists={checklists}
                setChecklists={setChecklists}
                offers={offers}
                setOffers={setOffers}
                activeAdminTab={adminTab}
                setActiveAdminTab={setAdminTab}
                onOpenTableQr={() => setIsTableQrOpen(true)}
              />
            )
          )}

          {currentRole === 'developer' && (
            <DeveloperAdminView
              onSwitchToApp={handleSwitchToTenantApp}
              onRoleSwitch={handleRoleSwitch}
            />
          )}
        </div>
      </main>

      {/* Mobile-Only Bottom Navigation Dock (Role-Aware and Cleanly Isolated) */}
      {(currentRole === 'customer' || currentRole === 'chef'
        ? (checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated())
        : (isAuthenticated(currentRole) || isDeveloperAuthenticated())) && (
        <BottomNav
          currentRole={currentRole}
          activeTab={
            currentRole === 'customer' || currentRole === 'chef'
              ? activeTab
              : currentRole === 'counter'
              ? counterSubTab
              : adminTab
          }
          setActiveTab={(tabId) => {
            if (currentRole === 'customer' || currentRole === 'chef') {
              if (currentRole === 'chef') {
                setCurrentRole('customer');
              }
              setActiveTab(tabId);
            } else if (currentRole === 'counter') {
              setCounterSubTab(tabId);
            } else if (currentRole === 'admin') {
              setAdminTab(tabId);
            }
          }}
          authSessions={authSessions}
          onRoleSwitch={handleRoleSwitch}
          cartCount={cartCount}
          activeOrdersCount={activeOrdersCount}
          language={language}
          theme={theme}
          chef={chef}
          showAboutChef={showAboutChef}
        />
      )}

      {/* Interface Specific Authentication Modal / Staff Station Gate */}
      <AuthModal
        isOpen={authModal.isOpen}
        targetRole={authModal.targetRole}
        activeSessionRole={authSessions?.admin?.token ? 'admin' : authSessions?.counter?.token ? 'counter' : currentRole}
        onSuccess={handleAuthSuccess}
        onClose={() => {
          setAuthModal({ isOpen: false, targetRole: null });
          if (currentRole !== authModal.targetRole) {
            window.location.hash = currentRole === 'developer' ? 'manj' : (currentRole || 'admin');
          }
        }}
        theme={theme}
        staff={staff}
      />

      {/* Table QR Standee & Direct Order Link Modal */}
      <TableQrModal
        isOpen={isTableQrOpen}
        onClose={() => setIsTableQrOpen(false)}
        activeTable={activeTable}
        setActiveTable={setActiveTable}
        tables={theme.tables}
        restaurantName={theme.restaurantName}
        logo={theme.logo}
        tagline={theme.tagline}
      />
    </div>
  );
}
