import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('mobile-audit-screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  const devices = [
    { name: 'iPhone-14', width: 390, height: 844 },
    { name: 'iPhone-SE', width: 375, height: 667 }
  ];

  for (const dev of devices) {
    console.log(`\n================ Testing ${dev.name} (${dev.width}x${dev.height}) ================`);
    const context = await browser.newContext({
      viewport: { width: dev.width, height: dev.height },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });

    // Seed localStorage so business is configured and Owner is logged in
    await context.addInitScript(() => {
      const bizId = 'biz_demo_restaurant';
      const mockBiz = {
        id: bizId,
        name: 'The Royal Bistro',
        tagline: 'Gourmet Artisanal Flavors',
        status: 'active',
        owner: { email: 'owner@royalbistro.com', name: 'Vikram Mehta', pin: '123456' },
        counter: { terminalName: 'Terminal 01', pin: '123456' },
        tables: ['Table 01', 'Table 02', 'Table 03', 'Table 04', 'Counter / Takeaway'],
        serviceType: 'dine_in'
      };

      const mockTheme = {
        restaurantName: 'The Royal Bistro',
        tagline: 'Gourmet Artisanal Flavors',
        accentColor: '#007AFF',
        tables: mockBiz.tables,
        serviceType: 'dine_in'
      };

      const mockMenu = [
        { id: 'item_1', name: 'Artisan Paneer Tikka', price: 340, category: 'Starters', isVeg: true, inStock: true },
        { id: 'item_2', name: 'Dal Makhani Gold', price: 290, category: 'Mains', isVeg: true, inStock: true },
        { id: 'item_3', name: 'Butter Naan Basket', price: 90, category: 'Breads', isVeg: true, inStock: true }
      ];

      const mockOrders = [
        {
          id: 'ORD-101',
          table: 'Table 01',
          customerName: 'Aarav Sharma',
          items: [{ id: 'item_1', name: 'Artisan Paneer Tikka', price: 340, qty: 1 }],
          total: 340,
          status: 'served',
          paymentMode: 'UPI',
          timestamp: '12:30 PM',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ORD-102',
          table: 'Table 02',
          customerName: 'Priya Verma',
          items: [{ id: 'item_2', name: 'Dal Makhani Gold', price: 290, qty: 1 }],
          total: 290,
          status: 'cooking',
          paymentMode: 'Cash',
          timestamp: '01:05 PM',
          createdAt: new Date().toISOString()
        }
      ];

      const adminSession = {
        role: 'admin',
        businessId: bizId,
        businessName: mockBiz.name,
        name: mockBiz.owner.name,
        email: mockBiz.owner.email,
        token: 'mock_admin_token',
        authenticatedAt: new Date().toISOString()
      };

      localStorage.setItem('flowscape_businesses_v1', JSON.stringify([mockBiz]));
      localStorage.setItem('flowscape_active_business_id_v1', bizId);
      localStorage.setItem('ontap_v5_menu_' + bizId, JSON.stringify(mockMenu));
      localStorage.setItem('ontap_v5_orders_' + bizId, JSON.stringify(mockOrders));
      localStorage.setItem('ontap_v5_theme_' + bizId, JSON.stringify(mockTheme));
      sessionStorage.setItem('flowscape_auth_sessions_v3', JSON.stringify({ admin: adminSession }));
      sessionStorage.setItem('flowscape_switched_from_admin', 'true');
      localStorage.setItem('ontap_cookie_consent_v1', JSON.stringify({ essential: true, analytics: false, marketing: false }));
    });

    const page = await context.newPage();

    // 1. Check Owner Admin View Tabs
    const tabs = [
      { id: 'sales', name: 'Sales' },
      { id: 'orders', name: 'Order History' },
      { id: 'punch', name: 'Punch Walk-in' },
      { id: 'pnl', name: 'Profits & Expenses' },
      { id: 'eod-checklists', name: 'Daily Cash Check' },
      { id: 'offers', name: 'Discount Offers' },
      { id: 'payroll', name: 'Staff & Salaries' },
      { id: 'menu', name: 'Edit Menu' },
      { id: 'branding', name: 'Store Settings' }
    ];

    for (const t of tabs) {
      await page.goto(`http://localhost:5173/#admin`);
      await page.waitForTimeout(1000);

      // Click the tab if available
      const tabButton = await page.locator(`button.capsule-tab:has-text("${t.name}")`).first();
      const tabCount = await tabButton.count();
      if (tabCount > 0) {
        await tabButton.click();
        await page.waitForTimeout(500);
      } else {
        // Try clicking via id or text matching
        const fallback = await page.locator(`button.capsule-tab`).filter({ hasText: new RegExp(t.name, 'i') }).first();
        if (await fallback.count() > 0) {
          await fallback.click();
          await page.waitForTimeout(500);
        }
      }

      // Check overflow
      const overflow = await page.evaluate(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const main = document.querySelector('.app-main-viewport') || document.querySelector('.app-content-container') || body;
        const winWidth = window.innerWidth;

        const overflowingElements = [];
        document.querySelectorAll('*').forEach((el) => {
          if (el.scrollWidth > winWidth + 2) {
            const tag = el.tagName.toLowerCase();
            const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '';
            const id = el.id ? `#${el.id}` : '';
            overflowingElements.push({
              desc: `${tag}${id}.${cls}`,
              scrollWidth: el.scrollWidth,
              winWidth: winWidth
            });
          }
        });

        return {
          winWidth,
          docScrollWidth: docEl.scrollWidth,
          bodyScrollWidth: body.scrollWidth,
          mainScrollWidth: main.scrollWidth,
          overflowingElements: overflowingElements.slice(0, 10)
        };
      });

      console.log(`[Tab: ${t.name}] windowWidth: ${overflow.winWidth}, docScrollWidth: ${overflow.docScrollWidth}`);
      if (overflow.docScrollWidth > overflow.winWidth) {
        console.warn(`  ⚠️ PAGE OVERFLOW DETECTED: ${overflow.docScrollWidth}px > ${overflow.winWidth}px!`);
        overflow.overflowingElements.forEach(o => {
          console.warn(`    - Element: ${o.desc} (scrollWidth: ${o.scrollWidth}px)`);
        });
      } else {
        console.log(`  ✅ Tab is within mobile viewport (no horizontal spill)`);
      }

      const filePath = path.join(outDir, `${dev.name}_admin_${t.id}.png`);
      await page.screenshot({ path: filePath });
    }

    // 2. Check Counterperson POS View
    await page.goto(`http://localhost:5173/#counter`);
    await page.waitForTimeout(1000);
    const counterOverflow = await page.evaluate(() => {
      return {
        winWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth
      };
    });
    console.log(`[Counter View] windowWidth: ${counterOverflow.winWidth}, docScrollWidth: ${counterOverflow.docScrollWidth}`);
    await page.screenshot({ path: path.join(outDir, `${dev.name}_counter.png`) });

    // 3. Check Customer Dining View
    await page.goto(`http://localhost:5173/?table=1`);
    await page.waitForTimeout(1000);
    const customerOverflow = await page.evaluate(() => {
      return {
        winWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth
      };
    });
    console.log(`[Customer View] windowWidth: ${customerOverflow.winWidth}, docScrollWidth: ${customerOverflow.docScrollWidth}`);
    await page.screenshot({ path: path.join(outDir, `${dev.name}_customer.png`) });

    await context.close();
  }

  await browser.close();
  console.log('\nAudit complete! Screenshots saved in: ' + outDir);
}

run().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
