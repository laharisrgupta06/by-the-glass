/** How long to leave a model alone after it fails, so we don't spend quota on it. */
export const COOLDOWN_MS = {
  overloaded: 60_000,
  timeout: 30_000,
  quota: 60_000,
  missing: 6 * 60 * 60 * 1000,
};

export type ModelOutcome =
  | 'ok'
  | 'overloaded'
  | 'timeout'
  | 'quota'
  | 'missing';

/**
 * The configured models in order of preference, minus any that recently failed.
 * In memory, per server process.
 */
export class ModelPool {
  private coolingUntil = new Map<string, number>();
  /** Why each model is cooling down, so a fast failure can say why. */
  private coolingFor = new Map<string, ModelOutcome>();
  private missing = new Set<string>();

  constructor(
    readonly models: string[],
    private readonly now: () => number = Date.now
  ) {}

  /** Models worth trying right now, best first. */
  available(): string[] {
    const now = this.now();
    return this.models.filter(
      m => !this.missing.has(m) && (this.coolingUntil.get(m) ?? 0) <= now
    );
  }

  /** False when every configured model is known not to exist. */
  hasUsable(): boolean {
    return this.models.some(m => !this.missing.has(m));
  }

  report(
    model: string,
    outcome: ModelOutcome,
    retryAfterSeconds?: number
  ): void {
    if (outcome === 'ok') {
      this.coolingUntil.delete(model);
      this.coolingFor.delete(model);
      return;
    }
    if (outcome === 'missing') {
      this.missing.add(model);
      return;
    }
    const wait = Math.max(
      COOLDOWN_MS[outcome],
      (retryAfterSeconds ?? 0) * 1000
    );
    this.coolingUntil.set(model, this.now() + wait);
    this.coolingFor.set(model, outcome);
  }

  /**
   * True when every usable model is cooling down because its quota is used up, so a
   * request now would fail on quota, not because Google is busy.
   */
  onlyQuotaLeft(): boolean {
    const now = this.now();
    const usable = this.models.filter(m => !this.missing.has(m));
    return (
      usable.length > 0 &&
      usable.every(
        m =>
          (this.coolingUntil.get(m) ?? 0) > now &&
          this.coolingFor.get(m) === 'quota'
      )
    );
  }

  /** Seconds until some usable model can be tried again (at least 1). */
  nextRetryIn(): number {
    const now = this.now();
    const waits = this.models
      .filter(m => !this.missing.has(m))
      .map(m => (this.coolingUntil.get(m) ?? now) - now);
    const soonest = waits.length ? Math.min(...waits) : 0;
    return Math.max(1, Math.ceil(soonest / 1000));
  }
}

/** "gemini-flash-latest" plus "a, b" → ["gemini-flash-latest", "a", "b"], without repeats. */
export function modelList(primary: string, fallbacks = ''): string[] {
  return [
    ...new Set(
      [primary, ...fallbacks.split(',')].map(m => m.trim()).filter(Boolean)
    ),
  ];
}
