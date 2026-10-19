/** Fixed-window request counting, per client or for everyone. In memory, per server process. */
export class RateLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  /** Records a request. Returns 0 when allowed, otherwise seconds until it would be. */
  take(key: string): number {
    const now = this.now();
    let window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      window = { start: now, count: 0 };
      this.windows.set(key, window);
      if (this.windows.size > 10_000) this.prune(now);
    }
    if (window.count >= this.limit)
      return Math.max(
        1,
        Math.ceil((window.start + this.windowMs - now) / 1000)
      );
    window.count++;
    return 0;
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows)
      if (now - window.start >= this.windowMs) this.windows.delete(key);
  }
}
