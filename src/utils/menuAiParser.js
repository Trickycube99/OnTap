// Client-Side AI Menu Scanner and Heuristic Parser Utility
// Supports:
// 1. Google Gemini 1.5/2.0 Flash Multimodal Vision (PDF & Images: PNG, JPG, WebP)
// 2. Client-side digital PDF text stream extractor
// 3. Smart offline heuristic menu text parser (detects dish names, prices, categories & veg/non-veg)

export const GEMINI_STORAGE_KEY = 'flowscape_gemini_api_key';

export const COMMON_CATEGORIES = [
  'Starters',
  'Main Course',
  'Breads',
  'Rice & Biryani',
  'Beverages',
  'Desserts',
  'Snacks & Quick Bites',
  'Soups & Salads',
  'Combos & Thalis'
];

/**
 * Retrieve saved Gemini API key from localStorage or Vite environment variable
 */
export function getStoredGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  const localKey = localStorage.getItem(GEMINI_STORAGE_KEY);
  if (localKey && localKey.trim()) return localKey.trim();
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY || '';
  return envKey.trim();
}

/**
 * Persist custom Gemini API key to localStorage
 */
export function saveStoredGeminiApiKey(key) {
  if (typeof window === 'undefined') return;
  const clean = (key || '').trim();
  if (clean) {
    localStorage.setItem(GEMINI_STORAGE_KEY, clean);
  } else {
    localStorage.removeItem(GEMINI_STORAGE_KEY);
  }
}

/**
 * Convert a File object to base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extract text from digital PDF ArrayBuffer directly in the browser
 */
export function extractTextFromPdfArrayBuffer(arrayBuffer) {
  try {
    const uint8 = new Uint8Array(arrayBuffer);
    let str = '';
    // Read up to 2MB of ASCII/UTF-8 representation
    const limit = Math.min(uint8.length, 2 * 1024 * 1024);
    for (let i = 0; i < limit; i++) {
      const code = uint8[i];
      // Printable ASCII or newline/tab
      if ((code >= 32 && code <= 126) || code === 10 || code === 13 || code === 9) {
        str += String.fromCharCode(code);
      } else {
        str += ' ';
      }
    }

    // Extract strings within PDF parentheses: (text here) Tj or [(text)] TJ
    const textMatches = [];
    const tjRegex = /\(([^()]{2,120})\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(str)) !== null) {
      if (match[1]) textMatches.push(match[1]);
    }

    const arrayRegex = /\[([^\]]{2,250})\]\s*TJ/g;
    while ((match = arrayRegex.exec(str)) !== null) {
      const subRegex = /\(([^()]+)\)/g;
      let subMatch;
      let combined = '';
      while ((subMatch = subRegex.exec(match[1])) !== null) {
        combined += subMatch[1] + ' ';
      }
      if (combined.trim().length > 1) {
        textMatches.push(combined.trim());
      }
    }

    if (textMatches.length > 5) {
      return textMatches.join('\n');
    }

    // Fallback: look for lines containing prices / food terms
    const rawLines = str.split(/[\r\n]+/).map((l) => l.trim()).filter((l) => l.length > 3 && l.length < 150);
    const candidateLines = rawLines.filter((l) => /\d{2,4}/.test(l));
    return candidateLines.join('\n');
  } catch (err) {
    console.warn('PDF text extraction notice:', err);
    return '';
  }
}

/**
 * Smart Offline Heuristic Menu Text Parser
 * Parses line-by-line raw text, WhatsApp menus, or OCR output into structured dishes
 */
export function parseRawMenuText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  let currentCategory = 'Main Course';

  const categoryMap = {
    'Starters': ['starter', 'appetizer', 'snack', 'kebab', 'tikka', 'roll', 'chaat'],
    'Main Course': ['main course', 'gravy', 'curry', 'sabji', 'sabzi', 'dal', 'paneer dish'],
    'Breads': ['bread', 'roti', 'naan', 'paratha', 'kulcha', 'poori'],
    'Rice & Biryani': ['rice', 'biryani', 'pulao', 'fried rice', 'khichdi'],
    'Beverages': ['beverage', 'drink', 'shake', 'juice', 'coffee', 'tea', 'mocktail', 'soda', 'lassi'],
    'Desserts': ['dessert', 'sweet', 'ice cream', 'halwa', 'kulfi', 'jamun', 'brownie', 'cake'],
    'Soups & Salads': ['soup', 'salad', 'shorba', 'raita']
  };

  const isCategoryHeader = (line) => {
    // Strip bullet points or decorative dashes: e.g. "--- STARTERS ---", "**BEVERAGES**"
    const clean = line.replace(/[^a-zA-Z\s&]/g, '').trim();
    if (clean.length < 3 || clean.length > 35) return false;
    // Don't treat lines with numbers/prices as headers
    if (/\d/.test(line)) return false;

    for (const [catName, keywords] of Object.entries(categoryMap)) {
      if (clean.toLowerCase() === catName.toLowerCase()) return catName;
      if (keywords.some((kw) => clean.toLowerCase() === kw || clean.toLowerCase() === kw + 's')) {
        return catName;
      }
    }
    return false;
  };

  const nonVegWords = [
    'chicken', 'mutton', 'fish', 'prawn', 'egg', 'meat', 'pork', 'beef',
    'kebab', 'seekh', 'tangdi', 'keema', 'gosht', 'murgh', 'crab', 'bacon', 'ham'
  ];

  lines.forEach((line) => {
    // Check if this line is a category header
    const cat = isCategoryHeader(line);
    if (cat) {
      currentCategory = cat;
      return;
    }

    // Try extracting price at the end or within the line
    // Matches patterns like:
    // "Paneer Butter Masala ... ₹280"
    // "Butter Chicken - 350/-"
    // "Garlic Naan Rs. 70"
    // "Cold Coffee / 120"
    // "250.00"
    const priceRegex = /(?:₹|rs\.?|inr)?\s*(\d{2,4})(?:\.00)?(?:\s*\/-)?$/i;
    const priceWithPrefixRegex = /(?:₹|rs\.?|inr)\s*(\d{2,4})/i;
    const priceSeparatedRegex = /[-:—–\.…\|/]+\s*(\d{2,4})(?:\s*\/-)?\s*$/;

    let price = null;
    let name = '';

    const endMatch = line.match(priceRegex);
    const sepMatch = line.match(priceSeparatedRegex);
    const prefixMatch = line.match(priceWithPrefixRegex);

    if (sepMatch) {
      price = parseFloat(sepMatch[1]);
      name = line.substring(0, sepMatch.index).trim();
    } else if (endMatch && endMatch[1]) {
      price = parseFloat(endMatch[1]);
      name = line.replace(endMatch[0], '').trim();
    } else if (prefixMatch && prefixMatch[1]) {
      price = parseFloat(prefixMatch[1]);
      name = line.replace(prefixMatch[0], '').trim();
    }

    if (price && !isNaN(price) && price >= 10 && price <= 10000) {
      // Clean up dish name
      name = name
        .replace(/^[•\*\-\d+\.\)\(]+\s*/, '') // leading bullets or numbering
        .replace(/[-:—–\.…\|/]+\s*$/, '') // trailing separators
        .replace(/\s+/g, ' ')
        .trim();

      if (name.length >= 2 && name.length <= 80) {
        // Detect veg vs non-veg
        const lowerName = name.toLowerCase();
        let isVeg = true;

        if (lowerName.includes('(nv)') || lowerName.includes('[nv]') || lowerName.includes('non-veg') || lowerName.includes('non veg')) {
          isVeg = false;
        } else if (lowerName.includes('(v)') || lowerName.includes('[v]') || lowerName.includes('veg:')) {
          isVeg = true;
        } else {
          isVeg = !nonVegWords.some((w) => lowerName.includes(w));
        }

        // Clean out (V) or (NV) from display name
        const cleanName = name
          .replace(/\s*[\(\[]?(?:veg|non-veg|v|nv)[\)\]]?\s*/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        items.push({
          id: Date.now() + items.length + Math.floor(Math.random() * 1000),
          name: cleanName || name,
          category: currentCategory,
          price,
          isVeg,
          isAvailable: true,
          bullets: ['Freshly prepared with authentic ingredients'],
          tags: [],
          image: null
        });
      }
    }
  });

  return items;
}

/**
 * Scan a menu document (PDF or Image) using Gemini Vision API
 * Falls back to offline heuristic text extractor if offline or API key is absent.
 */
export async function scanMenuDocument({ file, rawText = '', customApiKey = '' }) {
  // 1. Direct text provided
  if (rawText && rawText.trim()) {
    const heuristicItems = parseRawMenuText(rawText);
    return {
      success: true,
      items: heuristicItems,
      count: heuristicItems.length,
      engine: 'text-heuristic'
    };
  }

  if (!file) {
    return { success: false, error: 'No menu file or text provided.' };
  }

  const mimeType = (file.type || '').toLowerCase();
  const isPdf = mimeType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);

  if (!isPdf && !isImage) {
    return {
      success: false,
      error: 'Unsupported file format. Please upload a PDF document or an image (PNG, JPG, WebP).'
    };
  }

  const apiKey = import.meta.env.PROD ? '' : (customApiKey || getStoredGeminiApiKey() || '').trim();
  if (file.size > 3_500_000) return { success: false, message: 'Please choose a file under 3.5 MB.' };

  // 2. Try Gemini Multimodal AI (if API key is present or server route is available)
  try {
    const base64Data = await fileToBase64(file);
    const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const effectiveMime = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');

    // Attempt 2a: Serverless route /api/ai/scan-menu
    try {
      const { getFirebaseAuth } = await import('./firebaseAuth.js');
      const { getActiveBusiness } = await import('./businessManager.js');
      const token = await getFirebaseAuth()?.currentUser?.getIdToken();
      const serverRes = await fetch('/api/ai/scan-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          fileBase64: pureBase64,
          mimeType: effectiveMime,
          businessId: getActiveBusiness()?.id
        })
      });

      if (serverRes.ok) {
        const result = await serverRes.json();
        if (result.success && Array.isArray(result.items) && result.items.length > 0) {
          return {
            success: true,
            items: result.items,
            count: result.items.length,
            engine: 'gemini-cloud'
          };
        }
      }
    } catch (serverErr) {
      // Serverless route not available (e.g. running in pure Vite dev), proceed to direct client call
    }

    // Attempt 2b: Direct Gemini REST API call from browser
    if (apiKey) {
      const prompt = `You are an expert restaurant menu digitizer.
Extract ALL dishes, food items, drinks, and combos with their prices and categories from this menu document.
Output STRICTLY valid JSON array:
[
  {
    "name": "Dish Name",
    "category": "Starters" | "Main Course" | "Breads" | "Rice & Biryani" | "Beverages" | "Desserts" | "Combos" | "Snacks",
    "price": 250,
    "isVeg": true,
    "bullets": ["Brief ingredients or description if present"],
    "tags": ["Bestseller" or "Chef Special" if indicated]
  }
]
Rules:
- price MUST be a single positive number.
- isVeg MUST be boolean (true for vegetarian, false for chicken/mutton/fish/egg/meat).
- Output STRICTLY JSON without markdown code fences or conversational text.`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const res = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: effectiveMime,
                  data: pureBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (res.ok) {
        const jsonRes = await res.json();
        const textOutput = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const clean = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) {
          if (parsed && Array.isArray(parsed.dishes)) parsed = parsed.dishes;
          else if (parsed && Array.isArray(parsed.items)) parsed = parsed.items;
          else parsed = [];
        }

        const validDishes = parsed
          .filter((d) => d && typeof d.name === 'string' && d.name.trim())
          .map((d, idx) => ({
            id: Date.now() + idx,
            name: d.name.trim(),
            category: d.category || 'Main Course',
            price: Number(d.price) || 100,
            isVeg: d.isVeg !== false,
            isAvailable: true,
            bullets: Array.isArray(d.bullets) && d.bullets.length > 0 ? d.bullets : ['Freshly prepared with authentic ingredients'],
            tags: Array.isArray(d.tags)
              ? d.tags.filter((t) => t && !['scanned', 'manual', 'new', 'unassigned'].includes(String(t).toLowerCase().trim()))
              : [],
            image: null
          }));

        if (validDishes.length > 0) {
          return {
            success: true,
            items: validDishes,
            count: validDishes.length,
            engine: 'gemini-direct'
          };
        }
      }
    }
  } catch (aiErr) {
    console.warn('Gemini AI parsing notice, falling back to local extractor:', aiErr);
  }

  // 3. Fallback: If it's a PDF, extract internal digital text stream
  if (isPdf) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const extractedText = extractTextFromPdfArrayBuffer(arrayBuffer);
      if (extractedText && extractedText.trim()) {
        const items = parseRawMenuText(extractedText);
        if (items.length > 0) {
          return {
            success: true,
            items,
            count: items.length,
            engine: 'pdf-stream-extractor'
          };
        }
      }
    } catch (pdfErr) {
      console.warn('Local PDF extraction note:', pdfErr);
    }
  }

  // If no Gemini key was configured and image could not be parsed with local tools
  return {
    success: false,
    reason: 'REQUIRES_GEMINI_KEY',
    message: 'Image scanning is unavailable. Please use Paste Menu Text or add dishes manually.'
  };
}
