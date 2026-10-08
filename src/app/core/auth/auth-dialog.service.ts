import { Injectable, signal } from '@angular/core';

export type AuthMode = 'sign-in' | 'sign-up';

export interface AuthDialogRequest {
  mode: AuthMode;
  /** Why we're asking, e.g. "Sign in to save Margarita." */
  reason?: string;
}

/**
 * Opens the sign-in dialog over the current page, so nobody loses their place
 * (filters, scroll position) when an action needs an account.
 */
@Injectable({ providedIn: 'root' })
export class AuthDialogService {
  readonly request = signal<AuthDialogRequest | null>(null);
  private resolve?: (signedIn: boolean) => void;

  /** Resolves true once the visitor has signed in or signed up, false if they dismiss it. */
  open(request: AuthDialogRequest): Promise<boolean> {
    this.resolve?.(false);
    this.request.set(request);
    return new Promise(resolve => (this.resolve = resolve));
  }

  close(signedIn: boolean): void {
    this.request.set(null);
    this.resolve?.(signedIn);
    this.resolve = undefined;
  }
}
