import { TestBed } from '@angular/core/testing';

import { AuthError } from './auth.models';
import { AuthProvider } from './auth-provider';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let provider: jasmine.SpyObj<AuthProvider>;
  let service: AuthService;

  beforeEach(() => {
    provider = jasmine.createSpyObj<AuthProvider>(
      'AuthProvider',
      ['watchUser', 'signUp', 'signIn', 'signOut'],
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
});
