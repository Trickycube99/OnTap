import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of ['/', '/admin', '/counter', '/portal', '/?table=04']) {
    await page.goto(`http://localhost:8889${route}`);
    await page.waitForFunction(() => document.querySelector('#root')?.textContent.length > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow at ${route}`);
  }
  await page.evaluate(async () => {
    const ReactModule = await import('/node_modules/.vite/deps/react.js');
    const React = ReactModule.default || ReactModule;
    const renderer = await import('/node_modules/.vite/deps/react-dom_client.js');
    const createRoot = renderer.createRoot || renderer.default.createRoot;
    const { default: EditDish } = await import('/src/components/EditDishModal.jsx');
    const { default: Scanner } = await import('/src/components/MenuScannerModal.jsx');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const pause = () => new Promise(resolve => setTimeout(resolve, 150));
    const noop = () => {};
    for (const dish of [null, { id: 'test_dish', name: 'Dal', price: 180 }, null]) {
      root.render(React.createElement(EditDish, { dish, onSave: noop, onClose: noop }));
      await pause();
    }
    for (const isOpen of [false, true, false]) {
      root.render(React.createElement(Scanner, { isOpen, onImportDishes: noop, onClose: noop }));
      await pause();
    }
    root.unmount();
    host.remove();
  });
  assert.deepEqual(errors, []);
  for (const route of ['/api/not-real', '/api/auth/verify-session']) {
    const response = await fetch(`http://localhost:8889${route}`);
    assert.equal(response.headers.get('content-type').includes('application/json'), true);
    assert.equal(response.status, route === '/api/not-real' ? 404 : 401);
  }
  console.log('Five mobile routes, both modal lifecycles, and API routing passed.');
} finally { await browser.close(); }
