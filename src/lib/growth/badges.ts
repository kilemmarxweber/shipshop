import { prisma, withDbRetry } from "@/lib/prisma";
import {
  ACTIVE_DAYS_REQUIRED,
  ACTIVE_INTERACTIONS_REQUIRED,
  ACTIVITY_WINDOW_DAYS,
  INFLUENCER_FOLLOWERS,
  monthCycleKey,
  utcDay,
  daysAgo,
} from "@/lib/growth/constants";
import { countCreatorSubscribers } from "@/lib/growth/subscribers";
import { assertChipShopOwner } from "@/lib/kyc";

export type BadgeSnapshot = {
  kind: "ACTIVE" | "INFLUENCER";
  active: boolean;
  earnedAt: string | null;
  progress: number;
  target: number;
};

async function hasSeriousStrike(userId: string) {
  const since = daysAgo(ACTIVITY_WINDOW_DAYS);
  const banned = await withDbRetry(() =>
    prisma.mediaModerationEvent.count({
      where: {
        userId,
        createdAt: { gte: since },
        decision: { in: ["BAN", "CSAM_HOLD"] },
      },
    }),
  );
  return banned > 0;
}

async function activeProgress(userId: string) {
  const from = utcDay(daysAgo(ACTIVITY_WINDOW_DAYS));
  const days = await withDbRetry(() =>
    prisma.userActivityDay.findMany({
      where: { userId, day: { gte: from } },
      select: { interactions: true },
    }),
  );
  const activeDays = days.length;
  const interactions = days.reduce((sum, row) => sum + row.interactions, 0);
  return { activeDays, interactions };
}

export async function refreshAccountBadges(userId: string) {
  const [activity, subscribers, strike, kyc, platform] = await Promise.all([
    activeProgress(userId),
    countCreatorSubscribers(userId),
    hasSeriousStrike(userId),
    withDbRetry(() =>
      prisma.sellerKyc.findUnique({
        where: { userId },
        select: { status: true },
      }),
    ),
    assertChipShopOwner(userId),
  ]);

  const cycleKey = monthCycleKey();
  const qualifyActive =
    !strike &&
    activity.activeDays >= ACTIVE_DAYS_REQUIRED &&
    activity.interactions >= ACTIVE_INTERACTIONS_REQUIRED;
  // Owner plateforme : accès total (live, cadeaux, pub) sans seuil d’abonnés.
  const qualifyInfluencer =
    platform.isPlatformOwner ||
    (!strike &&
      subscribers >= INFLUENCER_FOLLOWERS &&
      kyc?.status === "APPROVED");

  await syncBadge(userId, "ACTIVE", qualifyActive, cycleKey);
  await syncBadge(userId, "INFLUENCER", qualifyInfluencer, cycleKey);

  if (qualifyActive) {
    await grantWeeklyActiveReward(userId);
  }

  return loadBadgeSnapshot(userId);
}

async function syncBadge(
  userId: string,
  kind: "ACTIVE" | "INFLUENCER",
  qualify: boolean,
  cycleKey: string,
) {
  const existing = await withDbRetry(() =>
    prisma.accountBadge.findUnique({
      where: { userId_kind: { userId, kind } },
    }),
  );
  if (qualify) {
    if (!existing) {
      await withDbRetry(() =>
        prisma.accountBadge.create({
          data: { userId, kind, active: true, cycleKey, earnedAt: new Date() },
        }),
      );
      return;
    }
    if (!existing.active) {
      await withDbRetry(() =>
        prisma.accountBadge.update({
          where: { id: existing.id },
          data: {
            active: true,
            lostAt: null,
            earnedAt: new Date(),
            cycleKey,
          },
        }),
      );
    }
    return;
  }
  if (existing?.active) {
    await withDbRetry(() =>
      prisma.accountBadge.update({
        where: { id: existing.id },
        data: { active: false, lostAt: new Date() },
      }),
    );
  }
}

async function grantWeeklyActiveReward(userId: string) {
  const weekStart = utcDay(daysAgo(new Date().getUTCDay() || 7));
  const already = await withDbRetry(() =>
    prisma.rewardGrant.findFirst({
      where: {
        userId,
        kind: "VISIBILITY",
        createdAt: { gte: weekStart },
      },
      select: { id: true },
    }),
  );
  if (already) return;
  await withDbRetry(() =>
    prisma.rewardGrant.create({
      data: {
        userId,
        kind: "VISIBILITY",
        title: "Bonus visibilité Badge Actif",
      },
    }),
  );
}

export async function loadBadgeSnapshot(userId: string): Promise<{
  badges: BadgeSnapshot[];
  subscribers: number;
  activeDays: number;
  interactions: number;
  kycApproved: boolean;
  isPlatformOwner: boolean;
}> {
  const [rows, activity, subscribers, kyc, platform] = await Promise.all([
    withDbRetry(() =>
      prisma.accountBadge.findMany({
        where: { userId },
        select: { kind: true, active: true, earnedAt: true },
      }),
    ),
    activeProgress(userId),
    countCreatorSubscribers(userId),
    withDbRetry(() =>
      prisma.sellerKyc.findUnique({
        where: { userId },
        select: { status: true },
      }),
    ),
    assertChipShopOwner(userId),
  ]);
  const byKind = new Map(rows.map((row) => [row.kind, row]));
  const influencerActive =
    platform.isPlatformOwner || Boolean(byKind.get("INFLUENCER")?.active);
  const badges: BadgeSnapshot[] = [
    {
      kind: "ACTIVE",
      active: Boolean(byKind.get("ACTIVE")?.active),
      earnedAt: byKind.get("ACTIVE")?.earnedAt.toISOString() ?? null,
      progress: Math.min(
        activity.activeDays + activity.interactions,
        ACTIVE_DAYS_REQUIRED + ACTIVE_INTERACTIONS_REQUIRED,
      ),
      target: ACTIVE_DAYS_REQUIRED + ACTIVE_INTERACTIONS_REQUIRED,
    },
    {
      kind: "INFLUENCER",
      active: influencerActive,
      earnedAt: byKind.get("INFLUENCER")?.earnedAt.toISOString() ?? null,
      progress: platform.isPlatformOwner
        ? INFLUENCER_FOLLOWERS
        : Math.min(subscribers, INFLUENCER_FOLLOWERS),
      target: INFLUENCER_FOLLOWERS,
    },
  ];
  return {
    badges,
    subscribers,
    activeDays: activity.activeDays,
    interactions: activity.interactions,
    kycApproved: kyc?.status === "APPROVED",
    isPlatformOwner: platform.isPlatformOwner,
  };
}

export async function hasActiveBadge(
  userId: string,
  kind: "ACTIVE" | "INFLUENCER",
) {
  if (kind === "INFLUENCER") {
    const { isPlatformOwner } = await assertChipShopOwner(userId);
    if (isPlatformOwner) return true;
  }
  const row = await withDbRetry(() =>
    prisma.accountBadge.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { active: true },
    }),
  );
  return Boolean(row?.active);
}
