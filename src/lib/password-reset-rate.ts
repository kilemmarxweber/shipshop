import { NextResponse } from "next/server";
import {
  fingerprintSubject,
  requestClientIp,
} from "@/lib/auth-login-security";
import {
  hashThrottleSubject,
  takeDistributedRateLimit,
  type ThrottleResult,
} from "@/lib/security/rate-limit";

const WINDOW_MS = 15 * 60_000;

/**
 * Limite par identifiant (toujours) et par IP réelle (si TRUST_PROXY fournit une IP).
 * Pas de seau global « unknown » : sans proxy, tout le monde partagerait le même quota.
 */
export async function takePasswordResetRate(
  req: Request,
  kind: "request" | "confirm",
  identifier: string,
): Promise<ThrottleResult> {
  const idMax = kind === "request" ? 5 : 10;
  const byId = await takeDistributedRateLimit(
    `pwd-reset:${kind}:id:${fingerprintSubject(identifier)}`,
    idMax,
    WINDOW_MS,
  );
  if (!byId.allowed) return byId;

  const ip = requestClientIp({ request: req });
  if (ip === "unknown") return byId;

  const ipMax = kind === "request" ? 20 : 40;
  return takeDistributedRateLimit(
    `pwd-reset:${kind}:ip:${hashThrottleSubject(ip)}`,
    ipMax,
    WINDOW_MS,
  );
}

export function passwordResetRateLimited(result: ThrottleResult) {
  return NextResponse.json(
    {
      error: "Trop de demandes. Réessayez plus tard.",
      code: "RESET_RATE_LIMIT",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}
