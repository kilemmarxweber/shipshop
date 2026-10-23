export const INFLUENCER_FOLLOWERS = 2_000;
export const ACTIVE_DAYS_REQUIRED = 12;
export const ACTIVE_INTERACTIONS_REQUIRED = 20;
export const ACTIVITY_WINDOW_DAYS = 30;
export const INFLUENCER_ENGAGEMENT_MIN = 0.03;
export const GIFT_DAILY_CAP_CENTS = 2_000;
export const CREATOR_GIFT_SHARE_BPS = 7_000;
export const PLATFORM_GIFT_SHARE_BPS = 2_000;
export const COMMUNITY_GIFT_SHARE_BPS = 1_000;

export const GIFT_CATALOG = [
  { kind: "SMALL", amountCents: 10, label: "Spark" },
  { kind: "MEDIUM", amountCents: 50, label: "Boost" },
  { kind: "PREMIUM", amountCents: 200, label: "Crown" },
] as const;

export type GiftKind = (typeof GIFT_CATALOG)[number]["kind"];

export const CAMPAIGN_PACKS = {
  DISCOVERY: {
    objective: "DISCOVERY" as const,
    minBudgetCents: 30_000,
    maxBudgetCents: 100_000,
    kind: "STORY",
  },
  ENGAGEMENT: {
    objective: "ENGAGEMENT" as const,
    minBudgetCents: 80_000,
    maxBudgetCents: 250_000,
    kind: "CHALLENGE",
  },
  CONVERSION: {
    objective: "CONVERSION" as const,
    minBudgetCents: 150_000,
    maxBudgetCents: 500_000,
    kind: "FEED",
  },
} as const;

export type CampaignObjective = keyof typeof CAMPAIGN_PACKS;

export const MISSIONS = [
  { key: "visit_shops", target: 5 },
  { key: "discover_categories", target: 3 },
  { key: "share_product", target: 1 },
  { key: "useful_comment", target: 1 },
] as const;

export type MissionKey = (typeof MISSIONS)[number]["key"];

export const KPI_GUARDS = {
  retentionJ7Min: 0.2,
  interactionRateMin: 0.08,
  adHideMax: 0.05,
  disputeMax: 0.03,
  missionCompletionMin: 0.25,
} as const;

export function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysAgo(n: number, from = new Date()) {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export function weekPeriodKey(date = new Date()) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthCycleKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
