import {
  initialMenu,
  verifiedChefData,
  initialOrders,
  initialExpenses,
  initialStaff,
  initialStaffByBusiness,
  initialOffers,
  initialTheme
} from '../data/initialData';

const STORAGE_KEYS = {
  MENU: 'flowscape_menu_inr_v2',
  CHEF: 'flowscape_chef_inr_v2',
  ORDERS: 'flowscape_orders_inr_v2',
  EXPENSES: 'flowscape_expenses_inr_v2',
  STAFF: 'flowscape_staff_inr_v2',
  OFFERS: 'flowscape_offers_inr_v2',
  THEME: 'flowscape_theme_inr_v2',
  CHECKLISTS: 'flowscape_checklists_inr_v2'
};

export function getScopedKey(baseKey, bizId) {
  const cleanId = bizId || 'biz_advait';
  return cleanId === 'biz_advait' ? baseKey : `${baseKey}_${cleanId}`;
}

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

export function resetAllDataToDefault(bizId = 'biz_advait') {
  saveData(getScopedKey(STORAGE_KEYS.MENU, bizId), initialMenu);
  saveData(getScopedKey(STORAGE_KEYS.CHEF, bizId), verifiedChefData);
  saveData(getScopedKey(STORAGE_KEYS.ORDERS, bizId), bizId === 'biz_advait' ? initialOrders : []);
  saveData(getScopedKey(STORAGE_KEYS.EXPENSES, bizId), bizId === 'biz_advait' ? initialExpenses : []);
  saveData(getScopedKey(STORAGE_KEYS.STAFF, bizId), initialStaffByBusiness?.[bizId] || (bizId === 'biz_advait' ? initialStaff : []));
  saveData(getScopedKey(STORAGE_KEYS.OFFERS, bizId), bizId === 'biz_advait' ? initialOffers : []);
  saveData(getScopedKey(STORAGE_KEYS.THEME, bizId), initialTheme);
  saveData(getScopedKey(STORAGE_KEYS.CHECKLISTS, bizId), []);
}

export { STORAGE_KEYS };
