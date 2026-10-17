import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { compressImageBuffer } from "@/lib/compress-image.server";
import { compressVideoBuffer } from "@/lib/compress-video.server";
import { extractVideoPosterJpeg } from "@/lib/video-poster.server";
import { IMAGE_STORED_MAX_BYTES, VIDEO_STORED_MAX_BYTES } from "@/lib/media";
import { enforceCatalogModeration } from "@/lib/moderation.server";
import {
  MEDIA_MAX_BYTES,
  detectMediaKind,
  extForMedia,
  uploadDirectoryError,
  writeUploadBuffer,
} from "@/lib/upload-file.server";

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

    if (file.size <= 0) {
      return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
    }
    if (file.size > MEDIA_MAX_BYTES) {
      return NextResponse.json(
        { error: "Impossible d'envoyer ce fichier" },
        { status: 400 },
      );
    }

    const kind = detectMediaKind(file);
    if (!kind) {
      return NextResponse.json(
        { error: "Formats acceptés : image ou vidéo" },
        { status: 400 },
      );
    }

    const raw = Buffer.from(await file.arrayBuffer());
    let stored: Buffer = raw;
    let ext = extForMedia(file, kind);
    const variantRaw = String(form.get("variant") ?? "product");
    const variant =
      variantRaw === "avatar" || variantRaw === "document"
        ? variantRaw
        : "product";
    if (kind === "image") {
      const precompressed = String(form.get("precompressed") ?? "") === "1";
      const compressed = await compressImageBuffer(raw, variant, {
        skipIfLight: precompressed,
        mimeHint: file.type,
      });
      stored = Buffer.from(compressed.buffer);
      ext = compressed.ext;
      if (stored.length > IMAGE_STORED_MAX_BYTES) {
        return NextResponse.json(
          { error: "Impossible d'envoyer ce fichier" },
          { status: 400 },
        );
      }
    } else if (kind === "video") {
      try {
        const compressed = await compressVideoBuffer(raw);
        stored = Buffer.from(compressed.buffer);
        ext = compressed.ext;
      } catch (error) {
        console.error("[upload] video compress failed:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer ce fichier";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (stored.length > VIDEO_STORED_MAX_BYTES) {
        return NextResponse.json(
          {
            error: `Vidéo trop lourde après compression (max ${Math.round(VIDEO_STORED_MAX_BYTES / (1024 * 1024))} Mo)`,
          },
          { status: 400 },
        );
      }
    }

    const verdict = await enforceCatalogModeration({
      userId: session.user.id,
      buffer: stored,
      kind,
      variant,
    });
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: verdict.error, code: verdict.code },
        { status: verdict.httpStatus },
      );
    }

    const id = randomUUID();
    const filename = `${id}.${ext}`;
    const saved = await writeUploadBuffer(filename, stored);

    let posterUrl: string | undefined;
    if (kind === "video") {
      try {
        const poster = await extractVideoPosterJpeg(stored);
        if (poster?.length) {
          const posterSaved = await writeUploadBuffer(`${id}.jpg`, poster);
          posterUrl = posterSaved.url;
        }
      } catch (error) {
        console.error("[upload] video poster failed:", error);
      }
    }

    return NextResponse.json({
      url: saved.url,
      posterUrl,
      kind,
      size: stored.length,
      name: file.name,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : uploadDirectoryError("uploads", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
