// Serverless API route for Menu Image/PDF extraction using Google Gemini AI
// Accepts base64 encoded document/image and extracts structured menu dishes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { fileBase64, mimeType, customApiKey } = req.body || {};
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    return res.status(200).json({
      success: false,
      reason: 'NO_API_KEY',
      message: 'No Gemini API key configured on server. Fallback to client-side parsing.'
    });
  }

  if (!fileBase64) {
    return res.status(400).json({ error: 'Missing fileBase64 in request body.' });
  }

  const cleanMimeType = (mimeType || 'image/jpeg').toLowerCase();
  // Strip any data URL prefix if sent
  const pureBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;

  const prompt = `You are an expert restaurant menu digitizer.
Analyze this restaurant menu document or image carefully.
Extract ALL dishes, food items, drinks, and combos with their prices and categories.

Return a STRICTLY VALID JSON ARRAY of items with the following structure:
[
  {
    "name": "Dish Name",
    "category": "Starters" | "Main Course" | "Breads" | "Rice & Biryani" | "Beverages" | "Desserts" | "Combos" | "Snacks",
    "price": 250,
    "isVeg": true,
    "bullets": ["Brief description or ingredients if mentioned"],
    "tags": ["Bestseller" or "Chef Special" if noted, else empty]
  }
]

Extraction Rules:
1. "price" MUST be a single positive number (extract digits only, ignoring ₹, Rs, INR). If there are multiple sizes (e.g. Half 160 / Full 300), create separate items like "Dish (Half)" and "Dish (Full)" or use the default size price.
2. "isVeg" MUST be a boolean: true for vegetarian items (paneer, dal, mushroom, veg, roti, naan, salad, beverages, etc.), false for non-vegetarian (chicken, mutton, fish, prawn, egg, meat, pork, beef, etc.).
3. "category" must logically categorize the dish into one of the common restaurant categories.
4. Output STRICTLY raw JSON array, without any markdown formatting, preamble, or conversational notes.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: cleanMimeType,
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.warn('Gemini API returned error:', geminiRes.status, errText);
      return res.status(200).json({
        success: false,
        reason: 'GEMINI_ERROR',
        message: `Gemini API error (${geminiRes.status}): ${errText.slice(0, 200)}`
      });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Parse JSON
    let items = [];
    try {
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      items = JSON.parse(cleanJson);
      if (!Array.isArray(items)) {
        if (items && Array.isArray(items.dishes)) items = items.dishes;
        else if (items && Array.isArray(items.items)) items = items.items;
        else items = [];
      }
    } catch (parseErr) {
      console.warn('Error parsing Gemini JSON response:', parseErr, rawText);
      return res.status(200).json({
        success: false,
        reason: 'PARSE_ERROR',
        message: 'Could not parse JSON from AI model response.'
      });
    }

    // Sanitize items
    const sanitized = items
      .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
      .map((it, idx) => ({
        id: Date.now() + idx,
        name: it.name.trim(),
        category: it.category || 'Main Course',
        price: Number(it.price) || 100,
        isVeg: it.isVeg !== false,
        isAvailable: true,
        bullets: Array.isArray(it.bullets) && it.bullets.length > 0
          ? it.bullets
          : ['Freshly prepared with authentic ingredients'],
        tags: Array.isArray(it.tags) ? it.tags : ['New'],
        image: null
      }));

    return res.status(200).json({
      success: true,
      items: sanitized,
      count: sanitized.length,
      engine: 'gemini-1.5-flash'
    });
  } catch (err) {
    console.error('Server error in scan-menu:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message
    });
  }
}
