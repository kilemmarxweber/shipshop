import type { Prisma } from "@/generated/prisma/client";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function assertCanManageShop(userId: string, shopId: string) {
  const shop = await withDbRetry(() =>
    prisma.shop.findUnique({ where: { id: shopId } }),
  );
  if (!shop) {
    return {
      ok: false as const,
      status: 404 as const,
      shop: null,
      isPlatform: false,
    };
  }
  if (shop.ownerUserId === userId) {
    return {
      ok: true as const,
      status: 200 as const,
      shop,
      isPlatform: false,
    };
  }
  const { isOwner } = await assertChipShopOwner(userId);
  if (isOwner) {
    return {
      ok: true as const,
      status: 200 as const,
      shop,
      isPlatform: true,
    };
  }
  return {
    ok: false as const,
    status: 403 as const,
    shop,
    isPlatform: false,
  };
}

export async function managedShopsWhere(
  userId: string,
): Promise<{ where: Prisma.ShopWhereInput; isPlatform: boolean }> {
  const { isOwner } = await assertChipShopOwner(userId);
  if (isOwner) return { where: {}, isPlatform: true };
  return {
    where: { ownerUserId: userId, isActive: true },
    isPlatform: false,
  };
}
