/**
 * Production settings. Fill in the web app config from your Firebase project
 * (Project settings → Your apps → Web app). These values identify the project and
 * are safe in client code: access is controlled by Firestore security rules.
 * While apiKey or projectId is empty, accounts and favorites are switched off.
 */
export const environment = {
  firebase: {
    apiKey: 'AIzaSyD3ZBoIhF8oYFmPvuXd1rHRQ_8VD7zZq8o',
    authDomain: 'by-the-glass-9418d.firebaseapp.com',
    projectId: 'by-the-glass-9418d',
    appId: '1:737118422804:web:634bd2ba9334514ed9a401',
    /**
     * Cloud Storage bucket for photos on people's own recipes. Empty keeps photo
     * uploads switched off. New Firebase Storage buckets need the pay-as-you-go
     * (Blaze) plan; deploy storage.rules with it.
     */
    storageBucket: '',
  },
  /** Point Auth and Firestore at the local Firebase emulators. */
  useFirebaseEmulators: false,
  /**
   * The venue-menu drinks. Off in production until permission to republish the menu
   * is confirmed; production builds also swap out its data (angular.json).
   */
  venueMenu: false,
};
