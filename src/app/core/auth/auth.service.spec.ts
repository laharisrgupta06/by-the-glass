import { TestBed } from '@angular/core/testing';

import { AuthError } from './auth.models';
import { AuthProvider } from './auth-provider';
import { AuthService, networkMessage } from './auth.service';

describe('AuthService', () => {
  let provider: jasmine.SpyObj<AuthProvider>;
  let service: AuthService;

  beforeEach(() => {
    provider = jasmine.createSpyObj<AuthProvider>(
      'AuthProvider',
      ['watchUser', 'signUp', 'signIn', 'signOut', 'updateDisplayName'],
      { configured: true }
    );
    provider.watchUser.and.callFake(onChange => {
      onChange(null);
      return () => undefined;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: AuthProvider, useValue: provider }],
    });
    service = TestBed.inject(AuthService);
  });

  it('reports a signed-out session', () => {
    expect(service.status()).toBe('signed-out');
  });

  it('turns provider errors into human messages', async () => {
    provider.signIn.and.rejectWith(new AuthError('invalid-credentials'));
    expect(await service.signIn('a@example.com', 'wrong-password')).toBe(
      "That email and password don't match."
    );
  });

  it('rejects short passwords before calling the provider', async () => {
    expect(await service.signUp('a@example.com', 'short')).toContain(
      'at least 8'
    );
    expect(provider.signUp).not.toHaveBeenCalled();
  });

  it('points development builds at the emulators when the server is unreachable', () => {
    expect(networkMessage(true)).toContain('npm run emulators');
    expect(networkMessage(false)).toBe(
      'We can’t reach the server. Check your connection and try again.'
    );
  });

  it('shows the connection message for network errors in this build', async () => {
    provider.signIn.and.rejectWith(new AuthError('network'));
    // Unit tests build with the production environment (no emulators).
    expect(await service.signIn('a@example.com', 'a-password')).toBe(
      networkMessage(false)
    );
  });

  describe('display name', () => {
    const signIn = () =>
      (provider.watchUser.calls.mostRecent().args[0] as (u: unknown) => void)({
        id: 'u1',
        email: 'asha@example.com',
        displayName: null,
      });

    it('saves a tidied name and shows it straight away, keeping the email', async () => {
      signIn();
      provider.updateDisplayName.and.resolveTo();
      expect(await service.updateDisplayName('  Asha   Rao ')).toBeNull();
      expect(provider.updateDisplayName).toHaveBeenCalledWith('Asha Rao');
      expect(service.user()).toEqual({
        id: 'u1',
        email: 'asha@example.com',
        displayName: 'Asha Rao',
      });
    });

    it('checks the name before calling the provider', async () => {
      signIn();
      expect(await service.updateDisplayName('   ')).toContain('Enter a name');
      expect(await service.updateDisplayName('x'.repeat(51))).toContain(
        '50 characters'
      );
      expect(provider.updateDisplayName).not.toHaveBeenCalled();
    });

    it('keeps the old name and explains when saving fails', async () => {
      signIn();
      provider.updateDisplayName.and.rejectWith(new AuthError('network'));
      expect(await service.updateDisplayName('Asha')).toBe(
        networkMessage(false)
      );
      expect(service.user()!.displayName).toBeNull();
    });

    it('needs someone signed in', async () => {
      expect(await service.updateDisplayName('Asha')).toContain('signed out');
      expect(provider.updateDisplayName).not.toHaveBeenCalled();
    });
  });
});
