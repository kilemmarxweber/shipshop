import { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { deleteUploadByPublicUrl } from "@/lib/upload-file.server";

async function readBackdropUrl(liveId: string): Promise<string | null> {
  try {
    const rows = await withDbRetry(() =>
      prisma.$queryRaw<Array<{ backdropUrl: string | null }>>(
        Prisma.sql`SELECT "backdropUrl" FROM "creator_live" WHERE id = ${liveId} LIMIT 1`,
      ),
    );
    return typeof rows[0]?.backdropUrl === "string" ? rows[0].backdropUrl : null;
  } catch {
    return null;
  }
}

async function clearBackdropColumns(liveId: string): Promise<void> {
  try {
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`
          UPDATE "creator_live"
          SET
            "backdropUrl" = NULL,
            "backdropPreset" = NULL,
            "videoFilter" = NULL
          WHERE id = ${liveId}
        `,
      ),
    );
  } catch {
    /* colonnes absentes */
  }
}

/** Efface le fond custom du disque + champs DB (après fin de live). */
export async function purgeLiveBackdrop(liveId: string): Promise<void> {
  const url = await readBackdropUrl(liveId);
  if (url) {
    await deleteUploadByPublicUrl(url);
  }
  await clearBackdropColumns(liveId);
}

/** Fin de live + purge fond (host end, timeout, remplacement). */
export async function endLiveWithBackdropPurge(
  liveId: string,
  data: {
    endReason: string;
    pauseReason?: string | null;
  },
): Promise<void> {
  const prevUrl = await readBackdropUrl(liveId);
  const endedAt = new Date();
  if (data.pauseReason != null) {
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`
          UPDATE "creator_live"
          SET
            status = 'ENDED',
            "endedAt" = ${endedAt},
            "endReason" = ${data.endReason},
            "pauseReason" = ${data.pauseReason},
            "backdropUrl" = NULL,
            "backdropPreset" = NULL,
            "videoFilter" = NULL
          WHERE id = ${liveId}
        `,
      ),
    );
  } else {
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`
          UPDATE "creator_live"
          SET
            status = 'ENDED',
            "endedAt" = ${endedAt},
            "endReason" = ${data.endReason},
            "backdropUrl" = NULL,
            "backdropPreset" = NULL,
            "videoFilter" = NULL
          WHERE id = ${liveId}
        `,
      ),
    );
  }
  if (prevUrl) {
    await deleteUploadByPublicUrl(prevUrl);
  }
}

/** Quand on lance un nouveau live : terminer les anciens + supprimer leurs fonds. */
export async function endActiveLivesForHost(userId: string): Promise<void> {
  let rows: { id: string; backdropUrl: string | null }[] = [];
  try {
    rows = await withDbRetry(() =>
      prisma.$queryRaw<Array<{ id: string; backdropUrl: string | null }>>(
        Prisma.sql`
          SELECT id, "backdropUrl"
          FROM "creator_live"
          WHERE "userId" = ${userId} AND status IN ('LIVE', 'PAUSED')
        `,
      ),
    );
  } catch {
    await withDbRetry(() =>
      prisma.creatorLive.updateMany({
        where: { userId, status: { in: ["LIVE", "PAUSED"] } },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          endReason: "host",
        },
      }),
    );
    return;
  }
  if (rows.length === 0) return;
  const endedAt = new Date();
  const ids = rows.map((r) => r.id);
  for (const liveId of ids) {
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`
          UPDATE "creator_live"
          SET
            status = 'ENDED',
            "endedAt" = ${endedAt},
            "endReason" = 'host',
            "backdropUrl" = NULL,
            "backdropPreset" = NULL,
            "videoFilter" = NULL
          WHERE id = ${liveId}
        `,
      ),
    );
  }
  await Promise.all(
    rows
      .map((r) => r.backdropUrl)
      .filter((u): u is string => Boolean(u))
      .map((u) => deleteUploadByPublicUrl(u)),
  );
}
