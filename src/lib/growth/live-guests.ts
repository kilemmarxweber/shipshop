import { prisma, withDbRetry } from "@/lib/prisma";
export { LIVE_GUEST_MAX_ON_STAGE } from "@/lib/growth/live-stage-layout";

export type LiveGuestPublic = {
  id: string;
  status: "PENDING" | "INVITED" | "ON_STAGE" | "REFUSED" | "LEFT" | string;
  cameraOn: boolean;
  micOn: boolean;
  handRaised: boolean;
  hasFloor: boolean;
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
  micOn: true,
  handRaised: true,
  hasFloor: true,
  requestedAt: true,
  decidedAt: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

function withFloorDefaults<T extends Record<string, unknown>>(row: T): T & {
  handRaised: boolean;
  hasFloor: boolean;
} {
  return {
    ...row,
    handRaised: Boolean((row as { handRaised?: boolean }).handRaised),
    hasFloor: Boolean((row as { hasFloor?: boolean }).hasFloor),
  };
}

export async function listLiveGuests(
  liveId: string,
): Promise<LiveGuestPublic[]> {
  if (typeof prisma.liveGuest?.findMany !== "function") return [];
  try {
    const rows = await withDbRetry(() =>
      prisma.liveGuest.findMany({
        where: {
          liveId,
          status: { in: ["PENDING", "INVITED", "ON_STAGE"] },
        },
        orderBy: { requestedAt: "asc" },
        select: guestSelect,
      }),
    );
    return rows.map((r) => withFloorDefaults(r) as LiveGuestPublic);
  } catch (error) {
    // Colonnes handRaised/hasFloor absentes (migrate pas encore jouée)
    try {
      const rows = await withDbRetry(() =>
        prisma.liveGuest.findMany({
          where: {
            liveId,
            status: { in: ["PENDING", "INVITED", "ON_STAGE"] },
          },
          orderBy: { requestedAt: "asc" },
          select: {
            id: true,
            status: true,
            cameraOn: true,
            micOn: true,
            requestedAt: true,
            decidedAt: true,
            user: { select: { id: true, name: true, image: true } },
          },
        }),
      );
      return rows.map(
        (r) =>
          withFloorDefaults({
            ...r,
            handRaised: false,
            hasFloor: r.micOn,
          }) as LiveGuestPublic,
      );
    } catch (fallbackError) {
      console.error("[live-guests] list", error, fallbackError);
      return [];
    }
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
    const row = await withDbRetry(() =>
      prisma.liveGuest.findUnique({
        where: { liveId_userId: { liveId, userId } },
        select: guestSelect,
      }),
    );
    return row ? (withFloorDefaults(row) as LiveGuestPublic) : null;
  } catch {
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: { liveId_userId: { liveId, userId } },
          select: {
            id: true,
            status: true,
            cameraOn: true,
            micOn: true,
            requestedAt: true,
            decidedAt: true,
            user: { select: { id: true, name: true, image: true } },
          },
        }),
      );
      return row
        ? (withFloorDefaults({
            ...row,
            handRaised: false,
            hasFloor: row.micOn,
          }) as LiveGuestPublic)
        : null;
    } catch {
      return null;
    }
  }
}

export async function closeLiveGuests(liveId: string) {
  if (typeof prisma.liveGuest?.updateMany !== "function") return;
  try {
    await withDbRetry(() =>
      prisma.liveGuest.updateMany({
        where: {
          liveId,
          status: { in: ["PENDING", "INVITED", "ON_STAGE"] },
        },
        data: {
          status: "LEFT",
          leftAt: new Date(),
          cameraOn: false,
          micOn: false,
          handRaised: false,
          hasFloor: false,
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

/**
 * Monte un invité sur scène avec politique de parole :
 * - 1er invité → hasFloor + mic
 * - suivants → attendent la main / accord host
 */
export async function promoteGuestOnStage(
  guestId: string,
  liveId: string,
  opts?: { cameraOn?: boolean },
) {
  const already = await countOnStage(liveId);
  const hasFloor = already === 0;
  return withDbRetry(() =>
    prisma.liveGuest.update({
      where: { id: guestId },
      data: {
        status: "ON_STAGE",
        decidedAt: new Date(),
        cameraOn: opts?.cameraOn !== false,
        micOn: hasFloor,
        hasFloor,
        handRaised: false,
        leftAt: null,
      },
      select: guestSelect,
    }),
  );
}

/** Accorde la parole à un invité (exclusif parmi les ON_STAGE). */
export async function grantGuestFloor(liveId: string, guestId: string) {
  await withDbRetry(() =>
    prisma.liveGuest.updateMany({
      where: {
        liveId,
        status: "ON_STAGE",
        NOT: { id: guestId },
      },
      data: {
        hasFloor: false,
        micOn: false,
        handRaised: false,
      },
    }),
  );
  return withDbRetry(() =>
    prisma.liveGuest.update({
      where: { id: guestId },
      data: {
        hasFloor: true,
        micOn: true,
        handRaised: false,
      },
      select: guestSelect,
    }),
  );
}

/** Retire la parole (micro coupé). */
export async function revokeGuestFloor(guestId: string) {
  return withDbRetry(() =>
    prisma.liveGuest.update({
      where: { id: guestId },
      data: {
        hasFloor: false,
        micOn: false,
        handRaised: false,
      },
      select: guestSelect,
    }),
  );
}

/**
 * S’il ne reste qu’un invité sur scène, lui rendre la parole automatiquement.
 */
export async function reconcileSoloFloor(liveId: string) {
  const onStage = await withDbRetry(() =>
    prisma.liveGuest.findMany({
      where: { liveId, status: "ON_STAGE" },
      select: { id: true, hasFloor: true },
    }),
  );
  if (onStage.length !== 1) return;
  const alone = onStage[0]!;
  if (alone.hasFloor) return;
  await withDbRetry(() =>
    prisma.liveGuest.update({
      where: { id: alone.id },
      data: { hasFloor: true, micOn: true, handRaised: false },
    }),
  );
}
