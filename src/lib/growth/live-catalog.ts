import { prisma, withDbRetry } from "@/lib/prisma";

export type LiveCatalogProduct = {
  id: string;
  title: string;
  description: string | null;
  images: string[];
  priceCents: number;
  currency: string;
  category: string;
  shop: { id: string; name: string; slug: string };
};

export async function listLiveCatalogProducts(
  liveUserId: string,
  opts?: { q?: string; category?: string },
): Promise<{ products: LiveCatalogProduct[]; categories: string[] }> {
  const q = opts?.q?.trim() ?? "";
  const category = opts?.category?.trim() ?? "";
  const products = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        shop: { ownerUserId: liveUserId },
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        description: true,
        images: true,
        priceCents: true,
        currency: true,
        category: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    }),
  );
  const categories = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        shop: { ownerUserId: liveUserId },
      },
      distinct: ["category"],
      select: { category: true },
      take: 40,
    }),
  );
  return {
    products,
    categories: categories.map((row) => row.category).filter(Boolean),
  };
}
