import {
  fingerprintIp,
  requestClientIp,
} from "@/lib/auth-login-security";
import { RISK } from "@/lib/security/policies";
import { createRestriction } from "@/lib/security/restrictions";
import { logSecurityEvent } from "@/lib/security/security-events";
import { revokeSessionById } from "@/lib/security/session-revocation";
import { NextResponse } from "next/server";

/**
 * Traite un hit honeypot : signal fort, sanction temporaire proportionnée.
 * Pas de ban définitif automatique (faux positifs scanners / préchargements).
 */
export async function handleHoneypotHit(input: {
  request: Request;
  userId?: string | null;
  sessionId?: string | null;
}) {
  const ip = requestClientIp({ request: input.request });
  const ipHash = fingerprintIp(ip);
  const url = new URL(input.request.url);

  logSecurityEvent({
    type: "honeypot_hit",
    severity: "high",
    endpoint: url.pathname,
    method: input.request.method,
    ipHash,
    userId: input.userId,
    sessionId: input.sessionId,
    detail: {
      client: input.request.headers.get("x-shipshop-client")?.slice(0, 40) ?? null,
      ua: input.request.headers.get("user-agent")?.slice(0, 120) ?? null,
    },
  });

  const expiresAt = new Date(Date.now() + RISK.honeypotSuspendMs);

  if (input.sessionId) {
    await createRestriction({
      scope: "SESSION",
      subjectKey: input.sessionId,
      reason: "Accès à une route piège catalogue",
      source: "honeypot",
      expiresAt,
    }).catch(() => undefined);
    await revokeSessionById({
      sessionId: input.sessionId,
      reason: "honeypot",
      actorUserId: input.userId,
    }).catch(() => undefined);
  } else if (ip !== "unknown") {
    // IP partagée : suspension courte seulement, jamais permanente.
    await createRestriction({
      scope: "IP",
      subjectKey: ipHash,
      reason: "Accès anonyme à une route piège catalogue",
      source: "honeypot",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    }).catch(() => undefined);
  }

  // Réponse trompeuse : pas de données réelles, pas d'aveu du piège.
  return NextResponse.json(
    { items: [], nextCursor: null },
    { status: 200 },
  );
}
