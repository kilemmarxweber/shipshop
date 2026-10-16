import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { compressImageBuffer } from "@/lib/compress-image.server";
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
      const compressed = await compressImageBuffer(raw, variant);
      stored = Buffer.from(compressed.buffer);
      ext = compressed.ext;
      if (stored.length > IMAGE_STORED_MAX_BYTES) {
        return NextResponse.json(
          { error: "Impossible d'envoyer ce fichier" },
          { status: 400 },
        );
      }
    } else if (stored.length > VIDEO_STORED_MAX_BYTES) {
      return NextResponse.json(
        { error: "Impossible d'envoyer ce fichier" },
        { status: 400 },
      );
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

    const filename = `${randomUUID()}.${ext}`;
    const saved = await writeUploadBuffer(filename, stored);

    return NextResponse.json({
      url: saved.url,
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
