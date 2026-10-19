export const initialMenu = [
  {
    id: 1,
    name: "Chef's Signature Butter Chicken Brioche Slider",
    category: "Signatures",
    price: 360,
    isVeg: false,
    image: "/assets/butter_chicken_burger.jpg",
    isAvailable: true,
    tags: ["Chef's Pick", "Signature Special"],
    bullets: [
      "Slow-braised tandoori smoked chicken in rich velvet makhani glaze",
      "Toasted artisanal brioche bun with roasted kasoori methi & melted cheese",
      "Pickled sirka onions & fresh coriander, served with gunpowder masala fries"
    ],
    prepTime: "12-14 mins",
    calories: "580 kcal",
    suggestedPairingId: 3
  },
  {
    id: 2,
    name: "Artisanal Burrata & Tandoori Paneer Naan Pizza",
    category: "Signatures",
    price: 420,
    isVeg: true,
    image: "/assets/burrata_paneer_pizza.jpg",
    isAvailable: true,
    tags: ["Bestseller", "Vegetarian"],
    bullets: [
      "48-hour slow cold-fermented sourdough naan crust baked in wood-fire oven",
      "Creamy whole burrata cheese center paired with charred spiced paneer tikka",
      "San Marzano tomato makhani sauce reduction & fresh garden coriander"
    ],
    prepTime: "10-12 mins",
    calories: "640 kcal",
    suggestedPairingId: 3
  },
  {
    id: 3,
    name: "Sparkling Alphonso Mango & Kokum Shikanji",
    category: "Beverages",
    price: 160,
    isVeg: true,
    image: "/assets/artisanal_cooler.jpg",
    isAvailable: true,
    tags: ["Refreshing", "Cold-Pressed"],
    bullets: [
      "Pure Ratnagiri Alphonso mango & wild Konkan kokum fruit nectar",
      "Effervescent sparkling mineral water, garden spearmint & rock salt cumin",
      "Zero artificial syrups or refined white sugar"
    ],
    prepTime: "3 mins",
    calories: "110 kcal"
  },
  {
    id: 4,
    name: "Gunpowder Spiced Crispy Smashed Potatoes",
    category: "Mains & Sides",
    price: 190,
    isVeg: true,
    image: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
    isAvailable: true,
    tags: ["Crispy", "Sides"],
    bullets: [
      "Baby golden potatoes double-crisped in clarified cow ghee",
      "Tossed with aromatic podi gunpowder masala & curry leaf sea salt flakes",
      "Accompanied with roasted garlic coconut remoulade dip"
    ],
    prepTime: "6 mins",
    calories: "280 kcal"
  },
  {
    id: 5,
    name: "Kolkata Spiced Crispy Chicken Sando",
    category: "Mains & Sides",
    price: 320,
    isVeg: false,
    image: "https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&q=80",
    isAvailable: true,
    tags: ["Crunchy", "Popular"],
    bullets: [
      "Buttermilk-marinated tender chicken coated in fragrant Bengal spice crunch",
      "Drizzled with fermented chilli kasundi mustard honey glaze",
      "Thinly shredded cabbage slaw & sirka cucumbers on buttered potato bun"
    ],
    prepTime: "10 mins",
    calories: "540 kcal"
  },
  {
    id: 6,
    name: "Smoked Dal Makhani & Saffron Truffle Rigatoni",
    category: "Signatures",
    price: 390,
    isVeg: true,
    image: "https://images.unsplash.com/photo-1621996346565-e3d5d6281728?auto=format&fit=crop&w=600&q=80",
    isAvailable: true,
    tags: ["Vegetarian", "Chef's Recipe"],
    bullets: [
      "Slow-cooked 24-hour black urad dal emulsion blended with Italian rigatoni",
      "Infused with Kashmiri saffron, subtle truffle butter & cream",
      "Topped with 24-month aged Parmigiano Reggiano shavings"
    ],
    prepTime: "14 mins",
    calories: "510 kcal"
  },
  {
    id: 7,
    name: "Madras 12-Hour Slow Drip Cold Brew",
    category: "Beverages",
    price: 150,
    isVeg: true,
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80",
    isAvailable: true,
    tags: ["Specialty Coffee", "Craft"],
    bullets: [
      "Single-estate Chikmagalur peaberry roasted with 15% chicory root",
      "Extracted drop-by-drop through Kyoto cold water tower for 12 hours",
      "Served over hand-cut crystal ice sphere with optional oat milk splash"
    ],
    prepTime: "2 mins",
    calories: "10 kcal"
  },
  {
    id: 8,
    name: "Warm Shahi Tukda Brioche Bread Pudding",
    category: "Desserts",
    price: 240,
    isVeg: true,
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
    isAvailable: true,
    tags: ["Decadent", "Warm Dessert"],
    bullets: [
      "Golden ghee-crisped French brioche soaked in saffron cardamom syrup",
      "Crown of churned Malai rabri gelato and toasted Afghani pistachios",
      "Delicate edible silver vark & wild rose petal garnish"
    ],
    prepTime: "8 mins",
    calories: "420 kcal"
  }
];

export const verifiedChefData = {
  name: "Rakesh Sharma",
  title: "Executive Chef & Master Director",
  businessName: "Advait Artisanal Indian Kitchen",
  portrait: "/assets/chef_portrait.jpg",
  experienceYears: 18,
  isVerified: true,
  verificationId: "FSSAI-LIC-10026011009821",
  guildRegistryNumber: "ICF-DELHI-88392-IN",
  verificationTimestamp: "Verified Active • Audited Oct 2026",
  authorityName: "Food Safety and Standards Authority of India (FSSAI) & Indian Culinary Forum",
  hygieneScore: "99.4%",
  hygieneGrade: "Grade A+ (5-Star FSSAI Clean Street Food / Dining Standard)",
  bio: "With over 18 years of pioneering culinary experience spanning ITC Bukhara brigade, luxury Oberoi properties, and contemporary Indian fine dining in London and New Delhi, Chef Rakesh Sharma crafts transparent, high-integrity Indian food where ancient spice alchemy meets modern culinary precision.",
  philosophy: "Food is sacred and an expression of profound trust. When a guest scans our QR code at the table, they deserve complete transparency on who cooked their food, where the spices and grains originated, and the exact FSSAI hygiene standards maintained in our kitchen.",
  certifications: [
    {
      id: "c1",
      name: "Diploma in Culinary Arts & Indian Gastronomy",
      issuer: "Institute of Hotel Management (IHM) Pusa, New Delhi",
      year: "2006 - 2008",
      badge: "First Class Honours",
      verified: true
    },
    {
      id: "c2",
      name: "Master of Progressive Indian Cuisine & Flavours",
      issuer: "Indian Culinary Forum (ICF)",
      year: "2014",
      badge: "Master Chef Gold Medal",
      verified: true
    },
    {
      id: "c3",
      name: "FSSAI FoSTaC Lead Food Safety Supervisor & HACCP Auditor",
      issuer: "Food Safety and Standards Authority of India (Govt. of India)",
      year: "2024 - 2027",
      badge: "ISO 22000 Certified",
      verified: true
    },
    {
      id: "c4",
      name: "Heritage Dum & Tandoor Brigade Alumni",
      issuer: "ITC Maurya Dining Brigade, New Delhi",
      year: "2015 - 2019",
      badge: "Culinary Distinction",
      verified: true
    }
  ],
  careerHighlights: [
    "Executive Chef at Michelin-recommended contemporary Indian restaurant (2019-2023)",
    "Senior mentor to 60+ young Indian culinary graduates and women chefs",
    "Pioneered direct-from-farmer A2 organic ghee and cold-pressed spices supply network",
    "Invited culinary speaker at National Gastronomy Summit 2025"
  ],
  hygieneAndQualityPledge: [
    "100% Certified organic spices stone-ground in-house daily",
    "Pure A2 Gir cow ghee and cold-pressed mustard oil with zero adulteration",
    "Farm-fresh produce sourced directly from organic farmer cooperatives within 80km",
    "Commercial 5-stage RO + UV filtration for all kitchen cooking water & ice cubes",
    "Daily microbiological swab testing and digital cold-storage temperature logging"
  ],
  awards: [
    "Indian Master Chef of the Year (2024)",
    "FSSAI 5-Star Clean Dining Award (2025)",
    "Sustainable Indian Gastronomy Pioneer (2026)"
  ]
};

export const initialOrders = [
  {
    id: "ORD-8821",
    customerName: "Rohan Mehra",
    table: "Table 04",
    phone: "+91 98112-40192",
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    status: "received",
    statusLabel: "Received",
    items: [
      { id: 1, name: "Chef's Signature Butter Chicken Brioche Slider", price: 360, quantity: 1, note: "Medium spicy, extra sirka onions" },
      { id: 3, name: "Sparkling Alphonso Mango & Kokum Shikanji", price: 160, quantity: 1, note: "Less ice please" }
    ],
    orderNote: "Dine-in. Please serve beverage first.",
    paymentMode: "Pay at Counter",
    paymentStatus: "Pending Cash/Card Settlement",
    subtotal: 520,
    tax: 26, // 5% GST (2.5% CGST + 2.5% SGST)
    discount: 0,
    total: 546,
    progressPercent: 25
  },
  {
    id: "ORD-8820",
    customerName: "Ananya Deshmukh",
    table: "Table 02",
    phone: "+91 98711-22904",
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    status: "ready",
    statusLabel: "Ready to Serve",
    items: [
      { id: 2, name: "Artisanal Burrata & Tandoori Paneer Naan Pizza", price: 420, quantity: 1, note: "Slice into 6 triangles" },
      { id: 4, name: "Gunpowder Spiced Crispy Smashed Potatoes", price: 190, quantity: 1, note: "Extra coconut remoulade" }
    ],
    orderNote: "Celebrating family birthday",
    paymentMode: "UPI Instant QR",
    paymentStatus: "Paid via UPI (Ref #98210492)",
    subtotal: 610,
    tax: 30.5,
    discount: 60,
    total: 580.5,
    progressPercent: 85
  },
  {
    id: "ORD-8819",
    customerName: "Vikram Singhania",
    table: "Counter / Takeaway",
    phone: "+91 99201-88412",
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    status: "done",
    statusLabel: "Completed",
    items: [
      { id: 7, name: "Madras 12-Hour Slow Drip Cold Brew", price: 150, quantity: 2, note: "" },
      { id: 8, name: "Warm Shahi Tukda Brioche Bread Pudding", price: 240, quantity: 1, note: "Pack gelato in insulated pouch" }
    ],
    orderNote: "Takeaway parcel",
    paymentMode: "Card Settlement",
    paymentStatus: "Paid via POS Swipe Machine",
    subtotal: 540,
    tax: 27,
    discount: 0,
    total: 567,
    progressPercent: 100
  },
  {
    id: "ORD-8818",
    customerName: "Priya Nair",
    table: "Table 06",
    phone: "+91 98450-77129",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: "received",
    statusLabel: "New Order",
    items: [
      { id: 6, name: "Smoked Dal Makhani & Saffron Truffle Rigatoni", price: 390, quantity: 1, note: "Less chilli, extra parmesan" },
      { id: 3, name: "Sparkling Alphonso Mango & Kokum Shikanji", price: 160, quantity: 1, note: "" }
    ],
    orderNote: "First time trying the chef pasta",
    paymentMode: "Pay at Counter",
    paymentStatus: "Pending Settlement",
    subtotal: 550,
    tax: 27.5,
    discount: 0,
    total: 577.5,
    progressPercent: 20
  }
];

export const initialExpenses = [
  { id: "exp-1", date: "2026-10-15", category: "Ingredients & Produce", description: "Farm fresh organic veggies, dairy paneer & herbs", amount: 3850, loggedBy: "Rakesh (Chef)" },
  { id: "exp-2", date: "2026-10-15", category: "Daily Dairy & Bakery", description: "A2 Gir cow milk, curd, brioche burger buns & ghee", amount: 1650, loggedBy: "Rakesh (Chef)" },
  { id: "exp-3", date: "2026-10-14", category: "Utilities & Gas", description: "Commercial kitchen LPG cylinders & clean power", amount: 2400, loggedBy: "Owner" },
  { id: "exp-4", date: "2026-10-14", category: "Ingredients & Produce", description: "Farm poultry & stone-ground whole spices crate", amount: 4200, loggedBy: "Rakesh (Chef)" },
  { id: "exp-5", date: "2026-10-13", category: "Other & Maintenance", description: "Kitchen grinder servicing & sanitization chemicals", amount: 950, loggedBy: "Owner" }
];

export const initialStaff = [
  {
    id: "st-1",
    loginId: "sunil.pos",
    pin: "440100",
    name: "Sunil Verma",
    role: "Counter Captain & POS Lead",
    phone: "+91 98112-40192",
    monthlyWage: 26000,
    monthEndPay: 26000,
    status: "active",
    bankAccount: "982100481201",
    ifsc: "HDFC0000128",
    permissions: { canEditPrice: true, canCreateDiscounts: true, canViewPnL: false }
  },
  {
    id: "st-2",
    loginId: "neha.pos",
    pin: "440200",
    name: "Neha Kulkarni",
    role: "Head Barista & Cashier",
    phone: "+91 98450-88122",
    monthlyWage: 24000,
    monthEndPay: 24000,
    status: "active",
    bankAccount: "982100481202",
    ifsc: "HDFC0000128",
    permissions: { canEditPrice: false, canCreateDiscounts: true, canViewPnL: false }
  },
  {
    id: "st-3",
    loginId: "manpreet.pos",
    pin: "440300",
    name: "Chef Manpreet Singh",
    role: "Sous Chef & Tandoor Master",
    phone: "+91 98771-33100",
    monthlyWage: 36000,
    monthEndPay: 36000,
    status: "active",
    bankAccount: "982100481203",
    ifsc: "HDFC0000128",
    permissions: { canEditPrice: true, canCreateDiscounts: false, canViewPnL: false }
  },
  {
    id: "st-4",
    loginId: "rajesh.pos",
    pin: "440400",
    name: "Rajesh Yadav",
    role: "Service & Inventory Associate",
    phone: "+91 98220-77411",
    monthlyWage: 20000,
    monthEndPay: 20000,
    status: "active",
    bankAccount: "982100481204",
    ifsc: "HDFC0000128",
    permissions: { canEditPrice: false, canCreateDiscounts: false, canViewPnL: false }
  }
];

export const initialStaffByBusiness = {
  biz_advait: initialStaff,
  biz_copper_chimney: [
    {
      id: "st-cc-1",
      loginId: "ravi.pos",
      pin: "330100",
      name: "Ravi Sharma",
      role: "Counter Captain & POS Lead",
      phone: "+91 98221-55011",
      monthlyWage: 28000,
      monthEndPay: 28000,
      status: "active",
      bankAccount: "982200551101",
      ifsc: "HDFC0000128",
      permissions: { canEditPrice: true, canCreateDiscounts: true, canViewPnL: false }
    },
    {
      id: "st-cc-2",
      loginId: "anjali.pos",
      pin: "330200",
      name: "Anjali Rao",
      role: "Head Cashier & Service Lead",
      phone: "+91 98334-66022",
      monthlyWage: 25000,
      monthEndPay: 25000,
      status: "active",
      bankAccount: "982200551102",
      ifsc: "HDFC0000128",
      permissions: { canEditPrice: false, canCreateDiscounts: true, canViewPnL: false }
    }
  ],
  biz_chai_point: [
    {
      id: "st-cp-1",
      loginId: "vikram.pos",
      pin: "220100",
      name: "Vikram Joshi",
      role: "Counter Lead & Barista",
      phone: "+91 98440-77011",
      monthlyWage: 24000,
      monthEndPay: 24000,
      status: "active",
      bankAccount: "982300771101",
      ifsc: "HDFC0000128",
      permissions: { canEditPrice: true, canCreateDiscounts: true, canViewPnL: false }
    },
    {
      id: "st-cp-2",
      loginId: "pooja.pos",
      pin: "220200",
      name: "Pooja Patel",
      role: "Cashier & Dispatch Lead",
      phone: "+91 98551-88022",
      monthlyWage: 22000,
      monthEndPay: 22000,
      status: "active",
      bankAccount: "982300771102",
      ifsc: "HDFC0000128",
      permissions: { canEditPrice: false, canCreateDiscounts: true, canViewPnL: false }
    }
  ]
};

export const initialOffers = [
  { id: "off-1", code: "ADVAIT10", type: "percent", value: 10, description: "10% Welcome Discount for Table QR Ordering", minOrderAmount: 0, expiryDate: "2026-12-31", isActive: true },
  { id: "off-2", code: "FLAT100", type: "flat", value: 100, description: "₹100 Off on orders above ₹600", minOrderAmount: 600, expiryDate: "2026-12-31", isActive: true },
  { id: "off-3", code: "CHEFCOMBO", type: "flat", value: 80, description: "₹80 Off when ordering Brioche Slider + Shikanji", minOrderAmount: 400, expiryDate: "2026-12-31", isActive: true },
  { id: "off-4", code: "EARLYBIRD", type: "percent", value: 15, description: "15% Off Early Bird Special", minOrderAmount: 500, expiryDate: "2026-09-30", isActive: false }
];

export const initialTheme = {
  restaurantName: "Advait Artisanal Kitchen",
  tagline: "Progressive Indian Table & Craft Kitchen",
  chefTagline: "Verifiable Indian Culinary Mastery",
  welcomeMessage: "Scan table QR, order effortlessly, and track your kitchen ticket in real time.",
  accentColor: "#007AFF",
  menuLayout: "grid",
  fontPreset: "SF Pro / Inter",
  logoText: "AD",
  upiId: "9119069179@nyes",
  tables: ["Table 01", "Table 02", "Table 03", "Table 04", "Table 05", "Table 06", "Table 07", "Counter / Takeaway"],
  pendingAggregatorSettlement: 28500, // Zomato / Swiggy pending settlement
  cashInHand: 45000,
  upcomingObligations: {
    rent: 45000,
    payroll: 106000,
    emi: 18000,
    dueDate: "28th of this month"
  }
};

export const DEFAULT_CUTLERY_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="%23F1F5F9"/><circle cx="100" cy="100" r="62" fill="%23E2E8F0"/><g transform="translate(68, 68)" stroke="%2364748B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M12 4v22a8 8 0 0 0 8 8v30a4 4 0 0 0 8 0V34a8 8 0 0 0 8-8V4"/><path d="M20 4v18"/><path d="M28 4v18"/><path d="M52 4c2 8 8 18 12 18v42h-8V42c-4-2-8-8-8-16V4z"/></g></svg>`;

