import { prisma, withDbRetry } from "@/lib/prisma";

export const LIVE_GUEST_MAX_ON_STAGE = 4;

export type LiveGuestPublic = {
  id: string;
  status: "PENDING" | "ON_STAGE" | "REFUSED" | "LEFT" | string;
  cameraOn: boolean;
  requestedAt: Date | string;
  decidedAt?: Date | string | null;
  user: { id: string; name: string; image?: string | null };
};

/** Abonné créateur ou boutique du host. */
export async function isLiveFollower(
  followerId: string,
  hostUserId: string,
): Promise<boolean> {
  if (!followerId || followerId === hostUserId) return false;
  const [direct, shop] = await Promise.all([
    withDbRetry(() =>
      prisma.userFollow.findFirst({
        where: { followerId, creatorId: hostUserId },
        select: { followerId: true },
      }),
    ),
    withDbRetry(() =>
      prisma.shopFollow.findFirst({
        where: { userId: followerId, shop: { ownerUserId: hostUserId } },
        select: { userId: true },
      }),
    ),
  ]);
  return Boolean(direct || shop);
}

const guestSelect = {
  id: true,
  status: true,
  cameraOn: true,
  requestedAt: true,
  decidedAt: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

export async function listLiveGuests(
  liveId: string,
): Promise<LiveGuestPublic[]> {
  if (typeof prisma.liveGuest?.findMany !== "function") return [];
  try {
    return await withDbRetry(() =>
      prisma.liveGuest.findMany({
        where: { liveId, status: { in: ["PENDING", "ON_STAGE"] } },
        orderBy: { requestedAt: "asc" },
        select: guestSelect,
      }),
    );
  } catch (error) {
    console.error("[live-guests] list", error);
    return [];
  }
}

/** Statut invité du viewer (même REFUSED / LEFT) pour toasts UI. */
export async function getMyLiveGuest(
  liveId: string,
  userId: string,
): Promise<LiveGuestPublic | null> {
  if (!userId || typeof prisma.liveGuest?.findUnique !== "function") {
    return null;
  }
  try {
    return await withDbRetry(() =>
      prisma.liveGuest.findUnique({
        where: { liveId_userId: { liveId, userId } },
        select: guestSelect,
      }),
    );
  } catch {
    return null;
  }
}

export async function closeLiveGuests(liveId: string) {
  if (typeof prisma.liveGuest?.updateMany !== "function") return;
  try {
    await withDbRetry(() =>
      prisma.liveGuest.updateMany({
        where: { liveId, status: { in: ["PENDING", "ON_STAGE"] } },
        data: {
          status: "LEFT",
          leftAt: new Date(),
          cameraOn: false,
        },
      }),
    );
  } catch (error) {
    console.error("[live-guests] close", error);
  }
}

export async function countOnStage(liveId: string) {
  if (typeof prisma.liveGuest?.count !== "function") return 0;
  return withDbRetry(() =>
    prisma.liveGuest.count({
      where: { liveId, status: "ON_STAGE" },
    }),
  );
}
