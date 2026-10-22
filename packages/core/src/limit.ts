type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function allowWrite(ip: string, limit = 40, windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const key = ip.trim() || "unknown";
  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.reset - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function resetWriteLimits(): void {
  buckets.clear();
}