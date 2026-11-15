import { fingerprintIp, requestClientIp } from "@/lib/auth-login-security";
import { API_QUOTAS, type ApiBucket } from "@/lib/security/policies";
import {
    hashThrottleSubject,
    takeDistributedRateLimit,
} from "@/lib/security/rate-limit";
import { findActiveRestriction } from "@/lib/security/restrictions";
import { evaluateRisk } from "@/lib/security/risk-score";
import { logSecurityEvent } from "@/lib/security/security-events";
import {
    ACCESS_RESTRICTED_FR,
    ACCESS_TEMPORARILY_LIMITED_FR,
    ACCOUNT_TEMPORARILY_BLOCKED_FR,
} from "@/lib/security/user-messages";
import { NextResponse } from "next/server";

export type GuardSession = {
  user?: { id: string } | null;
  session?: { id: string } | null;
} | null;

export type GuardOptions = {
  request: Request;
  bucket: ApiBucket;
  session?: GuardSession;
  /** Recherche catalogue (?q=) → bucket search + signal risque. */
  isSearch?: boolean;
  hasCursor?: boolean;
  /** failClosed: 503 si throttle dégradé (wallet). Catalogue = fail-open. */
  failClosed?: boolean;
};

function clientKind(request: Request) {
  const raw = request.headers.get("x-shipshop-client")?.trim().toLowerCase();
  if (raw === "mobile" || raw === "web" || raw === "admin") return raw;
  const origin = request.headers.get("origin") ?? "";
  if (origin.startsWith("shipshop://") || origin.startsWith("exp://")) {
    return "mobile";
  }
  return "web";
}

export function tooManyRequests(retryAfterSec: number, message?: string) {
  return NextResponse.json(
    {
      error: message ?? ACCESS_TEMPORARILY_LIMITED_FR,
      message: message ?? ACCESS_TEMPORARILY_LIMITED_FR,
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSec)),
        "Cache-Control": "no-store",
      },
    },
  );
}

export function restrictedResponse(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: ACCOUNT_TEMPORARILY_BLOCKED_FR,
      message: ACCESS_RESTRICTED_FR,
      code: "SECURITY_RESTRICTED",
    },
    {
      status: 403,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSec)),
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Garde commune web + mobile. À appeler dans chaque route sensible.
 * N'autorise jamais une ressource d'autrui : l'IDOR reste dans la route métier.
 */
export async function enforceApiSecurity(
  options: GuardOptions,
): Promise<NextResponse | null> {
  const { request, bucket } = options;
  const url = new URL(request.url);
  const ip = requestClientIp({ request });
  const ipHash = fingerprintIp(ip);
  const userId = options.session?.user?.id ?? null;
  const sessionId = options.session?.session?.id ?? null;
  const authenticated = Boolean(userId);
  const kind = clientKind(request);

  try {
    const restriction = await findActiveRestriction({
      userId,
      sessionId,
      ip,
    });
    if (restriction) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((restriction.expiresAt.getTime() - Date.now()) / 1000),
      );
      logSecurityEvent({
        type: "restriction_block",
        severity: "moderate",
        endpoint: url.pathname,
        method: request.method,
        ipHash,
        userId,
        sessionId,
        detail: {
          scope: restriction.scope,
          source: restriction.source,
          client: kind,
        },
      });
      return restrictedResponse(retryAfterSec);
    }
  } catch {
    // Table absente / DB down : ne bloque pas le catalogue.
    if (options.failClosed) {
      return NextResponse.json(
        { error: "Service indisponible", code: "SECURITY_DEGRADED" },
        { status: 503 },
      );
    }
  }

  const risk = evaluateRisk({
    hasCursor: Boolean(options.hasCursor),
    hasSearch: Boolean(options.isSearch),
    endpoint: url.pathname,
    ipHash,
    userId,
  });

  const quota = API_QUOTAS[bucket][authenticated ? "auth" : "anon"];
  const effectiveMax = Math.max(3, Math.floor(quota.max * risk.throttleFactor));
  const subject = authenticated
    ? `u:${hashThrottleSubject(userId!)}`
    : `ip:${hashThrottleSubject(ip)}`;
  const throttleKey = `api:${bucket}:${subject}`;

  const result = await takeDistributedRateLimit(
    throttleKey,
    effectiveMax,
    quota.windowMs,
  );

  if (result.degraded && options.failClosed) {
    return NextResponse.json(
      { error: "Service indisponible", code: "SECURITY_DEGRADED" },
      { status: 503 },
    );
  }

  if (!result.allowed) {
    logSecurityEvent({
      type: "rate_limited",
      severity: risk.level === "high" ? "high" : "low",
      endpoint: url.pathname,
      method: request.method,
      ipHash,
      userId,
      sessionId,
      detail: {
        bucket,
        client: kind,
        risk: risk.level,
        max: effectiveMax,
      },
    });
    return tooManyRequests(result.retryAfterSec);
  }

  return null;
}
