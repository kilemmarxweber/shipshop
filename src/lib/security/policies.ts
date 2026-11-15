/**
 * Quotas anti-scraping adaptés au contexte ShipShop :
 * - feed mobile scroll rapide → catalogues auth plus permissifs
 * - recherche / énumération → plus strict
 * - portefeuille / commandes → strict (auth obligatoire côté route)
 * - IP partagée (cybercafé, 4G) → pas de ban IP permanent
 */

export type ApiBucket =
  | "catalog"
  | "search"
  | "shops"
  | "events"
  | "wanted"
  | "growth"
  | "wallet"
  | "orders"
  | "sensitive";

export type Quota = {
  max: number;
  windowMs: number;
};

export const API_QUOTAS: Record<
  ApiBucket,
  { anon: Quota; auth: Quota }
> = {
  catalog: {
    anon: { max: 60, windowMs: 60_000 },
    auth: { max: 180, windowMs: 60_000 },
  },
  search: {
    anon: { max: 20, windowMs: 60_000 },
    auth: { max: 45, windowMs: 60_000 },
  },
  shops: {
    anon: { max: 40, windowMs: 60_000 },
    auth: { max: 90, windowMs: 60_000 },
  },
  events: {
    anon: { max: 40, windowMs: 60_000 },
    auth: { max: 90, windowMs: 60_000 },
  },
  wanted: {
    anon: { max: 40, windowMs: 60_000 },
    auth: { max: 90, windowMs: 60_000 },
  },
  growth: {
    anon: { max: 50, windowMs: 60_000 },
    auth: { max: 120, windowMs: 60_000 },
  },
  wallet: {
    anon: { max: 5, windowMs: 60_000 },
    auth: { max: 40, windowMs: 60_000 },
  },
  orders: {
    anon: { max: 5, windowMs: 60_000 },
    auth: { max: 60, windowMs: 60_000 },
  },
  sensitive: {
    anon: { max: 10, windowMs: 60_000 },
    auth: { max: 30, windowMs: 60_000 },
  },
};

/** Pagination publique : déjà plafonnée via list-cursor ; clamp catalogue non paginé. */
export const PUBLIC_CATALOG_HARD_MAX = 24;

/** Signaux de risque (seuils soft — calibrer en staging). */
export const RISK = {
  cursorPagesPer5Min: 35,
  searchVariantsPer5Min: 25,
  honeypotSuspendMs: 60 * 60_000,
  highRiskThrottleFactor: 0.4,
} as const;
