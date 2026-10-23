import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";
import { sendCreatorGift } from "@/lib/growth/gifts";
import type { GiftKind } from "@/lib/growth/constants";
import {
  LIVE_DEFAULT_PLANNED_MINUTES,
  LIVE_HEARTBEAT_STALE_MS,
  LIVE_PAUSE_TIMEOUT_MS,
  LIVE_PROLONG_MINUTES,
  liveEndMessage,
  livePauseMessage,
} from "@/lib/growth/live-session";
import {
  liveOverlaysSchema,
  parseLiveOverlays,
} from "@/lib/growth/live-overlays";

const chatSchema = z.object({
  body: z.string().min(1).max(180),
});

const giftSchema = z.object({
  kind: z.enum(["SMALL", "MEDIUM", "PREMIUM"]),
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
      return withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: {
            status: "ENDED",
            endedAt: new Date(),
            endReason: "pause_timeout",
            pauseReason: live.pauseReason,
          },
        }),
      );
    }
  }

  return live;
}

function publicLive<T extends Record<string, unknown>>(live: T) {
  const status = String(live.status ?? "");
  const pauseReason =
    typeof live.pauseReason === "string" ? live.pauseReason : null;
  const endReason =
    typeof live.endReason === "string" ? live.endReason : null;
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  if (live.status === "LIVE" || live.status === "PAUSED") {
    await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: { viewerPeak: { increment: 1 } },
      }),
    );
  }
  return NextResponse.json({
    live: publicLive({
      ...live,
      overlays: parseLiveOverlays(live.overlays),
      chats: [...live.chats].reverse(),
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
    reason?: string;
    body?: string;
    kind?: string;
  };

  const isHost = live.userId === session.user.id;

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
      const updated = await withDbRetry(() =>
        prisma.creatorLive.update({
          where: { id },
          data: {
            overlays: parsed.data,
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
            error:
              "Schéma overlays pas chargé — redémarrez `pnpm dev`",
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
    await withDbRetry(() =>
      prisma.creatorLive.update({
        where: { id },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          endReason: "host",
        },
      }),
    );
    return NextResponse.json({ ok: true });
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
          user: { select: { id: true, name: true } },
        },
      }),
    );
    return NextResponse.json({ message });
  }

  if (json.action === "gift") {
    if (live.status === "ENDED") {
      return NextResponse.json({ error: "Live terminé" }, { status: 400 });
    }
    const parsed = giftSchema.parse(json);
    try {
      const result = await sendCreatorGift({
        fromUserId: session.user.id,
        toUserId: live.userId,
        kind: parsed.kind as GiftKind,
        liveId: id,
      });
      return NextResponse.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cadeau impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
