import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { loadBadgeSnapshot, refreshAccountBadges } from "@/lib/growth/badges";
import { loadMissions } from "@/lib/growth/missions";
import { prisma, withDbRetry } from "@/lib/prisma";
import { GIFT_CATALOG } from "@/lib/growth/constants";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  await refreshAccountBadges(session.user.id);
  const [badges, missions, rewards] = await Promise.all([
    loadBadgeSnapshot(session.user.id),
    loadMissions(session.user.id),
    withDbRetry(() =>
      prisma.rewardGrant.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ),
  ]);
  return NextResponse.json({
    ...badges,
    missions,
    rewards,
    gifts: GIFT_CATALOG,
  });
}
