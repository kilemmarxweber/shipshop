import { prisma } from "@/lib/prisma";
import { takeRateLimit } from "@/lib/rate-limit";
import { createHash, randomUUID } from "crypto";

export type ThrottleResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  /** true si on a basculé sur le Map mémoire (DB indisponible). */
  degraded: boolean;
};

function windowKey(key: string, windowStart: number) {
  return `${key}|${windowStart}`;
}

function denied(windowStart: number, windowMs: number, now: number): ThrottleResult {
  return {
    allowed: false,
    remaining: 0,
    retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    degraded: false,
  };
}

/**
 * Fenêtre fixe partagée via Postgres (multi-instances PM2).
 * Repli mémoire si la table est absente ou si la DB échoue.
 */
export async function takeDistributedRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<ThrottleResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const storageKey = windowKey(key, windowStart).slice(0, 190);

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await prisma.apiThrottle.upsert({
          where: { key: storageKey },
          create: {
            id: randomUUID(),
            key: storageKey,
            count: 1,
            windowStart: BigInt(windowStart),
          },
          update: { count: { increment: 1 } },
        });
        if (row.count > max) return denied(windowStart, windowMs, now);
        return {
          allowed: true,
          remaining: Math.max(0, max - row.count),
          retryAfterSec: 0,
          degraded: false,
        };
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: string }).code)
            : "";
        // Course create unique — retente.
        if (code === "P2002") continue;
        throw error;
      }
    }
    return denied(windowStart, windowMs, now);
  } catch {
    const allowed = takeRateLimit(`mem:${key}`, max, windowMs);
    return {
      allowed,
      remaining: allowed ? 1 : 0,
      retryAfterSec: allowed ? 0 : Math.ceil(windowMs / 1000),
      degraded: true,
    };
  }
}

export function hashThrottleSubject(raw: string) {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
