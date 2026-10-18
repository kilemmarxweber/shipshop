const hits = new Map<string, number[]>();

/** Returns true if the call is allowed. */
export function takeRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const prev = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    hits.set(key, prev);
    return false;
  }
  prev.push(now);
  hits.set(key, prev);
  return true;
}
