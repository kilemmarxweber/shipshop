export const PROMO_TIERS = ["LIGHT", "STANDARD", "FORTE", "FLASH"] as const;
export type PromoTier = (typeof PROMO_TIERS)[number];

export const SELLER_TIERS = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "LEGEND",
] as const;
export type SellerTier = (typeof SELLER_TIERS)[number];

export const SELLER_TIER_POINTS: { min: number; tier: SellerTier }[] = [
  { min: 50_000, tier: "LEGEND" },
  { min: 20_000, tier: "PLATINUM" },
  { min: 5_000, tier: "GOLD" },
  { min: 1_000, tier: "SILVER" },
  { min: 0, tier: "BRONZE" },
];

export const SELLER_BADGE_KIND: Record<
  Exclude<SellerTier, "BRONZE">,
  string
> = {
  SILVER: "SELLER_SILVER",
  GOLD: "SELLER_GOLD",
  PLATINUM: "SELLER_PLATINUM",
  LEGEND: "SELLER_LEGEND",
};

export const SHIPCASH_BPS = 1_000; // 10 % of the discount
export const MIN_REWARD_PERCENT = 5;
export const FLASH_WEEKLY_CAP = 3;
export const FLAG_PERCENT = 70;
export const STANDARD_COMMISSION_SALES = 10;
export const STANDARD_COMMISSION_BPS_OFF = 100;
export const PLATINUM_COMMISSION_BPS_OFF = 50;
export const PRICE_HOLD_DAYS = 14;

const TIER_TABLE: {
  min: number;
  max: number;
  tier: PromoTier;
  points: number;
  boostHours: number;
}[] = [
  { min: 5, max: 9, tier: "LIGHT", points: 50, boostHours: 0 },
  { min: 10, max: 14, tier: "STANDARD", points: 150, boostHours: 48 },
  { min: 15, max: 19, tier: "FORTE", points: 300, boostHours: 72 },
  { min: 20, max: 100, tier: "FLASH", points: 500, boostHours: 72 },
];

export function clampPercent(percent: number) {
  return Math.min(90, Math.max(1, Math.round(percent)));
}

export function promoTierForPercent(percent: number): PromoTier | null {
  const p = Math.round(percent);
  for (const row of TIER_TABLE) {
    if (p >= row.min && p <= row.max) return row.tier;
  }
  return null;
}

export function pointsForPercent(percent: number) {
  const p = Math.round(percent);
  const row = TIER_TABLE.find((r) => p >= r.min && p <= r.max);
  return row?.points ?? 0;
}

export function boostHoursForPercent(percent: number) {
  const p = Math.round(percent);
  const row = TIER_TABLE.find((r) => p >= r.min && p <= r.max);
  return row?.boostHours ?? 0;
}

export function sellerTierForPoints(points: number): SellerTier {
  const n = Math.max(0, points);
  for (const row of SELLER_TIER_POINTS) {
    if (n >= row.min) return row.tier;
  }
  return "BRONZE";
}

export function discountedPriceCents(compareAtCents: number, percent: number) {
  const p = clampPercent(percent);
  return Math.max(100, Math.floor((compareAtCents * (100 - p)) / 100));
}

export function discountCents(compareAtCents: number, priceCents: number) {
  return Math.max(0, compareAtCents - priceCents);
}

export function shipCashCents(compareAtCents: number, priceCents: number) {
  return Math.floor((discountCents(compareAtCents, priceCents) * SHIPCASH_BPS) / 10_000);
}

export function utcWeekStart(now = new Date()) {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d;
}

export function utcMonthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
