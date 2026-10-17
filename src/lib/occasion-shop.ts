import { composeAddress } from "@/lib/address";
import { prisma, withDbRetry } from "@/lib/prisma";
import { assertUniqueShopName } from "@/lib/shop-name";
import { ensureMembership } from "@/lib/system-org";
import { slugify } from "@/lib/utils";

export async function assertKycApproved(userId: string) {
  const kyc = await withDbRetry(() =>
    prisma.sellerKyc.findUnique({
      where: { userId },
      select: { status: true },
    }),
  );
  if (kyc?.status !== "APPROVED") {
    const err = new Error("KYC_REQUIRED") as Error & { code: string };
    err.code = "KYC_REQUIRED";
    throw err;
  }
}

type StallLocation = {
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  commune?: string | null;
  quartier?: string | null;
  avenue?: string | null;
  parcelle?: string | null;
};

/** Boutique magasin du vendeur, ou vitrine Occasion créée à la volée. */
export async function resolveOfferShop(opts: {
  userId: string;
  userName: string;
  condition: "NEW_SHOP" | "USED";
  shopId?: string | null;
  location?: StallLocation;
}) {
  if (opts.condition === "NEW_SHOP") {
    if (!opts.shopId) {
      throw new Error("Choisissez la boutique magasin");
    }
    const shop = await withDbRetry(() =>
      prisma.shop.findFirst({
        where: {
          id: opts.shopId!,
          ownerUserId: opts.userId,
          isActive: true,
        },
      }),
    );
    if (!shop) {
      throw new Error("Boutique introuvable ou inactive");
    }
    return shop;
  }

  return ensureOccasionShop(opts.userId, opts.userName, opts.location);
}

export async function ensureOccasionShop(
  userId: string,
  userName: string,
  location?: StallLocation,
) {
  const existing = await withDbRetry(() =>
    prisma.shop.findFirst({
      where: { ownerUserId: userId, isOccasionStall: true },
    }),
  );

  const lat = location?.lat ?? existing?.lat ?? -4.305;
  const lng = location?.lng ?? existing?.lng ?? 15.311;
  const description = location
    ? composeAddress({
        city: location.city?.trim() || "Kinshasa",
        commune: location.commune,
        quartier: location.quartier,
        avenue: location.avenue,
        parcelle: location.parcelle,
      })
    : existing?.description;

  if (existing) {
    return withDbRetry(() =>
      prisma.shop.update({
        where: { id: existing.id },
        data: {
          lat: Number.isFinite(lat) ? lat : existing.lat,
          lng: Number.isFinite(lng) ? lng : existing.lng,
          ...(description ? { description } : {}),
        },
      }),
    );
  }

  const { org } = await ensureMembership(userId);
  const first = userName.trim().split(/\s+/)[0] || "Client";
  let name = `Occasion · ${first}`.slice(0, 80);
  try {
    name = await assertUniqueShopName(name);
  } catch {
    name = `Occasion · ${first} ${userId.slice(-4)}`.slice(0, 80);
    name = await assertUniqueShopName(name);
  }

  let slug = slugify(name) || `occasion-${userId.slice(-6)}`;
  const clash = await withDbRetry(() =>
    prisma.shop.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug } },
    }),
  );
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  return withDbRetry(() =>
    prisma.shop.create({
      data: {
        organizationId: org.id,
        ownerUserId: userId,
        name,
        slug,
        description: description ?? "Vitrine occasion ShipShop",
        lat: Number.isFinite(lat) ? lat : -4.305,
        lng: Number.isFinite(lng) ? lng : 15.311,
        isOccasionStall: true,
        isActive: true,
      },
    }),
  );
}
