import { ensureSystemOrganization } from "@/lib/system-org";
import { PLATFORM_ROLES } from "@/lib/org-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import {
  liveHostKindFromFlags,
  type LiveHostKind,
} from "@/lib/growth/live-host-label";

type LiveRow = {
  id: string;
  title: string;
  status: string;
  startedAt?: Date | string | null;
  viewerPeak?: number | null;
  giftCents?: number | null;
  user: { id: string; name: string | null; image: string | null };
  product?: {
    id: string;
    title?: string;
    images?: string[];
    priceCents?: number;
    currency?: string;
    shop?: { name: string; slug?: string; logoUrl?: string | null } | null;
  } | null;
};

export type EnrichedLiveTeaser = LiveRow & {
  shop: { name: string; slug?: string; logoUrl?: string | null } | null;
  hostKind: LiveHostKind;
  hostLabel: string;
};

/** Enrichit les lives ouverts avec boutique hôte + rôle (owner/admin/influenceur). */
export async function enrichLiveTeasers(
  lives: LiveRow[],
): Promise<EnrichedLiveTeaser[]> {
  if (!lives.length) return [];

  const hostIds = [...new Set(lives.map((row) => row.user.id))];
  const org = await ensureSystemOrganization();

  const [shops, members, badges] = await Promise.all([
    withDbRetry(() =>
      prisma.shop.findMany({
        where: { ownerUserId: { in: hostIds } },
        orderBy: { createdAt: "asc" },
        select: {
          ownerUserId: true,
          name: true,
          slug: true,
          logoUrl: true,
        },
      }),
    ),
    withDbRetry(() =>
      prisma.member.findMany({
        where: {
          userId: { in: hostIds },
          organizationId: org.id,
          role: { in: [...PLATFORM_ROLES] },
        },
        select: { userId: true, role: true },
      }),
    ),
    withDbRetry(() =>
      prisma.accountBadge.findMany({
        where: {
          userId: { in: hostIds },
          kind: "INFLUENCER",
          active: true,
        },
        select: { userId: true },
      }),
    ),
  ]);

  const shopByOwner = new Map<
    string,
    { name: string; slug: string; logoUrl: string | null }
  >();
  for (const shop of shops) {
    if (!shop.ownerUserId || shopByOwner.has(shop.ownerUserId)) continue;
    shopByOwner.set(shop.ownerUserId, {
      name: shop.name,
      slug: shop.slug,
      logoUrl: shop.logoUrl,
    });
  }

  const memberByUser = new Map(members.map((row) => [row.userId, row.role]));
  const influencerIds = new Set(badges.map((row) => row.userId));

  return lives.map((row) => {
    const productShop = row.product?.shop
      ? {
          name: row.product.shop.name,
          slug: row.product.shop.slug,
          logoUrl: row.product.shop.logoUrl ?? null,
        }
      : null;
    const owned = shopByOwner.get(row.user.id) ?? null;
    const shop = productShop ?? owned;
    const role = memberByUser.get(row.user.id);
    const hostKind = liveHostKindFromFlags({
      isPlatformOwner: role === "owner",
      isPlatformAdmin: role === "admin",
      isInfluencer: influencerIds.has(row.user.id),
    });
    return {
      ...row,
      shop,
      hostKind,
      hostLabel:
        shop?.name && row.user.name && shop.name !== row.user.name
          ? `${shop.name} · ${row.user.name}`
          : shop?.name || row.user.name || "Créateur",
    };
  });
}
