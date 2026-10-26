import { readFile } from 'node:fs/promises';
import { test, after, before } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';

let environment;
const businessId = 'restaurant_test';
const fixture = {
  id: 'order_test', originalOrderId: 'order_test', businessId, dinerUid: 'diner_one', status: 'received',
  paymentStatus: 'Pay at Counter (Pending)', items: [{ id: 'dish_test', name: 'Dal', menuIndex: 0, price: 180, quantity: 2, isAvailable: true }],
  subtotal: 360, discount: 0, tax: 0, total: 360, promoIndex: -1, appliedPromoCode: null,
};
const writeOrder = (database, id, data) => setDoc(doc(database, 'restaurant_orders', `${businessId}_${id}`), { ...data, id, originalOrderId: id });
const orderRef = database => doc(database, 'restaurant_orders', 'restaurant_test_order_test');
before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-ontap', firestore: { rules: await readFile('firestore.rules', 'utf8') } });
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore();
    await setDoc(doc(database, 'businesses', businessId), { id: businessId, owner: { email: 'owner@example.test' }, counter: {}, status: 'active' });
    await setDoc(doc(database, 'public_businesses', businessId), { id: businessId, name: 'Test Kitchen', status: 'active' });
    await setDoc(doc(database, 'restaurant_config', `${businessId}_menu`), { businessId, menu: [{ id: 'dish_test', name: 'Dal', price: 180, isAvailable: true }] });
    await setDoc(doc(database, 'restaurant_config', `${businessId}_offers`), { businessId, offers: [{ code: 'TEST', type: 'percent', value: 10, isActive: true }] });
    await setDoc(orderRef(database), fixture);
  });
});
after(async () => environment?.cleanup());
const diner = id => environment.authenticatedContext(id, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const owner = () => environment.authenticatedContext('owner_one', { email: 'owner@example.test', email_verified: true }).firestore();

test('public menu can be read without access to private business records', async () => {
  const database = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(database, 'restaurant_config', `${businessId}_menu`)));
  await assertFails(getDoc(doc(database, 'businesses', businessId)));
});
test('diner only reads their own order and scoped query', async () => {
  await assertSucceeds(getDoc(orderRef(diner('diner_one'))));
  await assertFails(getDoc(orderRef(diner('diner_two'))));
  await assertSucceeds(getDocs(query(collection(diner('diner_one'), 'restaurant_orders'), where('businessId', '==', businessId), where('dinerUid', '==', 'diner_one'))));
  await assertFails(getDocs(query(collection(diner('diner_one'), 'restaurant_orders'), where('businessId', '==', businessId))));
});
test('new diner order validates against menu prices', async () => {
  await assertSucceeds(writeOrder(diner('diner_one'), 'new_order', fixture));
  await assertFails(writeOrder(diner('diner_one'), 'wrong_price', { ...fixture, items: [{ ...fixture.items[0], price: 1 }], subtotal: 2, total: 2 }));
  await assertFails(writeOrder(diner('diner_one'), 'wrong_total', { ...fixture, total: 1 }));
  await assertFails(writeOrder(diner('diner_one'), 'wrong_uid', { ...fixture, dinerUid: 'diner_two' }));
});
test('coupons are calculated from the published offer', async () => {
  await assertSucceeds(writeOrder(diner('diner_one'), 'coupon_order', { ...fixture, promoIndex: 0, appliedPromoCode: 'TEST', discount: 36, total: 324 }));
  await assertFails(writeOrder(diner('diner_one'), 'coupon_tamper', { ...fixture, promoIndex: 0, appliedPromoCode: 'TEST', discount: 359, total: 1 }));
});
test('diner cannot claim payment, change order status, or alter saved dishes', async () => {
  await assertFails(writeOrder(diner('diner_one'), 'paid_order', { ...fixture, paymentStatus: 'paid' }));
  await assertFails(updateDoc(orderRef(diner('diner_one')), { status: 'served' }));
  await assertFails(updateDoc(orderRef(diner('diner_one')), { total: 0 }));
});
test('owner and assigned staff have tenant access, other tenants do not', async () => {
  await assertSucceeds(getDoc(doc(owner(), 'businesses', businessId)));
  await assertSucceeds(getDocs(query(collection(owner(), 'businesses'), where('owner.email', '==', 'owner@example.test'))));
  await assertSucceeds(updateDoc(orderRef(owner()), { status: 'cooking' }));
  const staff = environment.authenticatedContext('staff_one', { email: 'staff@example.test', email_verified: true, role: 'counter', businessId }).firestore();
  await assertSucceeds(getDoc(orderRef(staff)));
  const other = environment.authenticatedContext('other_owner', { email: 'other@example.test', email_verified: true }).firestore();
  await assertFails(getDoc(orderRef(other)));
  await assertFails(setDoc(doc(other, 'restaurant_checklists', 'injected_report'), { businessId }));
});
test('public projections reject private fields', async () => {
  await assertFails(setDoc(doc(owner(), 'public_businesses', businessId), { id: businessId, name: 'Test Kitchen', owner: { email: 'owner@example.test' } }));
});
for (const count of [4, 6, 8]) test(`${count} validated dishes fit within rule evaluation limits`, async () => {
  const items = Array.from({ length: count }, () => ({ ...fixture.items[0], quantity: 1 }));
  await assertSucceeds(writeOrder(diner('diner_one'), `large_order_${count}`, { ...fixture, items, subtotal: 180 * count, total: 180 * count }));
});
test('idempotent diner retry cannot change order content', async () => {
  await assertSucceeds(updateDoc(orderRef(diner('diner_one')), { _cloudSyncedAt: 123 }));
  await assertFails(updateDoc(orderRef(diner('diner_one')), { items: [] }));
});
test('an email alone does not grant developer privileges', async () => {
  const ordinary = environment.authenticatedContext('ordinary', { email: 'ordinary@example.test', email_verified: true }).firestore();
  await assertFails(getDoc(doc(ordinary, 'system_config', 'developer_credentials')));
  await assertFails(getDoc(doc(ordinary, 'businesses', businessId)));
});

test('maximum-size order accepts a valid coupon', async () => {
  const items = Array.from({ length: 8 }, () => ({ ...fixture.items[0], quantity: 1 }));
  await assertSucceeds(writeOrder(diner('diner_one'), 'large_coupon', { ...fixture, items, subtotal: 1440, promoIndex: 0, appliedPromoCode: 'TEST', discount: 144, total: 1296 }));
});
test('oversized submissions are rejected', async () => {
  const items = Array.from({ length: 9 }, () => ({ ...fixture.items[0], quantity: 1 }));
  await assertFails(writeOrder(diner('diner_one'), 'oversized_order', { ...fixture, items, subtotal: 1620, total: 1620 }));
});
