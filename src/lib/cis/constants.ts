export const CIS_POLICY_VERSION = "2026-11-13";

export const CIS_EVENT_TYPES = [
  "product_view",
  "product_like",
  "shop_follow",
  "search",
  "add_to_cart",
  "purchase",
  "chat_share_for_cis",
  "wanted_signal",
] as const;

export type CisEventType = (typeof CIS_EVENT_TYPES)[number];

export const CIS_CONSENT_STATUSES = [
  "accepted",
  "refused",
  "withdrawn",
] as const;

export type CisConsentStatus = (typeof CIS_CONSENT_STATUSES)[number];

/** Pondérations explicables (pas des probabilités d'achat). */
export const CIS_EVENT_WEIGHTS: Record<CisEventType, number> = {
  product_view: 0.35,
  product_like: 1.2,
  shop_follow: 1.5,
  search: 0.9,
  add_to_cart: 2.2,
  purchase: 4.0,
  chat_share_for_cis: 1.0,
  wanted_signal: 1.8,
};

/** Demi-vie en heures pour la décroissance temporelle. */
export const CIS_HALF_LIFE_HOURS = 240;

export const CIS_DEFAULT_SCOPES = [
  "feed_personalization",
  "search_relevance",
  "aggregated_insights",
] as const;
