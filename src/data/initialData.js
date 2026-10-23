// Clean Zero-State Initial Data Structures for Real Production Use
// All pre-made hard-coded demo accounts, fake orders, fake expenses, and mock data have been purged.

export const initialMenu = [];

export const verifiedChefData = {
  name: "Executive Chef",
  title: "Head of Culinary Operations",
  experienceYears: 0,
  fssaiLicense: "",
  bio: "Fresh culinary craft prepared to highest standards of hygiene and quality.",
  hygienePillars: [
    "Commercial 5-stage RO + UV filtration for kitchen operations",
    "Daily digital temperature logging and sanitized preparation surfaces",
    "Rigorous safety protocols and fresh ingredient sourcing"
  ],
  awards: []
};

export const initialOrders = [];

export const initialExpenses = [];

export const initialStaff = [];

export const initialStaffByBusiness = {};

export const initialMenuByBusiness = {};

export const initialOffers = [];

export const initialTheme = {
  restaurantName: "Restaurant OS",
  tagline: "Contactless Dining & Kitchen POS",
  chefTagline: "Culinary Craft & Hospitality",
  welcomeMessage: "Scan table QR, order effortlessly, and track your kitchen ticket in real time.",
  accentColor: "#007AFF",
  menuLayout: "grid",
  fontPreset: "SF Pro / Inter",
  logoText: "OS",
  upiId: "",
  tables: ["Table 01", "Table 02", "Table 03", "Table 04", "Table 05", "Table 06", "Counter / Takeaway"],
  pendingAggregatorSettlement: 0,
  cashInHand: 0,
  upcomingObligations: {
    rent: 0,
    payroll: 0,
    emi: 0,
    dueDate: ""
  }
};

export const initialThemeByBusiness = {};

export function getInitialThemeForBusiness(bizId) {
  if (bizId && initialThemeByBusiness[bizId]) {
    return initialThemeByBusiness[bizId];
  }
  return {
    ...initialTheme,
    restaurantName: "Restaurant",
    tagline: "Contactless Dining & Kitchen POS",
    welcomeMessage: "Scan table QR, order effortlessly, and track your kitchen ticket in real time.",
    showAboutChef: false
  };
}

export const DEFAULT_CUTLERY_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%23F1F5F9"/><circle cx="100" cy="100" r="62" fill="%23E2E8F0"/><g transform="translate(68, 68)" stroke="%2364748B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M12 4v22a8 8 0 0 0 8 8v30a4 4 0 0 0 8 0V34a8 8 0 0 0 8-8V4"/><path d="M20 4v18"/><path d="M28 4v18"/><path d="M52 4c2 8 8 18 12 18v42h-8V42c-4-2-8-8-8-16V4z"/></g></svg>`;
