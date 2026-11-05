import { Prisma } from "@/generated/prisma/client";
import { createAppNotice } from "@/lib/app-notice";
import { type GiftKind } from "@/lib/growth/constants";
import { sendCreatorGift } from "@/lib/growth/gifts";
import { endLiveWithBackdropPurge } from "@/lib/growth/live-backdrop-purge";
import {
    isLiveBackdropPresetId,
    isLiveBackdropUploadUrl,
} from "@/lib/growth/live-backdrops";
import { listLiveCatalogProducts } from "@/lib/growth/live-catalog";
import { computeLiveEngagement } from "@/lib/growth/live-engagement";
import {
    LIVE_GUEST_MAX_ON_STAGE,
    closeLiveGuests,
    countOnStage,
    getMyLiveGuest,
    grantGuestFloor,
    isLiveFollower,
    listLiveGuests,
    promoteGuestOnStage,
    reconcileSoloFloor,
    revokeGuestFloor,
} from "@/lib/growth/live-guests";
import {
    liveOverlaysSchema,
    overlayList,
    parseLiveOverlays,
    readCatalogState,
    readLastGiftBurst,
    withCatalogOverlay,
    withGiftBurst,
} from "@/lib/growth/live-overlays";
import {
    enqueueRtcSignal,
    type LivePublisherPeer,
    type LiveRtcKind,
} from "@/lib/growth/live-rtc";
import {
    LIVE_DEFAULT_PLANNED_MINUTES,
    LIVE_HEARTBEAT_STALE_MS,
    LIVE_LIKE_RATE_PER_MIN,
    LIVE_PAUSE_TIMEOUT_MS,
    LIVE_PROLONG_MINUTES,
    liveEndMessage,
    livePauseMessage,
} from "@/lib/growth/live-session";
import { isLiveSfuConfigured } from "@/lib/growth/live-sfu";
import {
    leaveLiveViewer,
    listLiveViewers,
    pingLiveViewer,
} from "@/lib/growth/live-viewers";
import {
    isLiveStageLayoutId,
    normalizeStageLayout,
} from "@/lib/growth/live-stage-layout";
import { isLiveVideoFilterId } from "@/lib/growth/live-video-filters";
import { idempotencyFrom } from "@/lib/payments/ledger";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { deleteUploadByPublicUrl } from "@/lib/upload-file.server";
import { NextResponse } from "next/server";
import { z } from "zod";

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

/** Rate-limit j’aime : userId → timestamps récents (fenêtre 60s). */
const likeRateBucket = new Map<string, number[]>();

function allowLiveLike(userId: string, liveId: string): boolean {
  const key = `${liveId}:${userId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const prev = (likeRateBucket.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  if (prev.length >= LIVE_LIKE_RATE_PER_MIN) {
    likeRateBucket.set(key, prev);
    return false;
  }
  prev.push(now);
  likeRateBucket.set(key, prev);
  return true;
}

const chatSchema = z.object({
  body: z.string().min(1).max(180),
});

const giftSchema = z
  .object({
    kind: z.enum(["SMALL", "MEDIUM", "PREMIUM", "CUSTOM"]).optional(),
    amountCents: z.number().int().positive().optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine((v) => v.amountCents != null || v.kind != null, {
    message: "Montant ou type de cadeau requis",
  });

async function reconcileLive(id: string) {
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({ where: { id } }),
  );
  if (!live || live.status === "ENDED") return live;

  const now = Date.now();

  if (live.status === "LIVE") {
    const beat = live.lastHeartbeatAt?.getTime() ?? live.startedAt.getTime();
    if (now - beat > LIVE_HEARTBEAT_STALE_MS) {
      return withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: {
            status: "PAUSED",
            pausedAt: new Date(),
            pauseReason: "connection",
          },
        }),
      );
    }
  }

  if (live.status === "PAUSED" && live.pausedAt) {
    if (now - live.pausedAt.getTime() >= LIVE_PAUSE_TIMEOUT_MS) {
      await endLiveWithBackdropPurge(id, {
        endReason: "pause_timeout",
        pauseReason: live.pauseReason,
      });
      await closeLiveGuests(id);
      return withDbRetry(() =>
        prisma.creatorLive.findUnique({ where: { id } }),
      );
    }
  }

  return live;
}

function publicLive<T extends Record<string, unknown>>(live: T) {
  const status = String(live.status ?? "");
  const pauseReason =
    typeof live.pauseReason === "string" ? live.pauseReason : null;
  const endReason = typeof live.endReason === "string" ? live.endReason : null;
  return {
    ...live,
    statusMessage:
      status === "PAUSED"
        ? livePauseMessage(pauseReason)
        : status === "ENDED"
          ? liveEndMessage(endReason)
          : null,
    pauseTimeoutMs: LIVE_PAUSE_TIMEOUT_MS,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  // Uniquement à l’entrée room (?countView=1) — pas à chaque poll
  const countView = url.searchParams.get("countView") === "1";
  await reconcileLive(id);
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, image: true } },
        product: {
          select: {
            id: true,
            title: true,
            description: true,
            images: true,
            priceCents: true,
            currency: true,
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
        chats: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            body: true,
            createdAt: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  if (countView && (live.status === "LIVE" || live.status === "PAUSED")) {
    await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: { viewerPeak: { increment: 1 } },
      }),
    );
  }
  const guests = await listLiveGuests(id);
  const viewer = await getSession();
  const myGuest = viewer ? await getMyLiveGuest(id, viewer.user.id) : null;
  const publishers: LivePublisherPeer[] = [
    {
      peerId: live.user.id,
      role: "host",
      name: live.user.name,
      image: live.user.image,
      cameraOn: live.cameraOn !== false,
      micOn: (live as { micOn?: boolean }).micOn !== false,
    },
    ...guests
      .filter((g) => g.status === "ON_STAGE")
      .map((g) => ({
        peerId: g.user.id,
        role: "guest" as const,
        name: g.user.name,
        image: g.user.image,
        cameraOn: g.cameraOn,
        micOn: g.micOn,
      })),
  ];
  const chatCount = Array.isArray(live.chats) ? live.chats.length : 0;
  // chats take 40 — compter en DB si besoin d’un total exact pour l’alerte
  let chatTotal = chatCount;
  try {
    chatTotal = await withDbRetry(() =>
      prisma.liveChatMessage.count({ where: { liveId: id } }),
    );
  } catch {
    /* ignore */
  }
  const likeCount =
    typeof (live as { likeCount?: number }).likeCount === "number"
      ? (live as { likeCount: number }).likeCount
      : 0;
  // Fond / filtre : lecture SQL (HMR Prisma peut omettre les colonnes)
  let backdropPreset: string | null =
    typeof (live as { backdropPreset?: string | null }).backdropPreset ===
    "string"
      ? (live as { backdropPreset: string }).backdropPreset
      : null;
  let backdropUrl: string | null =
    typeof (live as { backdropUrl?: string | null }).backdropUrl === "string"
      ? (live as { backdropUrl: string }).backdropUrl
      : null;
  let videoFilter: string | null =
    typeof (live as { videoFilter?: string | null }).videoFilter === "string"
      ? (live as { videoFilter: string }).videoFilter
      : null;
  let stageLayout = normalizeStageLayout(
    (live as { stageLayout?: string | null }).stageLayout,
  );
  let guestJoinLocked = Boolean(
    (live as { guestJoinLocked?: boolean }).guestJoinLocked,
  );
  let overlaysRaw: unknown[] = overlayList(
    (live as { overlays?: unknown }).overlays,
  );
  let catalogOpenCol = Boolean((live as { catalogOpen?: boolean }).catalogOpen);
  let presentedCol =
    typeof (live as { presentedProductId?: string | null })
      .presentedProductId === "string"
      ? (live as { presentedProductId: string }).presentedProductId
      : null;
  try {
    const bg = await withDbRetry(() =>
      prisma.$queryRaw<
        Array<{
          backdropPreset: string | null;
          backdropUrl: string | null;
          videoFilter: string | null;
          stageLayout: string | null;
          guestJoinLocked: boolean | null;
          overlays: unknown;
        }>
      >(
        Prisma.sql`
          SELECT "backdropPreset", "backdropUrl", "videoFilter",
                 "stageLayout", "guestJoinLocked", overlays
          FROM "creator_live" WHERE id = ${id} LIMIT 1
        `,
      ),
    );
    if (bg[0]) {
      backdropPreset = bg[0].backdropPreset;
      backdropUrl = bg[0].backdropUrl;
      videoFilter = bg[0].videoFilter;
      stageLayout = normalizeStageLayout(bg[0].stageLayout);
      guestJoinLocked = Boolean(bg[0].guestJoinLocked);
      if (bg[0].overlays != null) overlaysRaw = overlayList(bg[0].overlays);
    }
  } catch {
    /* colonnes absentes */
  }
  try {
    const cat = await withDbRetry(() =>
      prisma.$queryRaw<
        Array<{
          catalogOpen: boolean | null;
          presentedProductId: string | null;
        }>
      >(
        Prisma.sql`
          SELECT "catalogOpen", "presentedProductId"
          FROM "creator_live" WHERE id = ${id} LIMIT 1
        `,
      ),
    );
    if (cat[0]) {
      catalogOpenCol = Boolean(cat[0].catalogOpen);
      presentedCol = cat[0].presentedProductId;
    }
  } catch {
    /* migration catalogue pas encore appliquée */
  }
  const isHostViewer = viewer?.user.id === live.userId;
  const engagement = computeLiveEngagement({
    startedAt: live.startedAt,
    status: live.status,
    likeCount,
    chatCount: chatTotal,
    giftCents: live.giftCents,
    guestsOnStage: guests.filter((g) => g.status === "ON_STAGE").length,
  });
  // Solde cadeaux du live : privé au diffuseur (UI + payload)
  const { giftCents, ...liveWithoutGifts } = live as typeof live & {
    giftCents: number;
  };
  const catalog = readCatalogState(overlaysRaw, {
    catalogOpen: catalogOpenCol,
    presentedProductId: presentedCol,
  });
  const catalogProducts = catalog.catalogOpen
    ? (await listLiveCatalogProducts(live.userId)).products
    : [];
  const presence = await listLiveViewers(id);
  return NextResponse.json({
    live: publicLive({
      ...liveWithoutGifts,
      likeCount,
      viewerCount: presence.viewerCount,
      viewerPeak: Math.max(live.viewerPeak ?? 0, presence.viewerCount),
      qualifiedViewerCount: presence.qualifiedCount,
      ...(isHostViewer ? { viewers: presence.viewers } : {}),
      backdropPreset,
      backdropUrl,
      videoFilter:
        videoFilter && videoFilter !== "natural" ? videoFilter : null,
      stageLayout,
      guestJoinLocked,
      overlays: parseLiveOverlays(overlaysRaw),
      catalogOpen: catalog.catalogOpen,
      presentedProductId: catalog.presentedProductId,
      catalogScrollY: catalog.scrollY,
      catalogProducts,
      lastGiftBurst: readLastGiftBurst(overlaysRaw),
      chats: [...live.chats].reverse(),
      guests,
      myGuest,
      publishers,
      ...(isHostViewer ? { giftCents, engagement } : {}),
      // Signaling uniquement SSE `/rtc` (poll ne doit pas consumer les signaux)
      rtcSignals: [],
      // true = client utilise LiveKit SFU (millions de viewers)
      sfu: isLiveSfuConfigured(),
    }),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { id } = await params;
  await reconcileLive(id);
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        plannedMinutes: true,
        pausedAt: true,
      },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }

  const json = (await req.json()) as {
    action?: string;
    cameraOn?: boolean;
    micOn?: boolean;
    reason?: string;
    body?: string;
    kind?: string;
    guestId?: string;
    userId?: string;
    userIds?: string[];
    peerId?: string;
    peerKey?: string;
    toPeerId?: string;
    payload?: unknown;
    preset?: string | null;
    url?: string | null;
    filter?: string | null;
    layout?: string | null;
    locked?: boolean;
    open?: boolean;
    presentedProductId?: string | null;
    scrollY?: number;
  };

  const isHost = live.userId === session.user.id;

  async function guestsPayload() {
    return listLiveGuests(id);
  }

  if (json.action === "heartbeat") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const updated = await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: {
          lastHeartbeatAt: new Date(),
          ...(live.status === "PAUSED" && json.reason === "auto_resume"
            ? {
                status: "LIVE",
                pausedAt: null,
                pauseReason: null,
              }
            : {}),
        },
      }),
    );
    return NextResponse.json({ live: publicLive(updated) });
  }

  if (json.action === "presence") {
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const peerKey =
      typeof json.peerKey === "string" && json.peerKey.trim()
        ? json.peerKey.trim().slice(0, 80)
        : session.user.id;
    const presence = await pingLiveViewer({
      liveId: id,
      peerKey,
      userId: session.user.id,
      displayName: session.user.name ?? "Viewer",
      imageUrl: session.user.image ?? null,
      isHost,
    });
    return NextResponse.json({
      viewerCount: presence?.viewerCount ?? 0,
      qualifiedViewerCount: presence?.qualifiedCount ?? 0,
      ...(isHost ? { viewers: presence?.viewers ?? [] } : {}),
    });
  }

  if (json.action === "presence_leave") {
    const peerKey =
      typeof json.peerKey === "string" && json.peerKey.trim()
        ? json.peerKey.trim().slice(0, 80)
        : session.user.id;
    await leaveLiveViewer({ liveId: id, peerKey });
    return NextResponse.json({ ok: true });
  }

  if (json.action === "pause") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const reason =
      json.reason === "connection" || json.reason === "host"
        ? json.reason
        : "host";
    const updated = await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: {
          status: "PAUSED",
          pausedAt: new Date(),
          pauseReason: reason,
          lastHeartbeatAt: new Date(),
        },
      }),
    );
    return NextResponse.json({ live: publicLive(updated) });
  }

  if (json.action === "resume") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const updated = await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: {
          status: "LIVE",
          pausedAt: null,
          pauseReason: null,
          lastHeartbeatAt: new Date(),
        },
      }),
    );
    return NextResponse.json({ live: publicLive(updated) });
  }

  if (json.action === "camera") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const cameraOn = Boolean(json.cameraOn);
    const updated = await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: { cameraOn, lastHeartbeatAt: new Date() },
      }),
    );
    return NextResponse.json({ live: publicLive(updated) });
  }

  if (json.action === "mic") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const micOn = Boolean(json.micOn);
    try {
      const updated = await withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: { micOn, lastHeartbeatAt: new Date() },
        }),
      );
      return NextResponse.json({ live: publicLive(updated) });
    } catch (error) {
      console.error("[api/growth/lives] mic", error);
      return NextResponse.json(
        { error: "Micro indisponible — migrate / redémarrez pnpm dev" },
        { status: 503 },
      );
    }
  }

  if (json.action === "rtc_signal") {
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const toPeerId =
      typeof json.toPeerId === "string" ? json.toPeerId.slice(0, 64) : "";
    const kind = json.kind as LiveRtcKind;
    if (!toPeerId || !["offer", "answer", "ice"].includes(kind)) {
      return NextResponse.json(
        { error: "Signal RTC invalide" },
        { status: 400 },
      );
    }
    const fromPeerId = session.user.id;
    if (fromPeerId === toPeerId) {
      return NextResponse.json({ ok: true });
    }
    try {
      await enqueueRtcSignal({
        liveId: id,
        fromPeerId,
        toPeerId,
        kind,
        payload: json.payload ?? {},
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[api/growth/lives] rtc_signal", error);
      return NextResponse.json(
        { error: "Signal RTC impossible" },
        { status: 503 },
      );
    }
  }

  if (json.action === "prolong") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const next =
      (live.plannedMinutes || LIVE_DEFAULT_PLANNED_MINUTES) +
      LIVE_PROLONG_MINUTES;
    const updated = await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: {
          plannedMinutes: next,
          lastHeartbeatAt: new Date(),
        },
      }),
    );
    return NextResponse.json({ live: publicLive(updated) });
  }

  if (json.action === "catalog") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const open = Boolean(json.open);
    const presented =
      typeof json.presentedProductId === "string" && json.presentedProductId
        ? json.presentedProductId.slice(0, 64)
        : json.presentedProductId === null
          ? null
          : undefined;
    const current = await withDbRetry(() =>
      prisma.creatorLive.findUnique({
        where: { id },
        select: { overlays: true, presentedProductId: true },
      }),
    );
    const currentCatalog = readCatalogState(current?.overlays, {
      presentedProductId:
        typeof current?.presentedProductId === "string"
          ? current.presentedProductId
          : null,
    });
    const presentedId = !open
      ? null
      : presented !== undefined
        ? presented
        : currentCatalog.presentedProductId;
    const scrollY =
      typeof json.scrollY === "number" && Number.isFinite(json.scrollY)
        ? Math.min(1, Math.max(0, json.scrollY))
        : currentCatalog.scrollY;
    const quiet = typeof json.scrollY === "number" && presented === undefined;
    try {
      const overlays = withCatalogOverlay(
        parseLiveOverlays(current?.overlays),
        open,
        presentedId,
        scrollY,
      );
      let updated: Record<string, unknown> = { overlays };
      try {
        updated = await withDbRetry(() =>
          prisma.creatorLive.update({
            where: { id },
            data: {
              overlays,
              catalogOpen: open,
              presentedProductId: presentedId,
              ...(presentedId ? { productId: presentedId } : {}),
              lastHeartbeatAt: new Date(),
            },
          }),
        );
      } catch {
        await withDbRetry(() =>
          prisma.creatorLive.update({
            where: { id },
            data: {
              overlays,
              ...(presentedId ? { productId: presentedId } : {}),
              lastHeartbeatAt: new Date(),
            },
          }),
        );
        try {
          await withDbRetry(() =>
            prisma.$executeRaw(
              Prisma.sql`
                UPDATE "creator_live"
                SET "catalogOpen" = ${open},
                    "presentedProductId" = ${presentedId}
                WHERE id = ${id}
              `,
            ),
          );
        } catch {
          /* colonnes absentes */
        }
      }
      const catalogProducts =
        open && !quiet
          ? (await listLiveCatalogProducts(live.userId)).products
          : undefined;
      return NextResponse.json({
        live: publicLive({
          ...updated,
          overlays,
          catalogOpen: open,
          presentedProductId: presentedId,
          catalogScrollY: scrollY,
          ...(catalogProducts ? { catalogProducts } : {}),
        }),
      });
    } catch (error) {
      console.error("[api/growth/lives] catalog", error);
      return NextResponse.json(
        { error: "Sync catalogue impossible" },
        { status: 500 },
      );
    }
  }

  if (json.action === "overlays") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const overlaysRaw = (json as { overlays?: unknown }).overlays;
    const parsed = liveOverlaysSchema.safeParse(overlaysRaw ?? []);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Overlays invalides (max 12)" },
        { status: 400 },
      );
    }
    const featuredProductId = parsed.data.find(
      (o) => o.kind === "product",
    )?.productId;
    try {
      const current = await withDbRetry(() =>
        prisma.creatorLive.findUnique({
          where: { id },
          select: { overlays: true },
        }),
      );
      const catalogKeep = parseLiveOverlays(current?.overlays).filter(
        (row) => row.kind === "catalog",
      );
      const overlays = [
        ...parsed.data.filter((row) => row.kind !== "catalog"),
        ...catalogKeep,
      ];
      const updated = await withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: {
            overlays,
            ...(featuredProductId ? { productId: featuredProductId } : {}),
            lastHeartbeatAt: new Date(),
          },
        }),
      );
      return NextResponse.json({
        live: publicLive({
          ...updated,
          overlays: parseLiveOverlays(updated.overlays),
        }),
      });
    } catch (error) {
      console.error("[api/growth/lives] overlays", error);
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("Unknown argument") ||
        message.includes("overlays") ||
        message.includes("column")
      ) {
        return NextResponse.json(
          {
            error: "Schéma overlays pas chargé — redémarrez `pnpm dev`",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Sync overlays impossible" },
        { status: 500 },
      );
    }
  }

  if (json.action === "end") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    try {
      await withDbRetry(() =>
        prisma.liveChatMessage.create({
          data: {
            liveId: id,
            userId: session.user.id,
            body: "Le live est terminé.",
          },
        }),
      );
    } catch {
      /* le statut ENDED suffit pour prévenir la room */
    }
    await endLiveWithBackdropPurge(id, { endReason: "host" });
    await closeLiveGuests(id);
    return NextResponse.json({ ok: true });
  }

  if (json.action === "backdrop") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const rawPreset = json.preset;
    const rawUrl = json.url;
    const clear =
      rawPreset === null &&
      (rawUrl === null || rawUrl === undefined || rawUrl === "");
    let backdropPreset: string | null = null;
    let backdropUrl: string | null = null;
    if (!clear) {
      if (typeof rawUrl === "string" && rawUrl.trim()) {
        const url = rawUrl.trim().slice(0, 512);
        if (!isLiveBackdropUploadUrl(url)) {
          return NextResponse.json(
            { error: "Image de fond invalide" },
            { status: 400 },
          );
        }
        backdropUrl = url;
        backdropPreset = null;
      } else if (isLiveBackdropPresetId(rawPreset)) {
        backdropPreset = rawPreset;
        backdropUrl = null;
      } else {
        return NextResponse.json(
          { error: "Choisissez un fond ou une image" },
          { status: 400 },
        );
      }
    }
    try {
      // SQL brut : évite Prisma Client HMR périmé (Unknown argument backdrop*)
      const prevRows = await withDbRetry(() =>
        prisma.$queryRaw<Array<{ backdropUrl: string | null }>>(
          Prisma.sql`SELECT "backdropUrl" FROM "creator_live" WHERE id = ${id} LIMIT 1`,
        ),
      );
      const prevUrl =
        typeof prevRows[0]?.backdropUrl === "string"
          ? prevRows[0].backdropUrl
          : null;
      await withDbRetry(() =>
        prisma.$executeRaw(
          Prisma.sql`
            UPDATE "creator_live"
            SET
              "backdropPreset" = ${backdropPreset},
              "backdropUrl" = ${backdropUrl},
              "lastHeartbeatAt" = ${new Date()}
            WHERE id = ${id}
          `,
        ),
      );
      if (prevUrl && prevUrl !== backdropUrl) {
        void deleteUploadByPublicUrl(prevUrl);
      }
      return NextResponse.json({
        live: publicLive({
          ...live,
          backdropPreset,
          backdropUrl,
          overlays: parseLiveOverlays(
            (live as { overlays?: unknown }).overlays,
          ),
        }),
      });
    } catch (error) {
      console.error("[api/growth/lives] backdrop", error);
      return NextResponse.json(
        {
          error:
            "Fond impossible — colonnes absentes ? `pnpm exec prisma db push`",
        },
        { status: 503 },
      );
    }
  }

  if (json.action === "video_filter") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const raw = json.filter;
    let videoFilter: string | null = null;
    if (raw == null || raw === "" || raw === "natural") {
      videoFilter = null;
    } else if (isLiveVideoFilterId(raw) && raw !== "natural") {
      videoFilter = raw;
    } else {
      return NextResponse.json({ error: "Filtre invalide" }, { status: 400 });
    }
    try {
      await withDbRetry(() =>
        prisma.$executeRaw(
          Prisma.sql`
            UPDATE "creator_live"
            SET
              "videoFilter" = ${videoFilter},
              "lastHeartbeatAt" = ${new Date()}
            WHERE id = ${id}
          `,
        ),
      );
      return NextResponse.json({
        live: publicLive({
          ...live,
          videoFilter,
          overlays: parseLiveOverlays(
            (live as { overlays?: unknown }).overlays,
          ),
        }),
      });
    } catch (error) {
      console.error("[api/growth/lives] video_filter", error);
      return NextResponse.json(
        { error: "Filtre impossible — `pnpm exec prisma db push`" },
        { status: 503 },
      );
    }
  }

  // —— Host invite 1 ou N viewers (depuis le chat) ——
  if (json.action === "guest_invite") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const rawIds = Array.isArray(json.userIds)
      ? json.userIds
      : typeof json.userId === "string"
        ? [json.userId]
        : [];
    const userIds = [
      ...new Set(
        rawIds
          .filter((u): u is string => typeof u === "string" && u.length > 0)
          .map((u) => u.slice(0, 64))
          .filter((u) => u !== session.user.id),
      ),
    ].slice(0, 12);
    if (userIds.length === 0) {
      return NextResponse.json(
        { error: "Aucun viewer à inviter" },
        { status: 400 },
      );
    }
    try {
      const onStage = await countOnStage(id);
      const invitedNow = await withDbRetry(() =>
        prisma.liveGuest.count({
          where: { liveId: id, status: "INVITED" },
        }),
      );
      const slots = LIVE_GUEST_MAX_ON_STAGE - onStage - invitedNow;
      if (slots <= 0) {
        return NextResponse.json(
          {
            error: `Scène pleine (max ${LIVE_GUEST_MAX_ON_STAGE} invités)`,
          },
          { status: 400 },
        );
      }
      const toInvite = userIds.slice(0, Math.max(1, slots));
      let invitedCount = 0;
      for (const uid of toInvite) {
        const existing = await withDbRetry(() =>
          prisma.liveGuest.findUnique({
            where: { liveId_userId: { liveId: id, userId: uid } },
          }),
        );
        if (existing?.status === "ON_STAGE" || existing?.status === "INVITED") {
          continue;
        }
        if (existing?.status === "PENDING") {
          // Déjà en demande → accepter directement
          const on = await countOnStage(id);
          if (on >= LIVE_GUEST_MAX_ON_STAGE) break;
          await promoteGuestOnStage(existing.id, id, { cameraOn: true });
          invitedCount += 1;
          void createAppNotice({
            userId: uid,
            title: "Vous êtes sur scène",
            body: "Le diffuseur vous a fait monter au live.",
            href: `/live/${id}`,
          });
          continue;
        }
        if (existing) {
          await withDbRetry(() =>
            prisma.liveGuest.update({
              where: { id: existing.id },
              data: {
                status: "INVITED",
                cameraOn: false,
                micOn: false,
                requestedAt: new Date(),
                decidedAt: null,
                leftAt: null,
              },
            }),
          );
        } else {
          await withDbRetry(() =>
            prisma.liveGuest.create({
              data: {
                liveId: id,
                userId: uid,
                status: "INVITED",
              },
            }),
          );
        }
        invitedCount += 1;
        void createAppNotice({
          userId: uid,
          title: "Invitation sur scène",
          body: `${session.user.name ?? "Le diffuseur"} vous invite à monter au live — acceptez dans la room.`,
          href: `/live/${id}`,
        });
      }
      return NextResponse.json({
        guests: await guestsPayload(),
        invitedCount,
      });
    } catch (error) {
      console.error("[api/growth/lives] guest_invite", error);
      return NextResponse.json(
        { error: "Invitation impossible" },
        { status: 503 },
      );
    }
  }

  if (
    json.action === "guest_invite_accept" ||
    json.action === "guest_invite_refuse"
  ) {
    if (isHost) {
      return NextResponse.json(
        { error: "Action viewer uniquement" },
        { status: 400 },
      );
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: {
            liveId_userId: { liveId: id, userId: session.user.id },
          },
        }),
      );
      if (!row || row.status !== "INVITED") {
        return NextResponse.json(
          { error: "Aucune invitation en attente" },
          { status: 400 },
        );
      }
      if (json.action === "guest_invite_refuse") {
        await withDbRetry(() =>
          prisma.liveGuest.update({
            where: { id: row.id },
            data: {
              status: "REFUSED",
              decidedAt: new Date(),
              cameraOn: false,
              micOn: false,
            },
          }),
        );
        void createAppNotice({
          userId: live.userId,
          title: "Invitation refusée",
          body: `${session.user.name ?? "Un viewer"} a décliné l’invitation sur scène.`,
          href: `/live/${id}`,
        });
        return NextResponse.json({
          guests: await guestsPayload(),
          guest: await getMyLiveGuest(id, session.user.id),
        });
      }
      const onStage = await countOnStage(id);
      if (onStage >= LIVE_GUEST_MAX_ON_STAGE) {
        return NextResponse.json(
          { error: `Scène pleine (max ${LIVE_GUEST_MAX_ON_STAGE})` },
          { status: 400 },
        );
      }
      await promoteGuestOnStage(row.id, id, { cameraOn: true });
      void createAppNotice({
        userId: live.userId,
        title: "Invité sur scène",
        body: `${session.user.name ?? "Un viewer"} a accepté et monte au live.`,
        href: `/live/${id}`,
      });
      return NextResponse.json({
        guests: await guestsPayload(),
        guest: await getMyLiveGuest(id, session.user.id),
      });
    } catch (error) {
      console.error("[api/growth/lives] guest_invite_reply", error);
      return NextResponse.json(
        { error: "Réponse invitation impossible" },
        { status: 500 },
      );
    }
  }

  if (json.action === "stage_layout") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    if (!isLiveStageLayoutId(json.layout)) {
      return NextResponse.json(
        { error: "Disposition invalide" },
        { status: 400 },
      );
    }
    const stageLayout = json.layout;
    try {
      await withDbRetry(() =>
        prisma.$executeRaw(
          Prisma.sql`
            UPDATE "creator_live"
            SET "stageLayout" = ${stageLayout}, "lastHeartbeatAt" = ${new Date()}
            WHERE id = ${id}
          `,
        ),
      );
      return NextResponse.json({
        live: publicLive({ ...live, stageLayout }),
      });
    } catch (error) {
      console.error("[api/growth/lives] stage_layout", error);
      return NextResponse.json(
        { error: "Disposition impossible — `pnpm exec prisma db push`" },
        { status: 503 },
      );
    }
  }

  if (json.action === "guest_join_lock") {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const guestJoinLocked = Boolean(json.locked);
    try {
      await withDbRetry(() =>
        prisma.$executeRaw(
          Prisma.sql`
            UPDATE "creator_live"
            SET "guestJoinLocked" = ${guestJoinLocked},
                "lastHeartbeatAt" = ${new Date()}
            WHERE id = ${id}
          `,
        ),
      );
      return NextResponse.json({
        live: publicLive({ ...live, guestJoinLocked }),
      });
    } catch (error) {
      console.error("[api/growth/lives] guest_join_lock", error);
      return NextResponse.json(
        { error: "Verrou impossible — `pnpm exec prisma db push`" },
        { status: 503 },
      );
    }
  }

  // —— Invités sur scène (followers) ——
  if (json.action === "guest_request") {
    if (isHost) {
      return NextResponse.json(
        { error: "Le diffuseur est déjà sur scène" },
        { status: 400 },
      );
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    try {
      const lockRows = await withDbRetry(() =>
        prisma.$queryRaw<Array<{ guestJoinLocked: boolean | null }>>(
          Prisma.sql`
            SELECT "guestJoinLocked" FROM "creator_live" WHERE id = ${id} LIMIT 1
          `,
        ),
      );
      if (lockRows[0]?.guestJoinLocked) {
        return NextResponse.json(
          { error: "Le diffuseur a fermé les montées sur scène" },
          { status: 403 },
        );
      }
    } catch {
      /* colonne absente → autoriser */
    }
    const follower = await isLiveFollower(session.user.id, live.userId);
    if (!follower) {
      return NextResponse.json(
        { error: "Réservé aux abonnés du créateur" },
        { status: 403 },
      );
    }
    try {
      const existing = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: {
            liveId_userId: { liveId: id, userId: session.user.id },
          },
        }),
      );
      if (existing?.status === "ON_STAGE") {
        return NextResponse.json({
          guests: await guestsPayload(),
          guest: existing,
        });
      }
      if (existing?.status === "PENDING") {
        return NextResponse.json({
          guests: await guestsPayload(),
          guest: existing,
        });
      }
      const guest = existing
        ? await withDbRetry(() =>
            prisma.liveGuest.update({
              where: { id: existing.id },
              data: {
                status: "PENDING",
                cameraOn: false,
                requestedAt: new Date(),
                decidedAt: null,
                leftAt: null,
              },
              select: {
                id: true,
                status: true,
                cameraOn: true,
                requestedAt: true,
                decidedAt: true,
                user: { select: { id: true, name: true, image: true } },
              },
            }),
          )
        : await withDbRetry(() =>
            prisma.liveGuest.create({
              data: {
                liveId: id,
                userId: session.user.id,
                status: "PENDING",
              },
              select: {
                id: true,
                status: true,
                cameraOn: true,
                requestedAt: true,
                decidedAt: true,
                user: { select: { id: true, name: true, image: true } },
              },
            }),
          );
      void createAppNotice({
        userId: live.userId,
        title: "Demande de monter au live",
        body: `${session.user.name ?? "Un abonné"} veut rejoindre votre scène`,
        href: `/live/${id}`,
      });
      return NextResponse.json({
        guests: await guestsPayload(),
        guest,
      });
    } catch (error) {
      console.error("[api/growth/lives] guest_request", error);
      return NextResponse.json(
        {
          error: "Demande impossible — redémarrez `pnpm dev` si schéma récent",
        },
        { status: 503 },
      );
    }
  }

  if (json.action === "guest_cancel" || json.action === "guest_leave") {
    if (isHost) {
      return NextResponse.json(
        { error: "Action invité uniquement" },
        { status: 400 },
      );
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: {
            liveId_userId: { liveId: id, userId: session.user.id },
          },
        }),
      );
      if (!row || (row.status !== "PENDING" && row.status !== "ON_STAGE")) {
        return NextResponse.json({
          guests: await guestsPayload(),
          guest: row ? await getMyLiveGuest(id, session.user.id) : null,
        });
      }
      const guest = await withDbRetry(() =>
        prisma.liveGuest.update({
          where: { id: row.id },
          data: {
            status: "LEFT",
            leftAt: new Date(),
            cameraOn: false,
            micOn: false,
            handRaised: false,
            hasFloor: false,
          },
          select: guestSelect,
        }),
      );
      await reconcileSoloFloor(id);
      return NextResponse.json({ guests: await guestsPayload(), guest });
    } catch (error) {
      console.error("[api/growth/lives] guest_leave", error);
      return NextResponse.json({ error: "Impossible" }, { status: 500 });
    }
  }

  if (
    json.action === "guest_raise_hand" ||
    json.action === "guest_lower_hand"
  ) {
    if (isHost) {
      return NextResponse.json(
        { error: "Action invité uniquement" },
        { status: 400 },
      );
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: {
            liveId_userId: { liveId: id, userId: session.user.id },
          },
        }),
      );
      if (!row || row.status !== "ON_STAGE") {
        return NextResponse.json(
          { error: "Vous n’êtes pas sur scène" },
          { status: 400 },
        );
      }
      if (json.action === "guest_raise_hand") {
        const onStage = await countOnStage(id);
        if (onStage < 2) {
          return NextResponse.json({
            guests: await guestsPayload(),
            guest: await getMyLiveGuest(id, session.user.id),
          });
        }
        if ((row as { hasFloor?: boolean }).hasFloor) {
          return NextResponse.json({
            guests: await guestsPayload(),
            guest: await getMyLiveGuest(id, session.user.id),
          });
        }
        const guest = await withDbRetry(() =>
          prisma.liveGuest.update({
            where: { id: row.id },
            data: { handRaised: true },
            select: guestSelect,
          }),
        );
        void createAppNotice({
          userId: live.userId,
          title: "Main levée",
          body: `${session.user.name ?? "Un invité"} demande la parole.`,
          href: `/live/${id}`,
        });
        return NextResponse.json({
          guests: await guestsPayload(),
          guest,
        });
      }
      const guest = await withDbRetry(() =>
        prisma.liveGuest.update({
          where: { id: row.id },
          data: { handRaised: false },
          select: guestSelect,
        }),
      );
      return NextResponse.json({ guests: await guestsPayload(), guest });
    } catch (error) {
      console.error("[api/growth/lives] guest_hand", error);
      return NextResponse.json(
        { error: "Main impossible — migrate live_guest ?" },
        { status: 503 },
      );
    }
  }

  if (
    json.action === "guest_grant_floor" ||
    json.action === "guest_revoke_floor"
  ) {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const guestId = typeof json.guestId === "string" ? json.guestId : null;
    if (!guestId) {
      return NextResponse.json({ error: "Invité manquant" }, { status: 400 });
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findFirst({
          where: { liveId: id, id: guestId },
          include: { user: { select: { id: true, name: true } } },
        }),
      );
      if (!row || row.status !== "ON_STAGE") {
        return NextResponse.json(
          { error: "Invité hors scène" },
          { status: 400 },
        );
      }
      if (json.action === "guest_grant_floor") {
        await grantGuestFloor(id, row.id);
        void createAppNotice({
          userId: row.userId,
          title: "Parole accordée",
          body: "Le diffuseur vous donne la parole — vous pouvez parler.",
          href: `/live/${id}`,
        });
      } else {
        await revokeGuestFloor(row.id);
        await reconcileSoloFloor(id);
        void createAppNotice({
          userId: row.userId,
          title: "Parole retirée",
          body: "Le diffuseur a repris la parole — levez la main pour redemander.",
          href: `/live/${id}`,
        });
      }
      return NextResponse.json({ guests: await guestsPayload() });
    } catch (error) {
      console.error("[api/growth/lives] guest_floor", error);
      return NextResponse.json({ error: "Parole impossible" }, { status: 503 });
    }
  }

  if (json.action === "guest_camera" || json.action === "guest_mic") {
    if (isHost) {
      return NextResponse.json(
        { error: "Action invité uniquement" },
        { status: 400 },
      );
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findUnique({
          where: {
            liveId_userId: { liveId: id, userId: session.user.id },
          },
        }),
      );
      if (!row || row.status !== "ON_STAGE") {
        return NextResponse.json(
          { error: "Vous n’êtes pas sur scène" },
          { status: 400 },
        );
      }
      if (json.action === "guest_mic" && Boolean(json.micOn)) {
        const onStage = await countOnStage(id);
        const hasFloor = Boolean((row as { hasFloor?: boolean }).hasFloor);
        if (onStage >= 2 && !hasFloor) {
          return NextResponse.json(
            {
              error: "Levez la main — le diffuseur doit vous donner la parole",
            },
            { status: 403 },
          );
        }
      }
      const data =
        json.action === "guest_mic"
          ? { micOn: Boolean(json.micOn) }
          : { cameraOn: Boolean(json.cameraOn) };
      const guest = await withDbRetry(() =>
        prisma.liveGuest.update({
          where: { id: row.id },
          data,
          select: guestSelect,
        }),
      );
      return NextResponse.json({ guests: await guestsPayload(), guest });
    } catch (error) {
      console.error("[api/growth/lives] guest_av", error);
      return NextResponse.json({ error: "A/V impossible" }, { status: 500 });
    }
  }

  if (
    json.action === "guest_accept" ||
    json.action === "guest_refuse" ||
    json.action === "guest_kick"
  ) {
    if (!isHost) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const guestId = typeof json.guestId === "string" ? json.guestId : null;
    const userId = typeof json.userId === "string" ? json.userId : null;
    if (!guestId && !userId) {
      return NextResponse.json({ error: "Invité manquant" }, { status: 400 });
    }
    try {
      const row = await withDbRetry(() =>
        prisma.liveGuest.findFirst({
          where: {
            liveId: id,
            ...(guestId ? { id: guestId } : { userId: userId! }),
          },
          include: {
            user: { select: { id: true, name: true } },
          },
        }),
      );
      if (!row) {
        return NextResponse.json(
          { error: "Demande introuvable" },
          { status: 404 },
        );
      }

      if (json.action === "guest_accept") {
        if (row.status !== "PENDING") {
          return NextResponse.json(
            { error: "Cette demande n’est plus en attente" },
            { status: 400 },
          );
        }
        const onStage = await countOnStage(id);
        if (onStage >= LIVE_GUEST_MAX_ON_STAGE) {
          return NextResponse.json(
            { error: `Maximum ${LIVE_GUEST_MAX_ON_STAGE} invités sur scène` },
            { status: 400 },
          );
        }
        const promoted = await promoteGuestOnStage(row.id, id, {
          cameraOn: true,
        });
        void createAppNotice({
          userId: row.userId,
          title: "Vous êtes sur scène",
          body: promoted.hasFloor
            ? "Le diffuseur a accepté votre montée — caméra et micro activés."
            : "Sur scène — levez la main pour demander la parole.",
          href: `/live/${id}`,
        });
        return NextResponse.json({ guests: await guestsPayload() });
      }

      if (json.action === "guest_refuse") {
        await withDbRetry(() =>
          prisma.liveGuest.update({
            where: { id: row.id },
            data: {
              status: "REFUSED",
              decidedAt: new Date(),
              cameraOn: false,
              micOn: false,
              handRaised: false,
              hasFloor: false,
            },
          }),
        );
        void createAppNotice({
          userId: row.userId,
          title: "Demande refusée",
          body: "Le diffuseur n’a pas accepté votre montée au live.",
          href: `/live/${id}`,
        });
        return NextResponse.json({ guests: await guestsPayload() });
      }

      // guest_kick
      await withDbRetry(() =>
        prisma.liveGuest.update({
          where: { id: row.id },
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
      await reconcileSoloFloor(id);
      return NextResponse.json({ guests: await guestsPayload() });
    } catch (error) {
      console.error("[api/growth/lives] guest_host", error);
      return NextResponse.json(
        { error: "Action invité impossible" },
        { status: 500 },
      );
    }
  }

  if (json.action === "like") {
    if (isHost) {
      return NextResponse.json(
        { error: "Le diffuseur ne peut pas liker" },
        { status: 400 },
      );
    }
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    if (!allowLiveLike(session.user.id, id)) {
      return NextResponse.json(
        { error: "Trop de j’aime — ralentissez" },
        { status: 429 },
      );
    }
    try {
      const updated = await withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
          select: {
            likeCount: true,
            giftCents: true,
            startedAt: true,
            status: true,
          },
        }),
      );
      const chatTotal = await withDbRetry(() =>
        prisma.liveChatMessage.count({ where: { liveId: id } }),
      ).catch(() => 0);
      const guestsOnStage = await countOnStage(id).catch(() => 0);
      const engagement = computeLiveEngagement({
        startedAt: updated.startedAt,
        status: updated.status,
        likeCount: updated.likeCount,
        chatCount: chatTotal,
        giftCents: updated.giftCents,
        guestsOnStage,
      });
      return NextResponse.json({
        likeCount: updated.likeCount,
        engagement,
      });
    } catch (error) {
      console.error("[api/growth/lives] like", error);
      return NextResponse.json(
        { error: "J’aime impossible — migrate / redémarrez pnpm dev" },
        { status: 503 },
      );
    }
  }

  if (json.action === "chat") {
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const parsed = chatSchema.parse(json);
    const message = await withDbRetry(() =>
      prisma.liveChatMessage.create({
        data: {
          liveId: id,
          userId: session.user.id,
          body: parsed.body,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { id: true, name: true, image: true } },
        },
      }),
    );
    return NextResponse.json({ message });
  }

  if (json.action === "gift") {
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const parsed = giftSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Cadeau invalide" },
        { status: 400 },
      );
    }
    try {
      const result = await sendCreatorGift({
        fromUserId: session.user.id,
        toUserId: live.userId,
        kind: (parsed.data.kind as GiftKind | "CUSTOM" | undefined) ?? "CUSTOM",
        amountCents: parsed.data.amountCents,
        liveId: id,
        idempotencyKey: idempotencyFrom(req, parsed.data.idempotencyKey),
      });
      const amountCents =
        result.gift?.amountCents ?? parsed.data.amountCents ?? 0;
      const current = await prisma.creatorLive.findUnique({
        where: { id },
        select: { overlays: true },
      });
      const overlays = withGiftBurst(current?.overlays, amountCents);
      await prisma.creatorLive.update({
        where: { id },
        data: { overlays: overlays as Prisma.InputJsonValue },
      });
      return NextResponse.json({
        ...result,
        lastGiftBurst: readLastGiftBurst(overlays),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cadeau impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
