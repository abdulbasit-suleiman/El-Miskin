/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Good enough for a single app instance (local dev / small deployment).
 * For a serverless deployment with many instances, swap this for a shared
 * store (e.g. Upstash Redis) — noted in the README.
 */

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit = 10, windowMs = 10_000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }

  hits.push(now);
  buckets.set(key, hits);

  // Occasional cleanup so the map cannot grow forever.
  if (buckets.size > 10_000) {
    for (const [k, v] of Array.from(buckets.entries())) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return false;
}
