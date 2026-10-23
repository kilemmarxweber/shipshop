import { prisma, withDbRetry } from "@/lib/prisma";
import {
  MISSIONS,
  type MissionKey,
  utcDay,
  weekPeriodKey,
} from "@/lib/growth/constants";
import { refreshAccountBadges } from "@/lib/growth/badges";

export type ActivityKind =
  | "like"
  | "comment"
  | "share"
  | "follow"
  | "shop_visit"
  | "category"
  | "dwell"
  | "challenge";

const USEFUL: Record<ActivityKind, boolean> = {
  like: true,
  comment: true,
  share: true,
  follow: true,
  shop_visit: false,
  category: false,
  dwell: false,
  challenge: true,
};

const MISSION_FOR: Partial<Record<ActivityKind, MissionKey>> = {
  shop_visit: "visit_shops",
  category: "discover_categories",
  share: "share_product",
  comment: "useful_comment",
};

export async function recordUserActivity(
  userId: string,
  kind: ActivityKind,
  opts?: { city?: string | null },
) {
  try {
    const day = utcDay();
    const useful = USEFUL[kind] ? 1 : 0;
    await withDbRetry(() =>
      prisma.userActivityDay.upsert({
        where: { userId_day: { userId, day } },
        create: {
          userId,
          day,
          interactions: useful,
          city: opts?.city ?? null,
        },
        update: {
          interactions: { increment: useful },
          ...(opts?.city ? { city: opts.city } : {}),
        },
      }),
    );

    const missionKey = MISSION_FOR[kind];
    if (missionKey) {
      await bumpMission(userId, missionKey);
    }

    if (useful) {
      void refreshAccountBadges(userId).catch(() => undefined);
    }
  } catch {
    /* growth never blocks the main action */
  }
}

export async function bumpMission(userId: string, missionKey: MissionKey) {
  const spec = MISSIONS.find((m) => m.key === missionKey);
  if (!spec) return;
  const periodKey = weekPeriodKey();
  await withDbRetry(() =>
    prisma.userMissionProgress.upsert({
      where: {
        userId_missionKey_periodKey: { userId, missionKey, periodKey },
      },
      create: {
        userId,
        missionKey,
        periodKey,
        progress: 1,
        target: spec.target,
        completedAt: spec.target <= 1 ? new Date() : null,
      },
      update: {
        progress: { increment: 1 },
      },
    }),
  );
  await withDbRetry(() =>
    prisma.userMissionProgress.updateMany({
      where: {
        userId,
        missionKey,
        periodKey,
        completedAt: null,
        progress: { gte: spec.target },
      },
      data: { completedAt: new Date() },
    }),
  );
}
