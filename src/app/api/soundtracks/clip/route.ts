import { NextResponse } from "next/server";
import { compressAudioBuffer } from "@/lib/compress-audio.server";
import { PRODUCT_CLIP_MOOD } from "@/lib/montage";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { downloadArchiveWindow } from "@/lib/soundtrack-search.server";
import { writeUploadBuffer } from "@/lib/upload-file.server";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      identifier?: string;
      file?: string;
      startMs?: number;
      title?: string;
      artist?: string;
    };
    const startRaw = Number(body.startMs ?? 0);
    const startMs = Number.isFinite(startRaw)
      ? Math.max(0, Math.round(startRaw))
      : 0;
    const window = await downloadArchiveWindow(
      body.identifier ?? "",
      body.file ?? "",
      startMs,
    );
    const compressed = await compressAudioBuffer(window.buffer, {
      startMs: window.partial ? 0 : startMs,
    });
    const filename = `${randomUUID()}.${compressed.ext}`;
    const saved = await writeUploadBuffer(filename, compressed.buffer);
    const soundtrack = await prisma.soundtrack.create({
      data: {
        title: String(body.title ?? "Extrait").trim().slice(0, 80) || "Extrait",
        artist: String(body.artist ?? "Artiste").trim().slice(0, 60) || "Artiste",
        mood: PRODUCT_CLIP_MOOD,
        durationMs: compressed.durationMs,
        audioUrl: saved.url,
        isActive: false,
        userId: null,
      },
      select: {
        id: true,
        title: true,
        artist: true,
        mood: true,
        durationMs: true,
        audioUrl: true,
      },
    });
    return NextResponse.json({ soundtrack });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Extrait audio impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
