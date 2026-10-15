import { prisma, withDbRetry } from "@/lib/prisma";

/** Vérifie qu'aucune boutique active/inactive n'utilise déjà ce nom (insensible à la casse). */
export async function assertUniqueShopName(
  name: string,
  excludeShopId?: string,
) {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error("Nom de boutique trop court");
  }

  const clash = await withDbRetry(() =>
    prisma.shop.findFirst({
      where: {
        name: { equals: trimmed, mode: "insensitive" },
        ...(excludeShopId ? { NOT: { id: excludeShopId } } : {}),
      },
      select: { id: true, name: true },
    }),
  );

  if (clash) {
    throw new Error(
      `Une boutique nommée « ${clash.name} » existe déjà — choisissez un autre nom`,
    );
  }

  return trimmed;
}
