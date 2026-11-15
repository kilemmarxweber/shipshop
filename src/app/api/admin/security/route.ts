import { fingerprintIp, fingerprintSubject } from "@/lib/auth-login-security";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import {
    createRestriction,
    enforceApiSecurity,
    liftRestriction,
    logSecurityEvent,
    revokeAllUserSessions,
    revokeSessionById,
} from "@/lib/security";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

async function requirePlatformAdmin(req: Request) {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  const blocked = await enforceApiSecurity({
    request: req,
    bucket: "sensitive",
    session,
    failClosed: true,
  });
  if (blocked) return { error: blocked };
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return {
      error: NextResponse.json(
        { error: "Réservé à l'owner ou à un admin Chip Shop" },
        { status: 403 },
      ),
    };
  }
  return { session };
}

export async function GET(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if ("error" in gate && gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const hoursRaw = Number(searchParams.get("hours") ?? "24");
  const hours = Number.isFinite(hoursRaw)
    ? Math.min(168, Math.max(1, Math.floor(hoursRaw)))
    : 24;
  const since = new Date(Date.now() - hours * 3_600_000);
  const type = searchParams.get("type")?.trim() || null;
  const severity = searchParams.get("severity")?.trim() || null;

  const eventWhere = {
    createdAt: { gte: since },
    ...(type ? { type } : {}),
    ...(severity ? { severity } : {}),
  };

  const [events, restrictions, counts, rateLimited, honeypotHits] =
    await Promise.all([
      withDbRetry(() =>
        prisma.securityEvent.findMany({
          where: eventWhere,
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ),
      withDbRetry(() =>
        prisma.securityRestriction.findMany({
          where: {
            liftedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
          take: 80,
        }),
      ),
      withDbRetry(() =>
        prisma.securityEvent.groupBy({
          by: ["type"],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { _count: { type: "desc" } },
          take: 20,
        }),
      ),
      withDbRetry(() =>
        prisma.securityEvent.count({
          where: { createdAt: { gte: since }, type: "rate_limited" },
        }),
      ),
      withDbRetry(() =>
        prisma.securityEvent.count({
          where: { createdAt: { gte: since }, type: "honeypot_hit" },
        }),
      ),
    ]);

  return NextResponse.json({
    hours,
    summary: {
      rateLimited,
      honeypotHits,
      activeRestrictions: restrictions.length,
      byType: counts.map((row) => ({
        type: row.type,
        count: row._count._all,
      })),
    },
    events,
    restrictions,
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("lift"),
    restrictionId: z.string().min(1),
  }),
  z.object({
    action: z.literal("restrict"),
    scope: z.enum(["USER", "SESSION", "IP"]),
    subject: z.string().min(1).max(200),
    reason: z.string().min(3).max(280),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(7 * 24 * 60)
      .default(60),
  }),
  z.object({
    action: z.literal("revoke_session"),
    sessionId: z.string().min(1),
    reason: z.string().min(3).max(280).default("Révocation admin"),
  }),
  z.object({
    action: z.literal("revoke_user_sessions"),
    userId: z.string().min(1),
    reason: z.string().min(3).max(280).default("Révocation admin"),
  }),
]);

export async function POST(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if ("error" in gate && gate.error) return gate.error;
  const actorId = gate.session!.user.id;

  try {
    const body = actionSchema.parse(await req.json());

    if (body.action === "lift") {
      const row = await liftRestriction(body.restrictionId);
      logSecurityEvent({
        type: "restriction_lifted",
        severity: "info",
        userId: actorId,
        detail: {
          restrictionId: row.id,
          scope: row.scope,
          subjectKey: row.subjectKey.slice(0, 16),
        },
      });
      return NextResponse.json({ ok: true, restriction: row });
    }

    if (body.action === "restrict") {
      let subjectKey = body.subject.trim();
      if (body.scope === "IP") {
        subjectKey = fingerprintIp(subjectKey);
      } else if (body.scope === "USER" && subjectKey.includes("@")) {
        // Accepte email → résout l'id si possible, sinon empreinte (pas stockée comme email brut).
        const user = await prisma.user.findFirst({
          where: { email: subjectKey.toLowerCase() },
          select: { id: true },
        });
        subjectKey = user?.id ?? fingerprintSubject(subjectKey);
      }

      const expiresAt = new Date(Date.now() + body.durationMinutes * 60_000);
      const row = await createRestriction({
        scope: body.scope,
        subjectKey,
        reason: body.reason,
        source: "manual",
        expiresAt,
        createdBy: actorId,
      });
      logSecurityEvent({
        type: "restriction_manual",
        severity: "moderate",
        userId: actorId,
        detail: {
          restrictionId: row.id,
          scope: row.scope,
          durationMinutes: body.durationMinutes,
        },
      });
      return NextResponse.json({ ok: true, restriction: row });
    }

    if (body.action === "revoke_session") {
      const count = await revokeSessionById({
        sessionId: body.sessionId,
        reason: body.reason,
        actorUserId: actorId,
      });
      return NextResponse.json({ ok: true, revoked: count });
    }

    const count = await revokeAllUserSessions({
      userId: body.userId,
      reason: body.reason,
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, revoked: count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Action sécurité impossible" },
      { status: 500 },
    );
  }
}
