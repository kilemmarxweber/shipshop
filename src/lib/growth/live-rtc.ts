import { prisma, withDbRetry } from "@/lib/prisma";
import type { LiveRtcKind, LiveRtcSignalPublic } from "@/lib/growth/live-rtc-shared";
import { wakeLiveRtcPeer } from "@/lib/growth/live-rtc-bus";

export type {
  LiveRtcKind,
  LiveRtcSignalPublic,
  LivePublisherPeer,
} from "@/lib/growth/live-rtc-shared";
export {
  LIVE_RTC_ICE_SERVERS,
  peerIdStorageKey,
  resolveLivePeerId,
} from "@/lib/growth/live-rtc-shared";

export async function enqueueRtcSignal(input: {
  liveId: string;
  fromPeerId: string;
  toPeerId: string;
  kind: LiveRtcKind;
  payload: unknown;
}) {
  if (typeof prisma.liveRtcSignal?.create !== "function") return null;
  if (!input.fromPeerId || !input.toPeerId || input.fromPeerId === input.toPeerId) {
    return null;
  }
  const row = await withDbRetry(() =>
    prisma.liveRtcSignal.create({
      data: {
        liveId: input.liveId,
        fromPeerId: input.fromPeerId,
        toPeerId: input.toPeerId,
        kind: input.kind,
        payload: input.payload as object,
      },
      select: {
        id: true,
        fromPeerId: true,
        toPeerId: true,
        kind: true,
        payload: true,
        createdAt: true,
      },
    }),
  );
  wakeLiveRtcPeer(input.liveId, input.toPeerId);
  return row;
}

/** Récupère + marque consommés les signaux destinés à ce peer. */
export async function consumeRtcSignals(
  liveId: string,
  toPeerId: string,
  take = 40,
): Promise<LiveRtcSignalPublic[]> {
  if (!toPeerId || typeof prisma.liveRtcSignal?.findMany !== "function") {
    return [];
  }
  try {
    const rows = await withDbRetry(() =>
      prisma.liveRtcSignal.findMany({
        where: { liveId, toPeerId, consumedAt: null },
        orderBy: { createdAt: "asc" },
        take,
        select: {
          id: true,
          fromPeerId: true,
          toPeerId: true,
          kind: true,
          payload: true,
          createdAt: true,
        },
      }),
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    await withDbRetry(() =>
      prisma.liveRtcSignal.updateMany({
        where: { id: { in: ids } },
        data: { consumedAt: new Date() },
      }),
    );
    const cutoff = new Date(Date.now() - 10 * 60_000);
    void withDbRetry(() =>
      prisma.liveRtcSignal.deleteMany({
        where: {
          liveId,
          OR: [
            { createdAt: { lt: cutoff } },
            { consumedAt: { not: null, lt: cutoff } },
          ],
        },
      }),
    ).catch(() => undefined);
    return rows;
  } catch (error) {
    console.error("[live-rtc] consume", error);
    return [];
  }
}
