import { Injectable } from '@angular/core';

import { AppUser } from './auth.models';
import { FirebaseAuthProvider } from './firebase-auth.provider';

/**
 * The only place the app touches an auth backend. Swap the implementation by
 * providing a different class for this token.
 */
@Injectable({ providedIn: 'root', useClass: FirebaseAuthProvider })
export abstract class AuthProvider {
  abstract readonly configured: boolean;
  /** Calls back with the current user now and on every change. Returns an unsubscribe. */
  abstract watchUser(
    onChange: (user: AppUser | null) => void,
    onError: () => void
  ): () => void;
  /** Rejects with AuthError. */
  abstract signUp(email: string, password: string): Promise<void>;
  /** Rejects with AuthError. */
  abstract signIn(email: string, password: string): Promise<void>;
  abstract signOut(): Promise<void>;
}
