import { NextResponse } from "next/server";
import { z } from "zod";
import { isCisRankingEnabled, setCisRankingEnabled } from "@/lib/cis/flags";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";

export async function GET() {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;

  const [consentAccepted, consentWithdrawn, events24h, prefs, rankingEnabled] =
    await Promise.all([
      withDbRetry(() =>
        prisma.cisConsent.count({ where: { status: "accepted" } }),
      ),
      withDbRetry(() =>
        prisma.cisConsent.count({
          where: { status: { in: ["withdrawn", "refused"] } },
        }),
      ),
      withDbRetry(() =>
        prisma.cisEvent.count({
          where: {
            receivedAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
          },
        }),
      ),
      withDbRetry(() => prisma.cisPreference.count()),
      isCisRankingEnabled(),
    ]);

  await withDbRetry(() =>
    prisma.cisAdminAudit.create({
      data: {
        actorUserId: auth.session!.user.id,
        action: "cis.summary.view",
        meta: {},
      },
    }),
  );

  return NextResponse.json({
    rankingEnabled,
    consentAccepted,
    consentWithdrawn,
    events24h,
    preferences: prefs,
  });
}

const patchSchema = z.object({
  rankingEnabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  await setCisRankingEnabled(body.rankingEnabled);
  await withDbRetry(() =>
    prisma.cisAdminAudit.create({
      data: {
        actorUserId: auth.session!.user.id,
        action: "cis.ranking.toggle",
        meta: { rankingEnabled: body.rankingEnabled },
      },
    }),
  );

  return NextResponse.json({ ok: true, rankingEnabled: body.rankingEnabled });
}
