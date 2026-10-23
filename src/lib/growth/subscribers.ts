import { prisma, withDbRetry } from "@/lib/prisma";

/** IDs uniques des abonnés (follow créateur ∪ follow boutique du créateur). */
export async function listCreatorSubscriberIds(
  creatorId: string,
  limit = 2_000,
) {
  const [direct, shopFollowers] = await Promise.all([
    withDbRetry(() =>
      prisma.userFollow.findMany({
        where: { creatorId },
        select: { followerId: true },
        take: limit,
      }),
    ),
    withDbRetry(() =>
      prisma.shopFollow.findMany({
        where: { shop: { ownerUserId: creatorId } },
        select: { userId: true },
        take: limit,
      }),
    ),
  ]);
  const ids = new Set<string>();
  for (const row of direct) {
    if (row.followerId !== creatorId) ids.add(row.followerId);
  }
  for (const row of shopFollowers) {
    if (row.userId !== creatorId) ids.add(row.userId);
  }
  return [...ids].slice(0, limit);
}

export async function countCreatorSubscribers(userId: string) {
  const ids = await listCreatorSubscriberIds(userId);
  return ids.length;
}

export async function followCreator(followerId: string, creatorId: string) {
  if (followerId === creatorId) {
    throw new Error("Vous ne pouvez pas vous suivre");
  }
  await withDbRetry(() =>
    prisma.userFollow.upsert({
      where: {
        followerId_creatorId: { followerId, creatorId },
      },
      create: { followerId, creatorId },
      update: {},
    }),
  );
}

export async function unfollowCreator(followerId: string, creatorId: string) {
  await withDbRetry(() =>
    prisma.userFollow.deleteMany({
      where: { followerId, creatorId },
    }),
  );
}
