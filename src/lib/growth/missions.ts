import { prisma, withDbRetry } from "@/lib/prisma";
import { MISSIONS, weekPeriodKey } from "@/lib/growth/constants";

export async function loadMissions(userId: string) {
  const periodKey = weekPeriodKey();
  const rows = await withDbRetry(() =>
    prisma.userMissionProgress.findMany({
      where: { userId, periodKey },
    }),
  );
  const byKey = new Map(rows.map((row) => [row.missionKey, row]));
  return MISSIONS.map((spec) => {
    const row = byKey.get(spec.key);
    const progress = row?.progress ?? 0;
    return {
      key: spec.key,
      target: spec.target,
      progress: Math.min(progress, spec.target),
      completed: Boolean(row?.completedAt) || progress >= spec.target,
    };
  });
}

export async function loadLeaderboard(city?: string | null) {
  const rows = await withDbRetry(() =>
    prisma.userActivityDay.groupBy({
      by: ["userId"],
      where: city ? { city } : {},
      _sum: { interactions: true },
      _count: { _all: true },
      orderBy: { _sum: { interactions: "desc" } },
      take: 20,
    }),
  );
  const users = await withDbRetry(() =>
    prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, image: true },
    }),
  );
  const names = new Map(users.map((u) => [u.id, u]));
  return rows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: names.get(row.userId)?.name ?? "Membre",
    image: names.get(row.userId)?.image ?? null,
    interactions: row._sum.interactions ?? 0,
    activeDays: row._count._all,
  }));
}
