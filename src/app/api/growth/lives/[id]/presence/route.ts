import { NextResponse } from "next/server";

import {
    leaveLiveViewer,
    listLiveViewers,
    pingLiveViewer,
} from "@/lib/growth/live-viewers";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      select: { userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }
  const presence = await listLiveViewers(id);
  const isHost = session?.user.id === live.userId;
  return NextResponse.json({
    viewerCount: presence.viewerCount,
    qualifiedViewerCount: presence.qualifiedCount,
    ...(isHost ? { viewers: presence.viewers } : {}),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  const json = (await req.json().catch(() => ({}))) as {
    action?: string;
    peerKey?: string;
    displayName?: string;
  };

  const live = await withDbRetry(() =>
    prisma.creatorLive.findUnique({
      where: { id },
      select: { userId: true, status: true },
    }),
  );
  if (!live) {
    return NextResponse.json({ error: "Live introuvable" }, { status: 404 });
  }

  const peerKeyRaw =
    typeof json.peerKey === "string" ? json.peerKey.trim().slice(0, 80) : "";
  const peerKey = peerKeyRaw || (session?.user.id ? session.user.id : null);

  if (!peerKey) {
    return NextResponse.json(
      { error: "peerKey requis pour un viewer anonyme" },
      { status: 400 },
    );
  }

  const isHost = Boolean(session?.user.id && session.user.id === live.userId);

  if (json.action === "leave") {
    await leaveLiveViewer({ liveId: id, peerKey });
    return NextResponse.json({ ok: true });
  }

  if (live.status === "ENDED") {
    return NextResponse.json({ error: "Live terminé" }, { status: 400 });
  }

  const presence = await pingLiveViewer({
    liveId: id,
    peerKey,
    userId: session?.user.id ?? null,
    displayName:
      session?.user.name ??
      (typeof json.displayName === "string" && json.displayName.trim()
        ? json.displayName.trim()
        : "Viewer"),
    imageUrl: session?.user.image ?? null,
    isHost,
  });

  return NextResponse.json({
    viewerCount: presence?.viewerCount ?? 0,
    qualifiedViewerCount: presence?.qualifiedCount ?? 0,
    ...(isHost ? { viewers: presence?.viewers ?? [] } : {}),
  });
}
