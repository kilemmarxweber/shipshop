import { z } from "zod";

/** Ancrage produit d’un challenge — aligné growth Chip Shop. */
export const CHALLENGE_PRODUCT_FOCUSES = ["none", "catalog", "teaser"] as const;
export type ChallengeProductFocus = (typeof CHALLENGE_PRODUCT_FOCUSES)[number];

export const challengeTeaserSchema = z.object({
  title: z.string().min(2).max(120),
  image: z.string().max(800).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().min(3).max(8).optional().nullable(),
  shopName: z.string().max(80).optional().nullable(),
  note: z.string().max(220).optional().nullable(),
});

export type ChallengeTeaser = z.infer<typeof challengeTeaserSchema>;

export function parseChallengeTeaser(raw: unknown): ChallengeTeaser | null {
  const parsed = challengeTeaserSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isChallengeProductFocus(
  value: unknown,
): value is ChallengeProductFocus {
  return (
    typeof value === "string" &&
    (CHALLENGE_PRODUCT_FOCUSES as readonly string[]).includes(value)
  );
}

/** Carte feed / Découvrir : catalogue (lien fiche) ou teaser (aperçu). */
export type ChallengeProductCue = {
  kind: "catalog" | "teaser";
  id: string | null;
  title: string;
  priceCents: number | null;
  currency: string;
  shopName: string | null;
  image: string | null;
  note?: string | null;
  /** Fiche produit si catalogue, sinon null (pas encore en boutique). */
  href: string | null;
};

export function challengeProductCueFromRow(row: {
  productFocus?: string | null;
  productId?: string | null;
  productTeaser?: unknown;
  product?: {
    id: string;
    title: string;
    images: string[];
    priceCents: number;
    currency: string;
    shop: { name: string };
  } | null;
  firstVisual?: (images: string[]) => string | null;
}): ChallengeProductCue | null {
  const focus = isChallengeProductFocus(row.productFocus)
    ? row.productFocus
    : row.product
      ? "catalog"
      : parseChallengeTeaser(row.productTeaser)
        ? "teaser"
        : "none";

  if (focus === "catalog" && row.product) {
    const image = row.firstVisual
      ? row.firstVisual(row.product.images)
      : (row.product.images[0] ?? null);
    return {
      kind: "catalog",
      id: row.product.id,
      title: row.product.title,
      priceCents: row.product.priceCents,
      currency: row.product.currency || "USD",
      shopName: row.product.shop.name,
      image,
      href: `/product/${row.product.id}`,
    };
  }

  if (focus === "teaser") {
    const teaser = parseChallengeTeaser(row.productTeaser);
    if (!teaser) return null;
    return {
      kind: "teaser",
      id: null,
      title: teaser.title,
      priceCents: teaser.priceCents ?? null,
      currency: teaser.currency || "USD",
      shopName: teaser.shopName ?? null,
      image: teaser.image ?? null,
      note: teaser.note ?? null,
      href: null,
    };
  }

  return null;
}
