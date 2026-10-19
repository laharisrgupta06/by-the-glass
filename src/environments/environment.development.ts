/**
 * Development settings: talks to the local Firebase emulators (npm run emulators).
 * "demo-" project ids only work with emulators, so no real project is touched.
 */
export const environment = {
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-by-the-glass.firebaseapp.com',
    projectId: 'demo-by-the-glass',
    appId: 'demo-by-the-glass',
    // The Storage emulator's bucket for recipe photos (npm run emulators).
    storageBucket: 'demo-by-the-glass.appspot.com',
  },
  useFirebaseEmulators: true,
  /** The venue-menu drinks (venue-menu.data.ts). */
  venueMenu: true,
};
