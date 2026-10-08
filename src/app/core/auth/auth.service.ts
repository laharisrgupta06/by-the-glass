import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AppUser, AuthError, AuthErrorCode, AuthStatus } from './auth.models';
import { AuthProvider } from './auth-provider';

export const MIN_PASSWORD_LENGTH = 8;

const MESSAGES: Record<AuthErrorCode, string> = {
  'invalid-credentials': "That email and password don't match.",
  'email-in-use':
    'There’s already an account with that email. Try signing in instead.',
  'weak-password': `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
  'invalid-email': 'That email address doesn’t look quite right.',
  'too-many-requests': 'Too many attempts. Wait a moment, then try again.',
  network: 'We can’t reach the server. Check your connection and try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** The app's view of who is signed in. Components use this, never the provider. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private provider = inject(AuthProvider);

  // The session is only known in the browser, so SSR renders the loading state.
  readonly status = signal<AuthStatus>('loading');
  readonly user = signal<AppUser | null>(null);
  readonly signedIn = computed(() => this.status() === 'signed-in');

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    if (!this.provider.configured) {
      this.status.set('unavailable');
      return;
    }
    this.provider.watchUser(
      user => {
        this.user.set(user);
        this.status.set(user ? 'signed-in' : 'signed-out');
      },
      () => this.status.set('unavailable')
    );
  }

  /** Resolves with an error message to show, or null on success. */
  signUp(email: string, password: string): Promise<string | null> {
    if (password.length < MIN_PASSWORD_LENGTH)
      return Promise.resolve(MESSAGES['weak-password']);
    return this.attempt(() => this.provider.signUp(email.trim(), password));
  }

  signIn(email: string, password: string): Promise<string | null> {
    return this.attempt(() => this.provider.signIn(email.trim(), password));
  }

  signOut(): Promise<string | null> {
    return this.attempt(() => this.provider.signOut());
  }

  private async attempt(action: () => Promise<void>): Promise<string | null> {
    try {
      await action();
      return null;
    } catch (error) {
      return MESSAGES[error instanceof AuthError ? error.code : 'unknown'];
    }
  }
}
