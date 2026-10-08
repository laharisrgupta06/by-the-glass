export interface AppUser {
  id: string;
  email: string | null;
}

/** 'unavailable' means this build has no auth backend configured. */
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unavailable';

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'too-many-requests'
  | 'network'
  | 'unknown';

/** Provider-neutral error so the app never depends on a provider's error codes. */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}
