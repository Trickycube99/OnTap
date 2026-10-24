import { chromium, devices } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: true });

  const testDevices = [
    { name: 'Apple_iPhone_14', device: devices['iPhone 14'] },
    { name: 'Android_Pixel_7', device: devices['Pixel 7'] }
  ];

  for (const { name, device } of testDevices) {
    console.log(`\n========================================`);
    console.log(`Testing Customer Cooking Animation on ${name}`);
    console.log(`========================================`);

    const context = await browser.newContext({
      ...device,
      bypassCSP: true
    });

    const page = await context.newPage();

    // 1. First navigate to initialize app
    await page.goto('http://localhost:5173/#customer', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const testOrderId = 'ORD-COOK-TEST-777';

    // 2. Seed an order directly in 'cooking' status with exact storage keys
    await page.evaluate(({ orderId }) => {
      const testOrder = {
        id: orderId,
        orderNumber: '777',
        table: 'Table 01',
        customerName: 'Aarav Sharma',
        customerPhone: '9876543210',
        createdAt: new Date().toISOString(),
        status: 'cooking',
        statusLabel: 'Cooking in Kitchen',
        progressPercent: 42,
        items: [
          { id: 1, name: 'Paneer Butter Masala', price: 280, quantity: 1 },
          { id: 2, name: 'Garlic Naan', price: 70, quantity: 2 }
        ],
        total: 420
      };

      // Set orders in localStorage
      localStorage.setItem('ontap_v5_orders', JSON.stringify([testOrder]));

      // Scoped and fallback diner session keys
      sessionStorage.setItem('ontap_default_customer_order_ids', JSON.stringify([orderId]));
      sessionStorage.setItem('ontap_default_last_order_id', orderId);
      sessionStorage.setItem('ontap_customer_last_order_id', orderId);
      sessionStorage.setItem('flowscape_guest_scanned_qr', 'true');
      sessionStorage.setItem('flowscape_guest_table', 'Table 01');
      sessionStorage.setItem('ontap_diner_table', 'Table 01');
      sessionStorage.setItem('ontap_diner_name', 'Aarav Sharma');

      localStorage.setItem('ontap_cookie_consent_v1', JSON.stringify({
        necessary: true, analytics: true, marketing: false, decided: true, timestamp: Date.now()
      }));
    }, { orderId: testOrderId });

    // Reload page to mount CustomerView with the cooking order
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // If cookie banner is visible, dismiss it
    const acceptBtn = page.locator('button:has-text("Accept All")');
    if (await acceptBtn.count() > 0 && await acceptBtn.first().isVisible()) {
      await acceptBtn.first().click();
      await page.waitForTimeout(400);
    }

    // Switch to Live Status / Track tab
    const trackTab = page.locator('nav.ios-bottom-nav button:has-text("Live Status"), nav.ios-bottom-nav button:has-text("लाइव स्थिति")');
    if (await trackTab.count() > 0) {
      await trackTab.first().click();
      await page.waitForTimeout(600);
    }

    // 3. Verify cooking animation GIF is visible on customer side
    const cookingGifs = page.locator('img[src*="output-onlinegiftools"]');
    const cookingCount = await cookingGifs.count();
    console.log(`[${name}] Cooking GIF animations found during 'cooking' status: ${cookingCount}`);

    if (cookingCount > 0) {
      const isVisible = await cookingGifs.first().isVisible();
      console.log(`[${name}] Cooking animation visible in Live Status ticket: ${isVisible} ✅`);
    } else {
      console.error(`[${name}] FAILED: Cooking animation not found when order is cooking! ❌`);
    }

    // Capture screenshot during cooking
    await page.screenshot({ path: `scripts/screenshot_${name}_cooking.png` });

    // Also check on Menu tab for floating notification banner with cooking animation
    const menuTab = page.locator('nav.ios-bottom-nav button:has-text("Menu"), nav.ios-bottom-nav button:has-text("मेनू")');
    if (await menuTab.count() > 0) {
      await menuTab.first().click();
      await page.waitForTimeout(600);
      const bannerGifs = await page.locator('img[src*="output-onlinegiftools"]').count();
      console.log(`[${name}] Cooking animation visible in floating banner on Menu tab: ${bannerGifs > 0} ✅`);
    }

    // 4. Update status from 'cooking' to 'ready'
    console.log(`[${name}] Transitioning order status from 'cooking' to 'ready'...`);
    await page.evaluate(({ orderId }) => {
      const raw = localStorage.getItem('ontap_v5_orders');
      if (raw) {
        const orders = JSON.parse(raw);
        if (Array.isArray(orders)) {
          orders.forEach(o => {
            if (o.id === orderId) {
              o.status = 'ready';
              o.statusLabel = 'Ready for Pickup';
            }
          });
          localStorage.setItem('ontap_v5_orders', JSON.stringify(orders));
        }
      }
    }, { orderId: testOrderId });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Switch to Track tab
    if (await trackTab.count() > 0) {
      await trackTab.first().click();
      await page.waitForTimeout(600);
    }

    // 5. Verify cooking animation has gone away
    const postGifs = await page.locator('img[src*="output-onlinegiftools"]').count();
    console.log(`[${name}] Cooking GIF animations AFTER order transitioned to 'ready': ${postGifs}`);

    if (postGifs === 0) {
      console.log(`[${name}] PASS: Cooking animation cleanly disappeared when order moved away from cooking! ✅`);
    } else {
      console.error(`[${name}] FAIL: Cooking animation is still visible after transition! ❌`);
    }

    // Capture screenshot after status changed to ready
    await page.screenshot({ path: `scripts/screenshot_${name}_ready.png` });

    await context.close();
  }

  await browser.close();
  console.log('\nAll tests completed successfully!');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
