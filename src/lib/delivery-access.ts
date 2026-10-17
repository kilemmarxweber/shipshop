import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Admin / owner plateforme Chip Shop. */
export async function requirePlatformDeliveryAdmin(userId: string) {
  const { isOwner, role } = await assertChipShopOwner(userId);
  if (!isOwner) {
    return { ok: false as const, status: 403, error: "Accès admin requis" };
  }
  return { ok: true as const, role };
}

/** Peut gérer les livreurs / tarifs d’une boutique (owner shop ou plateforme). */
export async function canManageShopDelivery(userId: string, shopId: string) {
  const platform = await assertChipShopOwner(userId);
  if (platform.isOwner) {
    const shop = await withDbRetry(() =>
      prisma.shop.findUnique({ where: { id: shopId } }),
    );
    if (!shop) return { ok: false as const, status: 404, error: "Boutique introuvable" };
    return { ok: true as const, shop, isPlatform: true };
  }

  const shop = await withDbRetry(() =>
    prisma.shop.findFirst({
      where: {
        id: shopId,
        OR: [
          { ownerUserId: userId },
          {
            organization: {
              members: { some: { userId } },
            },
          },
        ],
      },
    }),
  );
  if (!shop) {
    return { ok: false as const, status: 403, error: "Boutique non autorisée" };
  }
  return { ok: true as const, shop, isPlatform: false };
}

/** Shops que l’utilisateur peut gérer (livraison). */
export async function listManagedShops(userId: string) {
  const platform = await assertChipShopOwner(userId);
  if (platform.isOwner) {
    return withDbRetry(() =>
      prisma.shop.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, ownerUserId: true },
        orderBy: { name: "asc" },
      }),
    );
  }
  return withDbRetry(() =>
    prisma.shop.findMany({
      where: {
        isActive: true,
        OR: [
          { ownerUserId: userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
      select: { id: true, name: true, slug: true, ownerUserId: true },
      orderBy: { name: "asc" },
    }),
  );
}
