import { environment } from '../../../environments/environment';

/** True when this build has a Firebase project to talk to. */
export const firebaseConfigured =
  environment.useFirebaseEmulators ||
  !!(environment.firebase.apiKey && environment.firebase.projectId);

/**
 * Photos on people's own recipes are kept in the recipe's Firestore document, so they
 * work wherever accounts do: no Cloud Storage bucket (or paid plan) needed.
 */
export const recipePhotosAvailable = firebaseConfigured;

/** True for development builds, which talk to the local emulators (npm run emulators). */
export const usingFirebaseEmulators = environment.useFirebaseEmulators;

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

const STORAGE_EMULATOR_PORT = 9199;
const STORAGE_RETRY_MS = 30_000;

let storage: Promise<{
  storageModule: typeof import('firebase/storage');
  storage: import('firebase/storage').FirebaseStorage;
}> | null = null;

/**
 * Cloud Storage, loaded on first use (only the recipe photo feature needs it), on the
 * same Firebase app as Auth and Firestore. Browser only.
 */
export function firebaseStorage() {
  storage ??= Promise.all([firebaseServices(), import('firebase/storage')])
    .then(([{ authInstance }, storageModule]) => {
      const instance = storageModule.getStorage(authInstance.app);
      // The SDK retries a failed upload for up to 10 minutes by default, which looks
      // like a save that never ends. Give up sooner and say so.
      instance.maxUploadRetryTime = STORAGE_RETRY_MS;
      instance.maxOperationRetryTime = STORAGE_RETRY_MS;
      if (environment.useFirebaseEmulators)
        storageModule.connectStorageEmulator(
          instance,
          '127.0.0.1',
          STORAGE_EMULATOR_PORT
        );
      return { storageModule, storage: instance };
    })
    .catch(error => {
      storage = null;
      throw error;
    });
  return storage;
}
