import { RateLimiter } from './rate-limiter';
import { TtlCache, fingerprint } from './ttl-cache';

describe('rate limiter', () => {
  it('allows up to the limit per window, then says how long to wait', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 60_000, () => now);
    expect(limiter.take('a')).toBe(0);
    expect(limiter.take('a')).toBe(0);
    expect(limiter.take('a')).toBe(60);
    expect(limiter.take('b')).toBe(0);
    now = 30_000;
    expect(limiter.take('a')).toBe(30);
    now = 60_000;
    expect(limiter.take('a')).toBe(0);
  });
});

describe('TTL cache', () => {
  it('expires entries', () => {
    let now = 0;
    const cache = new TtlCache<string>(10, 1000, () => now);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    now = 1000;
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TtlCache<number>(2, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('fingerprints text stably', () => {
    expect(fingerprint('lime\ngin')).toBe(fingerprint('lime\ngin'));
    expect(fingerprint('lime\ngin')).not.toBe(fingerprint('gin\nlime'));
  });
});
