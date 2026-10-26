import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import TableQrModal from './components/TableQrModal';
import CookieBanner from './components/CookieBanner';
import LegalModal from './components/LegalModal';
import { AdminOwnerLoginGate, CounterLoginGate, QrCodeGate } from './components/AccessGates';
import CustomerView from './views/CustomerView';
import AboutChefView from './views/AboutChefView';
import CounterView from './views/CounterView';
import AdminView from './views/AdminView';
import DeveloperAdminView from './views/DeveloperAdminView';
import AuthActionView from './views/AuthActionView';
import AccountDeletedView from './views/AccountDeletedView';
import {
  initialMenu,
  initialMenuByBusiness,
  verifiedChefData,
  initialOrders,
  initialExpenses,
  initialStaff,
  initialStaffByBusiness,
  initialOffers,
  initialTheme,
  getInitialThemeForBusiness
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
import { syncAllBusinessesToCloud, subscribeBusinessesFromCloud, fetchBusinessesFromCloud } from './utils/systematicDatabase';
import { subscribeSyncEvents, SYNC_EVENTS } from './utils/sync';
import { saveSubmittedReportToIndexedDB, fetchAllSubmittedReportsFromIndexedDB } from './utils/ownerDatabase';
import { fetchOrdersFromCloud, syncOrderToCloud } from './utils/firebaseSync';
import confetti from 'canvas-confetti';
import { Server, Building2, PlusCircle } from 'lucide-react';

import {
  sanitizeTableFromParam,
  verifyTableSignature,
  verifyOrLockTable
} from './utils/tableSecurity';
import {
  detectFreshQrScan,
  isCustomerSessionExpired,
  wipeAllCustomerData,
  markQrScanConsumed,
  getCustomerStorageKeys
} from './utils/customerSessionManager';
import { sanitizeTenantParameter, validateTenantOwnership } from './utils/authorizationGuard';

export { sanitizeTableFromParam };

/**
 * Check if current guest session has valid QR code access
 * (Customer menu is strictly accessible only via physical table QR codes with authentic cryptographic signature)
 */
export const checkGuestQrAccess = () => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  const hashParams = new URLSearchParams(hashQuery);

  const tableParam = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');
  const sigParam = urlParams.get('sig') || hashParams.get('sig');
  const bizParam = urlParams.get('biz') || hashParams.get('biz') || urlParams.get('b') || hashParams.get('b');

  // 1. If customer already has an active verified table session in sessionStorage:
  const hasSessionQr = typeof sessionStorage !== 'undefined' && (
    sessionStorage.getItem('flowscape_guest_scanned_qr') === 'true' &&
    Boolean(sessionStorage.getItem('flowscape_guest_table'))
  );
  if (hasSessionQr) return true;

  // 2. Physical QR code scan containing authentic cryptographic table signature:
  if (tableParam && sigParam && bizParam) {
    if (verifyTableSignature(bizParam, tableParam, sigParam)) {
      return true;
    }
  }

  // 3. Fallback for QR param if session is verified
  const hasQrParam = Boolean(urlParams.get('qr') || hashParams.get('qr'));
  if (hasQrParam && hasSessionQr) return true;

  return false;
};

export const normalizeStaffCredentials = (staffList) => {
  if (!Array.isArray(staffList)) return [];
  return staffList.map((emp, idx) => {
    const defaultLoginId = emp.loginId || (emp.name ? emp.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.pos' : `staff${idx + 1}.pos`);
    let rawPin = emp.pin ? String(emp.pin).trim() : String(440100 + idx);
    if (rawPin.length < 6) {
      rawPin = rawPin.padEnd(6, '0');
    }
    return {
      ...emp,
      loginId: defaultLoginId,
      pin: rawPin.slice(0, 6)
    };
  });
};

export const getInitialBusinessId = () => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashQuery);
    const rawBizParam = urlParams.get('biz') || hashParams.get('biz') || urlParams.get('b') || hashParams.get('b');
    const bizParam = sanitizeTenantParameter(rawBizParam);
    if (bizParam) {
      const cleanBizId = bizParam.trim();
      const businesses = getBusinesses();
      const match = businesses.find((b) => b.id.toLowerCase() === cleanBizId.toLowerCase());
      const resolvedId = match ? match.id : cleanBizId;
      setActiveBusiness(resolvedId);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_guest_scanned_biz', resolvedId);
        sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
      }
      return resolvedId;
    }
    if (typeof sessionStorage !== 'undefined') {
      try {
        const rawSessions = sessionStorage.getItem('flowscape_auth_sessions_v3');
        if (rawSessions) {
          const sessions = JSON.parse(rawSessions);
          const activeSessionBizId = sessions?.admin?.businessId || sessions?.counter?.businessId;
          if (activeSessionBizId) {
            const businesses = getBusinesses();
            const match = businesses.find((b) => b.id === activeSessionBizId);
            if (match) {
              setActiveBusiness(match.id);
              return match.id;
            }
          }
        }
      } catch {}

      const sessionBiz = sessionStorage.getItem('flowscape_guest_scanned_biz');
      if (sessionBiz) {
        const businesses = getBusinesses();
        const match = businesses.find((b) => b.id === sessionBiz);
        const resolvedId = match ? match.id : sessionBiz;
        setActiveBusiness(resolvedId);
        return resolvedId;
      }
    }
  }
  const currentActive = getActiveBusiness();
  return currentActive?.id || '';
};

export default function App() {
  const initialBizId = getInitialBusinessId();
  const initialBiz = getBusinesses().find((b) => b.id === initialBizId) || getActiveBusiness();

  const [activeBusinessId, setActiveBusinessId] = useState(initialBizId);
  const loadedBusinessIdRef = useRef(initialBizId);
  const isSwitchingTenantRef = useRef(false);

  // Global Shared States (Persisted in localStorage scoped by active business)
  const [menu, setMenu] = useState(() => {
    const scoped = loadData(getScopedKey(STORAGE_KEYS.MENU, initialBizId), null);
    if (Array.isArray(scoped) && scoped.length > 0) return scoped;
    if (initialBiz?.menu && Array.isArray(initialBiz.menu) && initialBiz.menu.length > 0) return initialBiz.menu;
    return [];
  });
  const [chef, setChef] = useState(() => loadData(getScopedKey(STORAGE_KEYS.CHEF, initialBizId), verifiedChefData));
  const [orders, setOrders] = useState(() => {
    return loadData(getScopedKey(STORAGE_KEYS.ORDERS, initialBizId), []);
  });
  const [expenses, setExpenses] = useState(() => loadData(getScopedKey(STORAGE_KEYS.EXPENSES, initialBizId), []));
  const [staff, setStaff] = useState(() => {
    const raw = loadData(getScopedKey(STORAGE_KEYS.STAFF, initialBizId), initialBiz?.staff || []);
    return normalizeStaffCredentials(raw);
  });
  const [offers, setOffers] = useState(() => loadData(getScopedKey(STORAGE_KEYS.OFFERS, initialBizId), []));
  const [theme, setTheme] = useState(() => {
    const initialBizTheme = getInitialThemeForBusiness(initialBizId);
    const loaded = loadData(getScopedKey(STORAGE_KEYS.THEME, initialBizId), initialBizTheme);
    const activeBiz = initialBiz || getActiveBusiness();
    const isStall = activeBiz?.serviceType === 'stall' || (activeBiz?.tables?.length === 1 && activeBiz.tables[0].includes('Stand'));
    const bizOverride = activeBiz ? {
      restaurantName: activeBiz.name,
      tagline: activeBiz.tagline !== undefined ? activeBiz.tagline : (loaded?.tagline || initialBizTheme.tagline),
      upiId: activeBiz.upiId !== undefined ? activeBiz.upiId : (loaded?.upiId || initialBizTheme.upiId),
      accentColor: activeBiz.accentColor || loaded?.accentColor || initialBizTheme.accentColor,
      logo: activeBiz.logo !== undefined ? activeBiz.logo : (loaded?.logo || null),
      tables: Array.isArray(activeBiz.tables) && activeBiz.tables.length > 0 ? activeBiz.tables : (loaded?.tables || initialBizTheme.tables),
      serviceType: activeBiz.serviceType || loaded?.serviceType || (isStall ? 'stall' : 'dine_in'),
      tableCount: activeBiz.tableCount !== undefined ? activeBiz.tableCount : (loaded?.tableCount || 6),
      welcomeMessage: activeBiz.welcomeMessage || loaded?.welcomeMessage || initialBizTheme.welcomeMessage,
      menuLayout: activeBiz.menuLayout || loaded?.menuLayout || initialBizTheme.menuLayout,
      showAboutChef: activeBiz.showAboutChef !== undefined ? activeBiz.showAboutChef : (loaded?.showAboutChef !== false),
      address: activeBiz.address !== undefined ? activeBiz.address : (loaded?.address || ''),
      fssai: (activeBiz.fssai || activeBiz.fssaiLicense) !== undefined ? (activeBiz.fssai || activeBiz.fssaiLicense) : (loaded?.fssai || loaded?.fssaiLicense || '')
    } : {};
    return {
      ...initialBizTheme,
      ...loaded,
      ...bizOverride,
      logo: bizOverride.logo !== undefined ? bizOverride.logo : (loaded?.logo || null),
      upiId: loaded?.upiId || bizOverride.upiId || initialBizTheme.upiId || '',
      address: bizOverride.address !== undefined ? bizOverride.address : (loaded?.address || ''),
      fssai: bizOverride.fssai !== undefined ? bizOverride.fssai : (loaded?.fssai || loaded?.fssaiLicense || '')
    };
  });
  const [checklists, setChecklists] = useState(() => loadData(getScopedKey(STORAGE_KEYS.CHECKLISTS, initialBizId), []));

  // Authentication State
  const [authSessions, setAuthSessions] = useState(() => getStoredSessions());
  const [authModal, setAuthModal] = useState({ isOpen: false, targetRole: null });
  const [isTableQrOpen, setIsTableQrOpen] = useState(false);
  const [legalModal, setLegalModal] = useState({ isOpen: false, tab: 'privacy' });

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
    (Boolean(authSessions?.admin?.token) && (switchedFromAdmin || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_switched_from_admin') === 'true'))) ||
    isDeveloperAuthenticated()
  );

  // Cart & Active Table State (Customer specific, initialized from scanned QR if present)
  const [cart, setCart] = useState(() => {
    if (detectFreshQrScan() || isCustomerSessionExpired()) {
      wipeAllCustomerData(initialBizId);
      markQrScanConsumed();
      return [];
    }
    return [];
  });

  // Automatically wipe customer cart & session if a fresh QR scan is detected or 2-hour inactivity expired
  useEffect(() => {
    if (detectFreshQrScan() || isCustomerSessionExpired()) {
      setCart([]);
      wipeAllCustomerData(activeBusinessId);
      markQrScanConsumed(activeTable);
    }
  }, [activeBusinessId]);
  const [activeTable, setActiveTable] = useState(() => {
    const activeBiz = initialBiz || getActiveBusiness();
    const isStall = activeBiz?.serviceType === 'stall' || (activeBiz?.tables?.length === 1 && activeBiz.tables[0].includes('Stand'));
    const defaultTable = isStall ? 'Counter / Stand & Eat' : (activeBiz?.tables?.[0] || 'Table 04');

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      const t = urlParams.get('table') || hashParams.get('table') || urlParams.get('t') || hashParams.get('t');
      const sig = urlParams.get('sig') || hashParams.get('sig');
      const biz = urlParams.get('biz') || hashParams.get('biz') || urlParams.get('b') || hashParams.get('b') || initialBizId;

      const isPrivileged = isDeveloperAuthenticated() || Boolean(
        typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_switched_from_admin') === 'true'
      );

      const check = verifyOrLockTable(biz, t, sig, isPrivileged, defaultTable);

      // If URL tampering was attempted (e.g. user modified ?table=XX in URL while locked to another table):
      if (!check.valid && check.reason === 'tamper_blocked') {
        try {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('table', check.table.replace(/\D/g, '') || check.table);
          window.history.replaceState(null, '', currentUrl.toString());
        } catch {}
      }

      return check.table;
    }
    return defaultTable;
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
    const bizParam = urlParams.get('biz') || hashParams.get('biz') || urlParams.get('b') || hashParams.get('b');
    const hasSessionQr = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('flowscape_guest_scanned_qr') === 'true';

    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase().split('?')[0];
    const route = rawHash || rawPath;

    // 1. Guest scanning a table QR code: open customer dining view
    if (tableParam || qrParam || route === 'customer' || hasSessionQr || (bizParam && route !== 'admin' && route !== 'counter' && route !== 'manj')) {
      if (route !== 'manj' && route !== 'developer') {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
        }
        return 'customer';
      }
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

  // Dedicated state for Account and Data Deleted screen
  const [deletedAccountNotice, setDeletedAccountNotice] = useState(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem('flowscape_deleted_account_notice');
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return null;
  });

  const triggerAccountDeletedNotice = (info) => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_deleted_account_notice', JSON.stringify(info));
      }
    } catch {}
    setDeletedAccountNotice(info);
  };

  const clearAccountDeletedNotice = () => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('flowscape_deleted_account_notice');
      }
    } catch {}
    setDeletedAccountNotice(null);
  };

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

  // Save changes to localStorage scoped by active business (guarded by loaded business ref and switching flag to prevent cross-tenant writes)
  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.MENU, activeBusinessId), menu);
    }
  }, [menu, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      if (!activeBusinessId) return;
      const orderKey = getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId);
      const existingInStorage = loadData(orderKey, []);
      if (Array.isArray(existingInStorage) && existingInStorage.length > 0) {
        const mergedMap = new Map();
        (orders || []).forEach((o) => { if (o && o.id) mergedMap.set(o.id, o); });
        existingInStorage.forEach((o) => {
          if (o && o.id && !mergedMap.has(o.id)) {
            mergedMap.set(o.id, o);
          }
        });
        saveData(orderKey, Array.from(mergedMap.values()));
      } else {
        saveData(orderKey, orders);
      }
    }
  }, [orders, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.EXPENSES, activeBusinessId), expenses);
    }
  }, [expenses, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.STAFF, activeBusinessId), staff);
    }
  }, [staff, activeBusinessId]);

  // Systematic Multi-Tenant Database Sync: Keep all business accounts synchronized to Firestore in real-time
  useEffect(() => {
    // 1. Fetch all cloud businesses on launch
    fetchBusinessesFromCloud().then((cloudBiz) => {
      // If cloud was empty, seed with initial businesses
      if (Array.isArray(cloudBiz) && cloudBiz.length === 0) {
        syncAllBusinessesToCloud().catch(() => {});
      }
    }).catch(() => {});

    // 2. Subscribe to real-time updates from Firestore businesses collection
    const unsubscribeCloud = subscribeBusinessesFromCloud(() => {
      // Real-time updates automatically merged into local businesses and dispatched
    });

    return () => {
      if (unsubscribeCloud) unsubscribeCloud();
    };
  }, []);

  // React immediately whenever businesses are merged or updated from the cloud
  useEffect(() => {
    const handleBusinessesUpdated = (e) => {
      const updatedBusinesses = e.detail || getBusinesses();
      if (Array.isArray(updatedBusinesses) && updatedBusinesses.length > 0) {
        const targetId = activeBusinessId || getInitialBusinessId();
        const currentBiz = updatedBusinesses.find((b) => b.id.toLowerCase() === (targetId || '').toLowerCase()) || getActiveBusiness() || updatedBusinesses[0];
        if (currentBiz) {
          if (!activeBusinessId || activeBusinessId !== currentBiz.id) {
            setActiveBusinessId(currentBiz.id);
            setActiveBusiness(currentBiz.id);
          }
          setTheme((prev) => ({
            ...prev,
            restaurantName: currentBiz.name || prev.restaurantName,
            tagline: currentBiz.tagline !== undefined ? currentBiz.tagline : prev.tagline,
            upiId: currentBiz.upiId !== undefined ? currentBiz.upiId : prev.upiId,
            accentColor: currentBiz.accentColor || prev.accentColor,
            logo: currentBiz.logo !== undefined ? currentBiz.logo : prev.logo,
            tables: Array.isArray(currentBiz.tables) && currentBiz.tables.length > 0 ? currentBiz.tables : prev.tables,
            serviceType: currentBiz.serviceType || prev.serviceType || 'dine_in',
            tableCount: currentBiz.tableCount !== undefined ? currentBiz.tableCount : prev.tableCount,
            welcomeMessage: currentBiz.welcomeMessage !== undefined ? currentBiz.welcomeMessage : prev.welcomeMessage,
            menuLayout: currentBiz.menuLayout || prev.menuLayout,
            showAboutChef: currentBiz.showAboutChef !== undefined ? currentBiz.showAboutChef : prev.showAboutChef,
            address: currentBiz.address !== undefined ? currentBiz.address : (prev.address || ''),
            fssai: (currentBiz.fssai || currentBiz.fssaiLicense) !== undefined ? (currentBiz.fssai || currentBiz.fssaiLicense) : (prev.fssai || '')
          }));
          if (currentBiz.chef) {
            setChef((prev) => ({ ...prev, ...currentBiz.chef }));
          }
          if (Array.isArray(currentBiz.menu) && currentBiz.menu.length > 0) {
            setMenu((prev) => (prev.length === 0 ? currentBiz.menu : prev));
          }
        }
      }
    };

    window.addEventListener('flowscape_businesses_updated', handleBusinessesUpdated);
    return () => window.removeEventListener('flowscape_businesses_updated', handleBusinessesUpdated);
  }, [activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.OFFERS, activeBusinessId), offers);
    }
  }, [offers, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.THEME, activeBusinessId), theme);
    }
  }, [theme, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.CHEF, activeBusinessId), chef);
    }
  }, [chef, activeBusinessId]);

  useEffect(() => {
    if (!isSwitchingTenantRef.current && loadedBusinessIdRef.current === activeBusinessId) {
      saveData(getScopedKey(STORAGE_KEYS.CHECKLISTS, activeBusinessId), checklists);
    }
  }, [checklists, activeBusinessId]);

  // Fast IndexedDB retrieval on mount or tenant switch so checklists memory is never lost
  useEffect(() => {
    let isMounted = true;
    if (activeBusinessId) {
      fetchAllSubmittedReportsFromIndexedDB(activeBusinessId).then((reports) => {
        if (isMounted && Array.isArray(reports) && reports.length > 0) {
          setChecklists((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const merged = [...reports];
            list.forEach((item) => {
              if (!merged.some((m) => m.id === item.id)) {
                merged.push(item);
              }
            });
            return merged;
          });
        }
      });
    }
    return () => { isMounted = false; };
  }, [activeBusinessId]);

  // Fast Cloud Orders retrieval on mount or tenant switch so order history & revenue are always retained
  useEffect(() => {
    let isMounted = true;
    if (activeBusinessId) {
      fetchOrdersFromCloud(activeBusinessId).then((cloudOrders) => {
        if (isMounted && Array.isArray(cloudOrders) && cloudOrders.length > 0) {
          setOrders((prev) => {
            const orderKey = getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId);
            const map = new Map();
            cloudOrders.forEach((o) => { if (o && o.id) map.set(o.id, o); });
            (Array.isArray(prev) ? prev : []).forEach((o) => { if (o && o.id) map.set(o.id, o); });
            const merged = Array.from(map.values()).sort((a, b) => {
              const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
              const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
              return timeB - timeA;
            });
            saveData(orderKey, merged);
            return merged;
          });
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [activeBusinessId]);

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

  // Dynamic Browser Tab Title based on Role, Auth State & OnTap Branding
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (currentRole === 'developer') {
      document.title = 'OnTap • Developer Superadmin Console';
      return;
    }

    if (currentRole === 'customer' || currentRole === 'chef') {
      const hasQr = checkGuestQrAccess() || canReturnToAdmin || isDeveloperAuthenticated();
      if (hasQr) {
        document.title = `${theme?.restaurantName || 'OnTap'} • Dining & Menu`;
      } else {
        document.title = 'OnTap • Local Food and drinks | Your community';
      }
      return;
    }

    if (currentRole === 'counter') {
      if (isAuthenticated('counter') || canReturnToAdmin || isDeveloperAuthenticated()) {
        document.title = `${theme?.restaurantName || 'OnTap'} • Counter POS`;
      } else {
        document.title = 'OnTap • Counter POS Terminal';
      }
      return;
    }

    // Default / Admin Owner
    if (isAuthenticated('admin', activeBusinessId) || isDeveloperAuthenticated()) {
      document.title = `${theme?.restaurantName || 'OnTap'} • Owner Back-Office`;
    } else {
      document.title = 'OnTap • Local Food and drinks | Your community';
    }
  }, [currentRole, authSessions, theme?.restaurantName, canReturnToAdmin, activeBusinessId]);

  // BFCache (Back-Forward Cache) Invalidation:
  // Immediately re-validate authentication when navigating back/forward via browser cache
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) {
        const stored = getStoredSessions();
        setAuthSessions(stored);
        if (currentRole === 'admin' && !(stored.admin?.token && stored.admin.businessId === activeBusinessId) && !isDeveloperAuthenticated()) {
          window.location.reload();
        } else if (currentRole === 'counter' && !(stored.counter?.token && stored.counter.businessId === activeBusinessId) && !isDeveloperAuthenticated()) {
          window.location.reload();
        }
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [currentRole, activeBusinessId]);

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
        const incoming = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const newOrders = incoming.filter((item) => item && item.id && !existingIds.has(item.id));
          if (newOrders.length === 0) return prev;
          return [...newOrders, ...prev];
        });
        if (!isSoundMuted && !msg.isInitial && currentRole === 'counter') {
          playNewOrderChime();
        }
      } else if (msg.type === SYNC_EVENTS.ORDER_STATUS_UPDATED) {
        setOrders((prev) => {
          const exists = prev.find((o) => o.id === msg.payload.id);
          if (exists) {
            // Guard: If existing order was served >30 minutes ago, prevent status reversal
            const wasServed = exists.status === 'served' || exists.status === 'done';
            const servedTime = exists.servedAt
              ? new Date(exists.servedAt).getTime()
              : (exists.updatedAt ? new Date(exists.updatedAt).getTime() : new Date(exists.createdAt).getTime());
            const isServedLocked = wasServed && !isNaN(servedTime) && (Date.now() - servedTime >= 30 * 60 * 1000);
            if (isServedLocked && msg.payload.status !== 'served' && msg.payload.status !== 'done') {
              console.warn('[Orders] Prevented reversing status for order served over 30 minutes ago:', exists.id);
              return prev;
            }
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
          saveSubmittedReportToIndexedDB(msg.payload);
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
      } else if (msg.type === SYNC_EVENTS.BUSINESSES_UPDATED || msg.type === SYNC_EVENTS.CREDENTIALS_UPDATED) {
        const freshBiz = getActiveBusiness();
        if (freshBiz) {
          setTheme((prev) => ({
            ...prev,
            restaurantName: freshBiz.name,
            tagline: freshBiz.tagline || prev.tagline,
            upiId: freshBiz.upiId || prev.upiId,
            accentColor: freshBiz.accentColor || prev.accentColor
          }));
        }
      } else if (msg.type === SYNC_EVENTS.BUSINESS_DELETED) {
        if (msg.payload?.businessId === activeBusinessId) {
          handleLogoutRole('admin');
          handleLogoutRole('counter');
          triggerAccountDeletedNotice({
            businessName: theme?.restaurantName || 'Restaurant',
            businessId: msg.payload?.businessId || activeBusinessId
          });
        }
      } else if (msg.type === SYNC_EVENTS.FINANCIALS_RESET) {
        setOrders([]);
        setExpenses([]);
        setCart([]);
        setTheme((prev) => ({
          ...prev,
          cashInHand: 0,
          pendingAggregatorSettlement: 0,
          upcomingObligations: { rent: 0, payroll: 0, emi: 0, dueDate: '' }
        }));
      }
    }, activeBusinessId);

    return unsubscribe;
  }, [activeBusinessId, currentRole, isSoundMuted]);

  // Real-time Storage Event Listener: Synchronize orders instantly across tabs/windows
  useEffect(() => {
    if (!activeBusinessId) return;
    const orderKey = getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId);

    const handleStorageChange = (e) => {
      if (!e.key) return;
      if (e.key === orderKey || e.key.startsWith('flowscape_order_ping_') || e.key === 'flowscape_sync_event_ping') {
        try {
          const freshOrders = loadData(orderKey, []);
          if (Array.isArray(freshOrders)) {
            setOrders((prev) => {
              const existingIds = new Set(prev.map((o) => o.id));
              const missing = freshOrders.filter((o) => o && o.id && !existingIds.has(o.id));
              if (missing.length === 0) {
                const prevMap = new Map(prev.map((o) => [o.id, `${o.status}-${o.paymentStatus}`]));
                const hasChange = freshOrders.some((o) => o && prevMap.get(o.id) !== `${o.status}-${o.paymentStatus}`);
                return hasChange ? freshOrders : prev;
              }
              if (currentRole === 'counter' && !isSoundMuted) {
                playNewOrderChime();
              }
              return [...missing, ...prev];
            });
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

      const bizParam = urlParams.get('biz') || hashParams.get('biz') || urlParams.get('b') || hashParams.get('b');
      if (bizParam) {
        const businesses = getBusinesses();
        const match = businesses.find((b) => b.id.toLowerCase() === bizParam.toLowerCase());
        if (match) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('flowscape_guest_scanned_biz', match.id);
          }
          if (match.id !== activeBusinessId || loadedBusinessIdRef.current !== match.id) {
            setActiveBusiness(match.id);
            setActiveBusinessId(match.id);
            loadBusinessData(match.id, match);
          }
        }
      }

      // 1. If QR or table parameters are present, verify table access and guard against URL tampering
      if (tableParam || qrParam) {
        const sigParam = urlParams.get('sig') || hashParams.get('sig');
        const biz = bizParam || activeBusinessId || getInitialBusinessId();
        const isPrivileged = isDeveloperAuthenticated() || canReturnToAdmin;

        const tableCheck = verifyOrLockTable(biz, tableParam, sigParam, isPrivileged);

        if (!tableCheck.valid && tableCheck.reason === 'tamper_blocked') {
          // Table tampering attempt detected!
          // Force revert URL parameter back to the locked table
          try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('table', tableCheck.table.replace(/\D/g, '') || tableCheck.table);
            window.history.replaceState(null, '', currentUrl.toString());
          } catch {}
          setActiveTable(tableCheck.table);
          setCurrentRole('customer');
          setActiveTab('menu');
          return;
        }

        if (!tableCheck.valid && tableCheck.reason === 'unverified_url') {
          // Diner typed table directly in URL without a QR signature and has no verified session
          // Force QR Code Gate
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('flowscape_guest_scanned_qr');
            sessionStorage.removeItem('flowscape_guest_table');
            sessionStorage.removeItem('flowscape_table_sig');
          }
          setCurrentRole('customer');
          return;
        }

        // Valid verified table
        setActiveTable(tableCheck.table);
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
        if (isAuthenticated('counter') || isDeveloperAuthenticated()) {
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
  }, [currentRole, showAboutChef, canReturnToAdmin, activeBusinessId]);

  // Active in-progress orders count (strictly scoped to this customer's placed orders so it starts at 0 until an order is placed)
  const activeOrdersCount = useMemo(() => {
    if (currentRole === 'customer') {
      if (typeof window === 'undefined') return 0;
      try {
        const keys = getCustomerStorageKeys(activeBusinessId);
        const raw = sessionStorage.getItem(keys.orderIds);
        const placedIds = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(placedIds) || placedIds.length === 0) return 0;
        return orders.filter(
          (o) => placedIds.includes(o.id) && o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected'
        ).length;
      } catch {
        return 0;
      }
    }
    return orders.filter((o) => o.status !== 'done' && o.status !== 'served' && o.status !== 'rejected').length;
  }, [currentRole, orders, activeBusinessId]);

  // Handle Order Placement from Customer
  const handlePlaceOrder = async (newOrder) => {
    const currentBiz = getActiveBusiness();
    if (currentBiz && currentBiz.status === 'suspended') {
      alert(`Ordering is currently paused: "${currentBiz.name}" is temporarily suspended. Please speak to staff at the counter.`);
      return false;
    }
    const orderWithBiz = { ...newOrder, businessId: activeBusinessId };

    if (!activeBusinessId || (typeof navigator !== 'undefined' && !navigator.onLine)) return false;
    const confirmed = await syncOrderToCloud(orderWithBiz, activeBusinessId);
    if (!confirmed) return false;
    newOrder.cloudConfirmed = true;
    orderWithBiz.cloudConfirmed = true;

    // Atomically persist to localStorage so concurrent tabs receive it immediately
    if (activeBusinessId) {
      try {
        const orderKey = getScopedKey(STORAGE_KEYS.ORDERS, activeBusinessId);
        const existing = loadData(orderKey, []);
        if (!existing.some((o) => o.id === orderWithBiz.id)) {
          saveData(orderKey, [orderWithBiz, ...existing]);
        }
      } catch {}
      // Ensure sync to cloud

    }

    setOrders((prev) => {
      if (prev.some((o) => o.id === orderWithBiz.id)) return prev;
      return [orderWithBiz, ...prev];
    });
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
    return true;
  };

  // Reset state helper
  const handleResetDemo = () => {
    playTapSound();
    if (window.confirm('Reset all data (menu, orders, expenses, staff & sessions) for this business?')) {
      resetAllDataToDefault(activeBusinessId);
      resetAllSessions();
      setAuthSessions(getStoredSessions());
      setMenu([]);
      setChef(verifiedChefData);
      setOrders([]);
      setExpenses([]);
      setStaff([]);
      setOffers([]);
      setTheme(initialTheme);
      setChecklists([]);
      setCart([]);
    }
  };

  // Helper to load scoped tenant business data
  const loadBusinessData = (bizId, bizObj = null) => {
    isSwitchingTenantRef.current = true;
    loadedBusinessIdRef.current = bizId;
    setCart([]); // Clear any items left in cart from another restaurant

    const biz = bizObj || getBusinesses().find((b) => b.id === bizId);

    if (biz && Array.isArray(biz.tables) && biz.tables.length > 0) {
      const hasSessionQr = typeof sessionStorage !== 'undefined' && (
        sessionStorage.getItem('flowscape_guest_scanned_qr') === 'true' ||
        Boolean(sessionStorage.getItem('flowscape_guest_table'))
      );
      if (!hasSessionQr && !biz.tables.includes(activeTable)) {
        setActiveTable(biz.tables[0]);
      }
    }

    const loadedMenu = loadData(getScopedKey(STORAGE_KEYS.MENU, bizId), []);
    const loadedOrders = loadData(getScopedKey(STORAGE_KEYS.ORDERS, bizId), []);
    const loadedExpenses = loadData(getScopedKey(STORAGE_KEYS.EXPENSES, bizId), []);
    const loadedStaff = normalizeStaffCredentials(loadData(getScopedKey(STORAGE_KEYS.STAFF, bizId), biz?.staff || []));
    const loadedOffers = loadData(getScopedKey(STORAGE_KEYS.OFFERS, bizId), []);
    const loadedChecklists = loadData(getScopedKey(STORAGE_KEYS.CHECKLISTS, bizId), []);

    const initialBizTheme = getInitialThemeForBusiness(bizId);
    const loadedTheme = loadData(getScopedKey(STORAGE_KEYS.THEME, bizId), initialBizTheme);
    const bizOverride = biz ? {
      restaurantName: biz.name,
      tagline: biz.tagline || loadedTheme?.tagline || initialBizTheme.tagline,
      upiId: biz.upiId || loadedTheme?.upiId || initialBizTheme.upiId,
      accentColor: biz.accentColor || loadedTheme?.accentColor || initialBizTheme.accentColor,
      logo: biz.logo !== undefined ? biz.logo : (loadedTheme?.logo || null),
      tables: Array.isArray(biz.tables) && biz.tables.length > 0 ? biz.tables : (loadedTheme?.tables || initialBizTheme.tables)
    } : {};

    setMenu(loadedMenu);
    setChef(loadData(getScopedKey(STORAGE_KEYS.CHEF, bizId), verifiedChefData));
    setOrders(loadedOrders);
    // Fetch cloud orders to recover historical orders if local storage is missing them
    fetchOrdersFromCloud(bizId).then((cloudOrders) => {
      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setOrders((prev) => {
          const map = new Map();
          cloudOrders.forEach((o) => { if (o && o.id) map.set(o.id, o); });
          (Array.isArray(prev) ? prev : []).forEach((o) => { if (o && o.id) map.set(o.id, o); });
          const merged = Array.from(map.values()).sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA;
          });
          saveData(getScopedKey(STORAGE_KEYS.ORDERS, bizId), merged);
          return merged;
        });
      }
    }).catch(() => {});
    setExpenses(loadedExpenses);
    setStaff(loadedStaff);
    setOffers(loadedOffers);
    setChecklists(loadedChecklists);
    setTheme({
      ...initialBizTheme,
      ...loadedTheme,
      ...bizOverride,
      logo: bizOverride.logo !== undefined ? bizOverride.logo : (loadedTheme?.logo || null)
    });

    setTimeout(() => {
      isSwitchingTenantRef.current = false;
    }, 50);
  };

  // Launch / Switch to Tenant Workspace from Developer Superadmin
  const handleSwitchToTenantApp = (biz, targetRole = 'admin') => {
    setActiveBusiness(biz.id);
    setActiveBusinessId(biz.id);
    loadBusinessData(biz.id, biz);

    const currentSessions = getStoredSessions();
    if (targetRole === 'admin') {
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
    } else if (targetRole === 'counter') {
      currentSessions.counter = {
        role: 'counter',
        businessId: biz.id,
        businessName: biz.name,
        name: `${biz.owner.name} (Dev Bypass)`,
        terminal: biz.counter?.terminalName || 'POS Terminal 01',
        token: `pos_${biz.id}_${Date.now()}`,
        authenticatedAt: new Date().toISOString(),
        authenticatedBy: 'counter'
      };
      saveStoredSessions(currentSessions);
      setAuthSessions(currentSessions);
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

    // If switching to counter terminal:
    if (role === 'counter') {
      const isOwnerLoggedIn = Boolean(sessions?.admin?.token);
      const isCounterLoggedIn = Boolean(sessions?.counter?.token);

      if (isOwnerLoggedIn) {
        // Authenticated owner switching into their counter terminal
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('flowscape_switched_from_admin', 'true');
        }
        setSwitchedFromAdmin(true);
      } else if (!isCounterLoggedIn && !isDeveloperAuthenticated()) {
        // User is NEITHER signed in to owner's dashboard NOR directly logged into counter POS:
        // Must show counter login modal! Zero unauthorized access.
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('flowscape_switched_from_admin');
        }
        setSwitchedFromAdmin(false);
        setCurrentRole('counter');
        window.location.hash = 'counter';
        setAuthModal({ isOpen: true, targetRole: 'counter' });
        return;
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
    const role = newSession?.role || 'admin';
    const currentSessions = getStoredSessions();

    if (role === 'counter') {
      // Direct login to live POS: strictly clear any admin session and switched-from-admin flag
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('flowscape_switched_from_admin');
      }
      setSwitchedFromAdmin(false);
      currentSessions.admin = null;
      currentSessions.counter = newSession;
    } else if (role === 'admin') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('flowscape_switched_from_admin', 'true');
      }
      setSwitchedFromAdmin(true);
      currentSessions.admin = newSession;
    } else {
      currentSessions[role] = newSession;
    }

    saveStoredSessions(currentSessions);
    setAuthSessions({ ...currentSessions });

    if (newSession?.staffId) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('counter_active_staff_id', newSession.staffId);
          if (newSession.businessId) {
            sessionStorage.setItem(`counter_active_staff_id_${newSession.businessId}`, newSession.staffId);
          }
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('counter_active_staff_id');
        }
      } catch {}
    }

    const bizObj = matchedBusiness || (newSession?.businessId ? getBusinesses().find((b) => b.id === newSession.businessId) : null);
    if (bizObj) {
      setActiveBusiness(bizObj.id);
      setActiveBusinessId(bizObj.id);
      loadBusinessData(bizObj.id, bizObj);
    }

    setAuthActionState(null);
    setAuthModal({ isOpen: false, targetRole: null });

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
        />
      </div>
    );
  }

  // Dedicated Render for Account and Data Deleted Page (Customer, Admin/Owner, Counter)
  if (deletedAccountNotice) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', background: '#090D16' }}>
        <AccountDeletedView
          deletedInfo={deletedAccountNotice}
          onResetToHome={() => {
            clearAccountDeletedNotice();
            const available = getBusinesses();
            if (available.length > 0) {
              setActiveBusiness(available[0].id);
              setActiveBusinessId(available[0].id);
            }
            window.location.href = window.location.pathname;
          }}
          onOpenSetup={() => {
            clearAccountDeletedNotice();
            window.location.hash = 'manj';
            setCurrentRole('developer');
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* WCAG 2.1 AA Skip to Content Keyboard Link */}
      <a href="#main-content" className="skip-to-content">Skip to Main Content</a>

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
          {/* Zero-State Setup Gate when No Outlets Exist Yet (Only for unconfigured Admin) */}
          {getBusinesses().length === 0 && currentRole === 'admin' && !checkGuestQrAccess() && !activeBusinessId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '70vh',
              padding: 24,
              fontFamily: "'Inter', -apple-system, sans-serif"
            }}>
              <div style={{
                maxWidth: 480,
                width: '100%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 24,
                padding: 32,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(20px)',
                textAlign: 'center'
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)'
                }}>
                  <Server size={32} color="#FFFFFF" />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: '#F8FAFC' }}>
                  No Restaurant Configured
                </h2>
                <p style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, margin: '0 0 24px' }}>
                  Welcome! There are currently no active restaurant outlets registered. Please set up your restaurant to begin managing menus, orders, and counter billing.
                </p>
                <button
                  onClick={() => {
                    window.location.hash = 'manj';
                    setCurrentRole('developer');
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  <Building2 size={18} />
                  <span>Set Up Restaurant</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Views Rendering */}
          {(getBusinesses().length > 0 || Boolean(activeBusinessId) || checkGuestQrAccess()) && (currentRole === 'customer' || currentRole === 'chef') && (
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
            !(isAuthenticated('counter', activeBusinessId) || isDeveloperAuthenticated()) ? (
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
            !(isAuthenticated('admin', activeBusinessId) || isDeveloperAuthenticated()) ? (
              <AdminOwnerLoginGate
                onOpenLogin={() => setAuthModal({ isOpen: true, targetRole: 'admin' })}
                onSwitchRole={handleRoleSwitch}
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
                onDeleteAccountComplete={(deletionResult) => {
                  handleLogoutRole('admin');
                  handleLogoutRole('counter');
                  const deletedName = deletionResult?.deletedBusiness?.name || activeBiz?.name || theme?.restaurantName || 'Restaurant';
                  triggerAccountDeletedNotice({
                    businessName: deletedName,
                    businessId: activeBusinessId
                  });
                }}
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
        : (isAuthenticated(currentRole, activeBusinessId) || isDeveloperAuthenticated())) && (
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
        businessId={activeBusinessId}
        serviceType={theme.serviceType || (theme.tables?.length === 1 && theme.tables[0].includes('Stand') ? 'stall' : 'dine_in')}
      />

      {/* GDPR / CCPA Global Cookie Consent Banner */}
      <CookieBanner
        onOpenLegal={(tab) => setLegalModal({ isOpen: true, tab: tab || 'privacy' })}
      />

      {/* Interactive Global Legal Documents & Compliance Modal */}
      <LegalModal
        isOpen={legalModal.isOpen}
        initialTab={legalModal.tab}
        onClose={() => setLegalModal({ isOpen: false, tab: 'privacy' })}
      />
    </div>
  );
}
