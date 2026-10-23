import { prisma, withDbRetry } from "@/lib/prisma";
import { daysAgo, KPI_GUARDS } from "@/lib/growth/constants";

function bps(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part * 10_000) / total);
}

function guard(
  value: number,
  kind: "min" | "max",
  threshold: number,
): "ok" | "watch" | "risk" {
  if (kind === "min") {
    if (value >= threshold) return "ok";
    if (value >= threshold * 0.7) return "watch";
    return "risk";
  }
  if (value <= threshold) return "ok";
  if (value <= threshold * 1.4) return "watch";
  return "risk";
}

export async function loadAttentionKpis(periodDays = 30) {
  const from = daysAgo(periodDays);
  const from7 = daysAgo(7);
  const from14 = daysAgo(14);
  const from30 = daysAgo(30);
  const from37 = daysAgo(37);

  const [
    dwells,
    likes,
    comments,
    shares,
    follows,
    sessions7,
    sessions14,
    sessions30,
    sessions37,
    orders,
    feedEvents,
    purchases,
    campaigns,
    gifts,
    rejects,
    missions,
    missionsDone,
    badgeActive,
    badgeInfluencer,
  ] = await Promise.all([
    withDbRetry(() =>
      prisma.productDwell.aggregate({
        where: { lastSeenAt: { gte: from } },
        _avg: { dwellMs: true },
        _sum: { viewCount: true, dwellMs: true },
        _count: { _all: true },
      }),
    ),
    withDbRetry(() =>
      prisma.productLike.count({ where: { createdAt: { gte: from } } }),
    ),
    withDbRetry(() =>
      prisma.productComment.count({ where: { createdAt: { gte: from } } }),
    ),
    withDbRetry(() =>
      prisma.productShare.count({ where: { createdAt: { gte: from } } }),
    ),
    withDbRetry(() =>
      prisma.shopFollow.count({ where: { createdAt: { gte: from } } }),
    ),
    withDbRetry(() =>
      prisma.userActivityDay.findMany({
        where: { day: { gte: from7 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ),
    withDbRetry(() =>
      prisma.userActivityDay.findMany({
        where: { day: { gte: from14, lt: from7 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ),
    withDbRetry(() =>
      prisma.userActivityDay.findMany({
        where: { day: { gte: from30 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ),
    withDbRetry(() =>
      prisma.userActivityDay.findMany({
        where: { day: { gte: from37, lt: from30 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ),
    withDbRetry(() =>
      prisma.order.aggregate({
        where: { createdAt: { gte: from }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
        _sum: { creatorFeeCents: true },
        _count: { _all: true },
      }),
    ),
    withDbRetry(() =>
      prisma.commerceFunnelEvent.count({
        where: { createdAt: { gte: from }, kind: "FEED" },
      }),
    ),
    withDbRetry(() =>
      prisma.commerceFunnelEvent.count({
        where: { createdAt: { gte: from }, kind: "PURCHASE" },
      }),
    ),
    withDbRetry(() =>
      prisma.brandCampaign.findMany({
        where: { createdAt: { gte: from } },
        select: {
          budgetCents: true,
          impressions: true,
          clicks: true,
          conversions: true,
          status: true,
          objective: true,
        },
      }),
    ),
    withDbRetry(() =>
      prisma.creatorGift.aggregate({
        where: { createdAt: { gte: from } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
    ),
    withDbRetry(() =>
      prisma.mediaModerationEvent.count({
        where: {
          createdAt: { gte: from },
          decision: { in: ["REJECT", "BAN"] },
        },
      }),
    ),
    withDbRetry(() => prisma.userMissionProgress.count()),
    withDbRetry(() =>
      prisma.userMissionProgress.count({ where: { completedAt: { not: null } } }),
    ),
    withDbRetry(() =>
      prisma.accountBadge.count({ where: { kind: "ACTIVE", active: true } }),
    ),
    withDbRetry(() =>
      prisma.accountBadge.count({
        where: { kind: "INFLUENCER", active: true },
      }),
    ),
  ]);

  const views = dwells._sum.viewCount ?? 0;
  const interactions = likes + comments + shares + follows;
  const interactionRate = views > 0 ? interactions / views : 0;
  const set7 = new Set(sessions7.map((r) => r.userId));
  const set14 = new Set(sessions14.map((r) => r.userId));
  const set30 = new Set(sessions30.map((r) => r.userId));
  const set37 = new Set(sessions37.map((r) => r.userId));
  const retainedJ7 =
    set14.size > 0
      ? [...set14].filter((id) => set7.has(id)).length / set14.size
      : 0;
  const retainedJ30 =
    set37.size > 0
      ? [...set37].filter((id) => set30.has(id)).length / set37.size
      : 0;

  const campaignBudget = campaigns.reduce((s, c) => s + c.budgetCents, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const giftGmv = gifts._sum.amountCents ?? 0;
  const adRevenueCents = Math.round(campaignBudget * 0.18 + giftGmv * 0.2);
  const sessions = Math.max(set30.size, 1);
  const revenuePer1000Sessions = Math.round((adRevenueCents * 1000) / sessions);
  const sponsoredCtr = impressions > 0 ? clicks / impressions : 0;
  const conversion = feedEvents > 0 ? purchases / feedEvents : 0;
  const missionRate = missions > 0 ? missionsDone / missions : 0;
  const qualityRate = views > 0 ? rejects / views : 0;

  return {
    periodDays,
    attention: {
      avgDwellMs: Math.round(dwells._avg.dwellMs ?? 0),
      sessions7: set7.size,
      sessions30: set30.size,
      retentionJ7: retainedJ7,
      retentionJ30: retainedJ30,
    },
    engagement: {
      likes,
      comments,
      shares,
      follows,
      interactionRate,
      missionCompletionRate: missionRate,
    },
    business: {
      adRevenueCents,
      revenuePer1000Sessions,
      sponsoredCtr,
      postEngagementConversion: conversion,
      campaignBudgetCents: campaignBudget,
      giftGmvCents: giftGmv,
      giftCount: gifts._count._all,
      orders: orders._count._all,
      creatorFeeCents: orders._sum.creatorFeeCents ?? 0,
    },
    quality: {
      rejects,
      hideRate: qualityRate,
      disputeRate: 0,
    },
    creators: {
      activeBadges: badgeActive,
      influencerBadges: badgeInfluencer,
    },
    guards: {
      retentionJ7: {
        value: retainedJ7,
        status: guard(retainedJ7, "min", KPI_GUARDS.retentionJ7Min),
        threshold: KPI_GUARDS.retentionJ7Min,
      },
      interactionRate: {
        value: interactionRate,
        status: guard(interactionRate, "min", KPI_GUARDS.interactionRateMin),
        threshold: KPI_GUARDS.interactionRateMin,
      },
      hideRate: {
        value: qualityRate,
        status: guard(qualityRate, "max", KPI_GUARDS.adHideMax),
        threshold: KPI_GUARDS.adHideMax,
      },
      missionRate: {
        value: missionRate,
        status: guard(missionRate, "min", KPI_GUARDS.missionCompletionMin),
        threshold: KPI_GUARDS.missionCompletionMin,
      },
      disputeRate: {
        value: 0,
        status: "ok" as const,
        threshold: KPI_GUARDS.disputeMax,
      },
    },
    feedToCardBps: bps(purchases, feedEvents),
  };
}
