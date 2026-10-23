import { prisma, withDbRetry } from "@/lib/prisma";

export async function countCreatorSubscribers(userId: string) {
  const [direct, shopFollowers] = await Promise.all([
    withDbRetry(() =>
      prisma.userFollow.count({ where: { creatorId: userId } }),
    ),
    withDbRetry(() =>
      prisma.shopFollow.findMany({
        where: { shop: { ownerUserId: userId } },
        select: { userId: true },
      }),
    ),
  ]);
  const unique = new Set<string>();
  for (const row of shopFollowers) unique.add(row.userId);
  return Math.max(direct, unique.size);
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
