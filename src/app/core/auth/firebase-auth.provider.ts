import { Injectable } from '@angular/core';

import { firebaseConfigured, firebaseServices } from '../firebase/firebase';
import { AppUser, AuthError, AuthErrorCode } from './auth.models';
import type { AuthProvider } from './auth-provider';

const ERROR_CODES: Record<string, AuthErrorCode> = {
  'auth/invalid-credential': 'invalid-credentials',
  'auth/invalid-login-credentials': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
};

function toAuthError(error: unknown): AuthError {
  const code = (error as { code?: string })?.code ?? '';
  return new AuthError(ERROR_CODES[code] ?? 'unknown');
}

@Injectable()
export class FirebaseAuthProvider implements AuthProvider {
  readonly configured = firebaseConfigured;

  watchUser(
    onChange: (user: AppUser | null) => void,
    onError: () => void
  ): () => void {
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    firebaseServices().then(({ auth, authInstance }) => {
      if (stopped) return;
      unsubscribe = auth.onAuthStateChanged(authInstance, user =>
        onChange(
          user && {
            id: user.uid,
            email: user.email,
            displayName: user.displayName,
          }
        )
      );
    }, onError);
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }

  async signUp(email: string, password: string): Promise<void> {
    const { auth, authInstance } = await firebaseServices();
    await auth
      .createUserWithEmailAndPassword(authInstance, email, password)
      .catch(error => Promise.reject(toAuthError(error)));
  }

  async signIn(email: string, password: string): Promise<void> {
    const { auth, authInstance } = await firebaseServices();
    await auth
      .signInWithEmailAndPassword(authInstance, email, password)
      .catch(error => Promise.reject(toAuthError(error)));
  }

  async signOut(): Promise<void> {
    const { auth, authInstance } = await firebaseServices();
    await auth.signOut(authInstance);
  }

  /** Stored on the Firebase Auth profile; email and password aren't touched. */
  async updateDisplayName(name: string): Promise<void> {
    const { auth, authInstance } = await firebaseServices();
    const user = authInstance.currentUser;
    if (!user) throw new AuthError('signed-out');
    await auth
      .updateProfile(user, { displayName: name })
      .catch(error => Promise.reject(toAuthError(error)));
  }
}
