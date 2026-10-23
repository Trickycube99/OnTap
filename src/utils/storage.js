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
} from '../data/initialData.js';

const STORAGE_KEYS = {
  MENU: 'menu',
  CHEF: 'chef',
  ORDERS: 'orders',
  EXPENSES: 'expenses',
  STAFF: 'staff',
  OFFERS: 'offers',
  THEME: 'theme',
  CHECKLISTS: 'checklists'
};

const STORAGE_PREFIX = 'ontap_v5';

export function getScopedKey(baseKey, bizId) {
  const cleanId = (bizId || '').trim().toLowerCase();
  return cleanId ? `${STORAGE_PREFIX}_${baseKey}_${cleanId}` : `${STORAGE_PREFIX}_${baseKey}`;
}

export function purgeLegacyStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k && (
          k.startsWith('flowscape_') ||
          k.startsWith('ontap_v1_') ||
          k.startsWith('ontap_v2_') ||
          k.startsWith('ontap_v3_') ||
          k.startsWith('ontap_v4_') ||
          k.includes('biz_advait') ||
          k.includes('biz_copper_chimney') ||
          k.includes('biz_chai_point') ||
          k.includes('advait_')
        )
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Storage purge error:', e);
  }
}

// Auto-purge legacy corrupted and demo keys once on import
purgeLegacyStorage();

export function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading ${key} from localStorage:`, err);
    return fallback;
  }
}

export function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
}

export function resetAllDataToDefault(bizId) {
  if (!bizId) return;
  const cleanId = String(bizId).trim().toLowerCase();
  saveData(getScopedKey(STORAGE_KEYS.MENU, cleanId), []);
  saveData(getScopedKey(STORAGE_KEYS.CHEF, cleanId), verifiedChefData);
  saveData(getScopedKey(STORAGE_KEYS.ORDERS, cleanId), []);
  saveData(getScopedKey(STORAGE_KEYS.EXPENSES, cleanId), []);
  saveData(getScopedKey(STORAGE_KEYS.STAFF, cleanId), []);
  saveData(getScopedKey(STORAGE_KEYS.OFFERS, cleanId), []);
  saveData(getScopedKey(STORAGE_KEYS.THEME, cleanId), getInitialThemeForBusiness(cleanId));
  saveData(getScopedKey(STORAGE_KEYS.CHECKLISTS, cleanId), []);
}

export { STORAGE_KEYS, STORAGE_PREFIX };
