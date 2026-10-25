import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getMyLiveGuest } from "@/lib/growth/live-guests";
import {
  isLiveSfuConfigured,
  mintLiveSfuToken,
} from "@/lib/growth/live-sfu";

/**
 * Token LiveKit (SFU) pour host / guest ON_STAGE / viewer.
 * GET|POST /api/growth/lives/:id/sfu-token
 */
async function issueToken(liveId: string) {
  if (!isLiveSfuConfigured()) {
    return NextResponse.json(
      { error: "SFU non configuré", sfu: false },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id: liveId },
      select: { id: true, userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  if (live.status === "ENDED") {
    return NextResponse.json({ error: "Live terminé" }, { status: 400 });
  }

  const isHost = live.userId === session.user.id;
  let canPublish = isHost;
  if (!canPublish) {
    const guest = await getMyLiveGuest(liveId, session.user.id);
    canPublish = guest?.status === "ON_STAGE";
  }

  try {
    const minted = await mintLiveSfuToken({
      liveId,
      identity: session.user.id,
      name: session.user.name,
      canPublish,
    });
    return NextResponse.json({
      ...minted,
      canPublish,
    });
  } catch (error) {
    console.error("[lives/sfu-token]", error);
    return NextResponse.json(
      { error: "Token SFU impossible" },
      { status: 503 },
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return issueToken(id);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return issueToken(id);
}
