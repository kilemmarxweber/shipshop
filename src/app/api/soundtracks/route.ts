import { NextResponse } from "next/server";
import {
  compressAudioBuffer,
  detectSoundtrackSource,
  detectVideoFile,
  AUDIO_INPUT_MAX_BYTES,
} from "@/lib/compress-audio.server";
import { getAppConfig } from "@/lib/content-source";
import { VIDEO_INPUT_MAX_BYTES } from "@/lib/media";
import { ensureDefaultSoundtracks } from "@/lib/ensure-soundtracks";
import {
  PRODUCT_CLIP_MOOD,
  SOUNDTRACK_START_MAX_MS,
} from "@/lib/montage";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { writeUploadBuffer } from "@/lib/upload-file.server";
import { randomUUID } from "crypto";

const catalogSelect = {
  id: true,
  title: true,
  artist: true,
  mood: true,
  durationMs: true,
  audioUrl: true,
} as const;

export async function GET() {
  const cfg = await getAppConfig();
  if (cfg.source === "sanity" && cfg.catalogTracks.length) {
    return NextResponse.json({ soundtracks: cfg.catalogTracks });
  }
  await ensureDefaultSoundtracks();
  const tracks = await withDbRetry(() =>
    prisma.soundtrack.findMany({
      where: {
        isActive: true,
        userId: null,
        mood: { not: PRODUCT_CLIP_MOOD },
      },
      orderBy: { title: "asc" },
      select: catalogSelect,
    }),
  );
  return NextResponse.json({ soundtracks: tracks });
}

/** Extrait 1 min uniquement — le fichier source n’est pas conservé. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }
    const fromVideo = detectVideoFile(file);
    const maxBytes = fromVideo ? VIDEO_INPUT_MAX_BYTES : AUDIO_INPUT_MAX_BYTES;
    if (file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json(
        {
          error: fromVideo
            ? "Vidéo trop lourde (max 100 Mo)"
            : "Fichier audio trop lourd (max 25 Mo)",
        },
        { status: 400 },
      );
    }
    if (!detectSoundtrackSource(file)) {
      return NextResponse.json(
        {
          error:
            "Importez une musique (MP3, M4A…) ou une vidéo (MP4, MOV…) — on garde seulement le son",
        },
        { status: 400 },
      );
    }

    const startRaw = Number(form.get("startMs") ?? 0);
    const startMs = Number.isFinite(startRaw)
      ? Math.min(SOUNDTRACK_START_MAX_MS, Math.max(0, Math.round(startRaw)))
      : 0;
    const titleFromForm = String(form.get("title") ?? "")
      .trim()
      .slice(0, 80);
    const titleFromName = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80);

    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressAudioBuffer(raw, { startMs });
    const filename = `${randomUUID()}.${compressed.ext}`;
    const saved = await writeUploadBuffer(filename, compressed.buffer);

    const soundtrack = await prisma.soundtrack.create({
      data: {
        title: titleFromForm || titleFromName || "Extrait",
        artist: session.user.name?.trim() || "Moi",
        mood: PRODUCT_CLIP_MOOD,
        durationMs: compressed.durationMs,
        audioUrl: saved.url,
        isActive: false,
        userId: null,
      },
      select: catalogSelect,
    });

    return NextResponse.json({ soundtrack });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Import impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
