import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;

  const { userId } = await ctx.params;
  if (!userId) {
    return NextResponse.json({ error: "userId requis" }, { status: 400 });
  }

  const [user, consent, preferences, recentEvents] = await Promise.all([
    withDbRetry(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
    ),
    withDbRetry(() =>
      prisma.cisConsent.findFirst({
        where: { userId },
        orderBy: { decidedAt: "desc" },
      }),
    ),
    withDbRetry(() =>
      prisma.cisPreference.findMany({
        where: { userId },
        orderBy: { score: "desc" },
        take: 30,
      }),
    ),
    withDbRetry(() =>
      prisma.cisEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 40,
        select: {
          type: true,
          category: true,
          shopId: true,
          productId: true,
          occurredAt: true,
        },
      }),
    ),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  await withDbRetry(() =>
    prisma.cisAdminAudit.create({
      data: {
        actorUserId: auth.session!.user.id,
        targetUserId: userId,
        action: "cis.profile.view",
        meta: {},
      },
    }),
  );

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    consent: consent
      ? {
          status: consent.status,
          policyVersion: consent.policyVersion,
          decidedAt: consent.decidedAt.toISOString(),
        }
      : null,
    preferences: preferences.map((row) => ({
      kind: row.kind,
      key: row.key,
      score: row.score,
      factors: row.factors,
    })),
    recentEvents: recentEvents.map((row) => ({
      type: row.type,
      category: row.category,
      shopId: row.shopId,
      productId: row.productId,
      occurredAt: row.occurredAt.toISOString(),
    })),
  });
}
