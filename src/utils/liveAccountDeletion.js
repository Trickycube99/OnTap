import { collection, query, where, limit, getDocs, doc, getDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseAuth';
import { initFirebase } from './firebaseSync';
import { getBusinesses, saveBusinesses } from './businessManager';
import { getScopedKey, STORAGE_KEYS } from './storage';
import { resetAllSessions } from './auth';

/** Keep the owner profile and login until all dependent cloud records are removed. */
export async function deleteLiveAccount(businessId) {
  const auth = getFirebaseAuth();
  const database = initFirebase();
  if (!auth || !database) return { success: false, error: 'Cloud deletion is unavailable. No deletion was confirmed.' };
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return { success: false, error: 'Sign in to the verified owner account before deleting it.' };
  try {
    const profile = await getDoc(doc(database, 'businesses', businessId));
    if (!profile.exists() || profile.data().owner?.email?.toLowerCase() !== user.email?.toLowerCase()) {
      return { success: false, error: 'The business owner must sign in to delete this account. Platform administrators must use the Firebase administration tools for remote account erasure.' };
    }
    const result = await user.getIdTokenResult(true);
    if (Date.now() / 1000 - Number(result.claims.auth_time) > 240) {
      return { success: false, error: 'Please sign out and sign back in before deleting your account.' };
    }
    for (const name of ['restaurant_orders', 'restaurant_checklists', 'restaurant_alerts', 'restaurant_config']) {
      while (true) {
        const records = await getDocs(query(collection(database, name), where('businessId', '==', businessId), limit(400)));
        if (records.empty) break;
        const batch = writeBatch(database);
        records.docs.forEach(record => batch.delete(record.ref));
        await batch.commit();
      }
    }
    const publicProfile = await getDoc(doc(database, 'public_businesses', businessId));
    if (publicProfile.exists()) await deleteDoc(publicProfile.ref);
    await deleteDoc(profile.ref);
    await deleteUser(user);
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(getScopedKey(key, businessId)));
    saveBusinesses(getBusinesses().filter(business => business.id !== businessId));
    resetAllSessions();
    return { success: true, status: 'completed', businessId };
  } catch {
    return { success: false, status: 'not_completed', error: 'Cloud erasure did not finish. Some records may already have been removed. Contact the platform administrator to complete erasure; this request has not been marked completed.' };
  }
}
