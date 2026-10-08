import { environment } from '../../../environments/environment';

/** True when this build has a Firebase project to talk to. */
export const firebaseConfigured =
  environment.useFirebaseEmulators ||
  !!(environment.firebase.apiKey && environment.firebase.projectId);

export type FirebaseServices = Awaited<ReturnType<typeof initFirebase>>;

let services: Promise<FirebaseServices> | null = null;

/**
 * Loads and initialises Firebase on first use. The SDK is imported dynamically so it
 * stays out of the initial bundle, and it must only be called in the browser.
 */
export function firebaseServices(): Promise<FirebaseServices> {
  services ??= initFirebase().catch(error => {
    services = null;
    throw error;
  });
  return services;
}

async function initFirebase() {
  const [{ initializeApp }, auth, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const app = initializeApp(environment.firebase);
  // getAuth keeps the session in IndexedDB, so it survives page refreshes.
  const authInstance = auth.getAuth(app);
  const db = firestore.getFirestore(app);
  if (environment.useFirebaseEmulators) {
    auth.connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    firestore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { auth, authInstance, firestore, db };
}
