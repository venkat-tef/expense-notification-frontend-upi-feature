import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

export const firebaseApp = initializeApp(environment.firebaseConfig);

// Exported so MemberService can spin up a secondary, throwaway Firebase app instance
// when an admin creates a new member's login — this lets us call
// createUserWithEmailAndPassword() for the new account without signing the
// currently logged-in admin out of their own session.
export const firebaseConfig = environment.firebaseConfig;

// Firestore with local persistence so the calendar keeps working offline
// and updates instantly once connectivity returns.
export const firestoreDb = (() => {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
})();

export const firebaseAuth = getAuth(firebaseApp);

/** Used to store expense bill images (see ExpenseService.uploadBillImage). */
export const firebaseStorage = getStorage(firebaseApp);