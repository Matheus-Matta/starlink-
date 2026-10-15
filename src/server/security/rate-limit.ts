import "server-only";

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Bucket = { count: number; windowStart: number; blockedUntil: number; strikes: number };

/**
 * Limitador em memória por janela fixa, com bloqueio progressivo (dobra a cada reincidência).
 * Adequado a uma única instância; os contadores zeram em um reinício.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly options: { limit: number; windowMs: number; blockMs?: number; maxBlockMs?: number; maxKeys?: number },
  ) {}

  consume(key: string, now: number = Date.now()): RateLimitDecision {
    const { limit, windowMs } = this.options;
    const blockMs = this.options.blockMs ?? windowMs;
    const maxBlockMs = this.options.maxBlockMs ?? blockMs * 16;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      this.evictIfNeeded(now);
      bucket = { count: 0, windowStart: now, blockedUntil: 0, strikes: 0 };
      this.buckets.set(key, bucket);
    }
    if (bucket.blockedUntil > now) return { allowed: false, retryAfterSeconds: Math.ceil((bucket.blockedUntil - now) / 1000) };
    if (now - bucket.windowStart >= windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      bucket.strikes += 1;
      const duration = Math.min(blockMs * 2 ** (bucket.strikes - 1), maxBlockMs);
      bucket.blockedUntil = now + duration;
      bucket.count = 0;
      return { allowed: false, retryAfterSeconds: Math.ceil(duration / 1000) };
    }
    return { allowed: true };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Evita crescimento ilimitado da memória sob ataque com muitas chaves. */
  private evictIfNeeded(now: number): void {
    const maxKeys = this.options.maxKeys ?? 10_000;
    if (this.buckets.size < maxKeys) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.blockedUntil <= now && now - bucket.windowStart >= this.options.windowMs) this.buckets.delete(key);
    }
    if (this.buckets.size >= maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
  }
}
