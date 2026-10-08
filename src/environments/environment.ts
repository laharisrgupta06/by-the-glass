/**
 * Production settings. Fill in the web app config from your Firebase project
 * (Project settings → Your apps → Web app). These values identify the project and
 * are safe in client code: access is controlled by Firestore security rules.
 * While apiKey or projectId is empty, accounts and favorites are switched off.
 */
export const environment = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: '',
  },
  /** Point Auth and Firestore at the local Firebase emulators. */
  useFirebaseEmulators: false,
};
