import { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Viewer considéré en ligne s’il a pingé récemment. */
export const LIVE_VIEWER_ONLINE_MS = 45_000;
/** Qualifié après 1 minute de présence cumulée depuis joinedAt. */
export const LIVE_VIEWER_QUALIFY_MS = 60_000;

export type LiveViewerRow = {
  peerKey: string;
  userId: string | null;
  name: string;
  image: string | null;
  joinedAt: string;
  lastSeenAt: string;
  qualified: boolean;
  online: boolean;
  watchedSeconds: number;
};

export type LiveViewersSnapshot = {
  viewerCount: number;
  qualifiedCount: number;
  viewers: LiveViewerRow[];
};

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function pingLiveViewer(opts: {
  liveId: string;
  peerKey: string;
  userId?: string | null;
  displayName: string;
  imageUrl?: string | null;
  /** Host ne compte pas dans les viewers. */
  isHost?: boolean;
}): Promise<LiveViewersSnapshot | null> {
  if (opts.isHost) {
    return listLiveViewers(opts.liveId);
  }
  const now = new Date();
  try {
    const existing = await withDbRetry(() =>
      prisma.liveViewerPresence.findUnique({
        where: {
          liveId_peerKey: { liveId: opts.liveId, peerKey: opts.peerKey },
        },
      }),
    );
    const joinedAt = existing?.joinedAt ?? now;
    const watchedMs = now.getTime() - asDate(joinedAt).getTime();
    const qualifiedAt =
      existing?.qualifiedAt ??
      (watchedMs >= LIVE_VIEWER_QUALIFY_MS ? now : null);

    await withDbRetry(() =>
      prisma.liveViewerPresence.upsert({
        where: {
          liveId_peerKey: { liveId: opts.liveId, peerKey: opts.peerKey },
        },
        create: {
          liveId: opts.liveId,
          peerKey: opts.peerKey,
          userId: opts.userId ?? null,
          displayName: opts.displayName.slice(0, 80) || "Viewer",
          imageUrl: opts.imageUrl ?? null,
          joinedAt: now,
          lastSeenAt: now,
          qualifiedAt,
          leftAt: null,
        },
        update: {
          userId: opts.userId ?? undefined,
          displayName: opts.displayName.slice(0, 80) || "Viewer",
          imageUrl: opts.imageUrl ?? undefined,
          lastSeenAt: now,
          leftAt: null,
          ...(qualifiedAt && !existing?.qualifiedAt
            ? { qualifiedAt }
            : {}),
        },
      }),
    );

    const online = await withDbRetry(() =>
      prisma.liveViewerPresence.count({
        where: {
          liveId: opts.liveId,
          lastSeenAt: { gte: new Date(now.getTime() - LIVE_VIEWER_ONLINE_MS) },
        },
      }),
    );

    // Peak = max historique des simultanés
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`
          UPDATE "creator_live"
          SET "viewerPeak" = GREATEST("viewerPeak", ${online})
          WHERE id = ${opts.liveId}
        `,
      ),
    );

    return listLiveViewers(opts.liveId);
  } catch {
    return null;
  }
}

export async function leaveLiveViewer(opts: {
  liveId: string;
  peerKey: string;
}) {
  try {
    await withDbRetry(() =>
      prisma.liveViewerPresence.updateMany({
        where: { liveId: opts.liveId, peerKey: opts.peerKey },
        data: { leftAt: new Date() },
      }),
    );
  } catch {
    /* table absente */
  }
}

export async function listLiveViewers(
  liveId: string,
): Promise<LiveViewersSnapshot> {
  const now = Date.now();
  const onlineSince = new Date(now - LIVE_VIEWER_ONLINE_MS);
  try {
    const rows = await withDbRetry(() =>
      prisma.liveViewerPresence.findMany({
        where: {
          liveId,
          OR: [
            { lastSeenAt: { gte: onlineSince } },
            { qualifiedAt: { not: null } },
          ],
        },
        orderBy: [{ lastSeenAt: "desc" }],
        take: 200,
        select: {
          peerKey: true,
          userId: true,
          displayName: true,
          imageUrl: true,
          joinedAt: true,
          lastSeenAt: true,
          qualifiedAt: true,
          user: { select: { name: true, image: true } },
        },
      }),
    );

    const viewers: LiveViewerRow[] = rows.map((row) => {
      const joinedAt = asDate(row.joinedAt);
      const lastSeenAt = asDate(row.lastSeenAt);
      const online = lastSeenAt.getTime() >= onlineSince.getTime();
      const watchedSeconds = Math.max(
        0,
        Math.floor(
          ((online ? now : lastSeenAt.getTime()) - joinedAt.getTime()) / 1000,
        ),
      );
      return {
        peerKey: row.peerKey,
        userId: row.userId,
        name: row.user?.name?.trim() || row.displayName || "Viewer",
        image: row.user?.image ?? row.imageUrl ?? null,
        joinedAt: joinedAt.toISOString(),
        lastSeenAt: lastSeenAt.toISOString(),
        qualified: Boolean(row.qualifiedAt),
        online,
        watchedSeconds,
      };
    });

    // Liste host : en ligne d’abord, puis qualifiés hors ligne
    viewers.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    });

    const viewerCount = viewers.filter((row) => row.online).length;
    const qualifiedCount = viewers.filter((row) => row.qualified).length;

    return { viewerCount, qualifiedCount, viewers };
  } catch {
    return { viewerCount: 0, qualifiedCount: 0, viewers: [] };
  }
}
