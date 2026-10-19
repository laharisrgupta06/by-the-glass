import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { usingFirebaseEmulators } from '../firebase/firebase';
import { AppUser, AuthError, AuthErrorCode, AuthStatus } from './auth.models';
import { AuthProvider } from './auth-provider';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_DISPLAY_NAME_LENGTH = 50;

/** Why a display name can't be used, or null when it's fine. */
export function displayNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name, or cancel to keep things as they are.';
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH)
    return `Keep your name to ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed))
    return 'Use letters, numbers, spaces and ordinary punctuation.';
  return null;
}

/**
 * Development builds talk to the local emulators, so "can't reach the server" there
 * almost always means they aren't running. Say so, instead of blaming the connection.
 */
export function networkMessage(usingEmulators: boolean): string {
  return usingEmulators
    ? 'Can’t reach the local Firebase emulators. Start them with npm run emulators, then try again.'
    : 'We can’t reach the server. Check your connection and try again.';
}

const MESSAGES: Record<AuthErrorCode, string> = {
  'invalid-credentials': "That email and password don't match.",
  'email-in-use':
    'There’s already an account with that email. Try signing in instead.',
  'weak-password': `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
  'invalid-email': 'That email address doesn’t look quite right.',
  'too-many-requests': 'Too many attempts. Wait a moment, then try again.',
  network: networkMessage(usingFirebaseEmulators),
  'signed-out': 'You’ve been signed out. Sign in again, then try once more.',
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

  /** Changes the name shown on the profile. Resolves with an error message, or null. */
  async updateDisplayName(name: string): Promise<string | null> {
    const problem = displayNameProblem(name);
    if (problem) return problem;
    const user = this.user();
    if (!user) return MESSAGES['signed-out'];
    const clean = name.trim().replace(/\s+/g, ' ');
    const error = await this.attempt(() =>
      this.provider.updateDisplayName(clean)
    );
    // The provider doesn't announce profile changes, so update the signal here.
    if (!error)
      this.user.update(current =>
        current?.id === user.id ? { ...current, displayName: clean } : current
      );
    return error;
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
