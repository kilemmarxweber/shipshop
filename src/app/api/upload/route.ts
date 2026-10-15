import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  MEDIA_MAX_BYTES,
  detectMediaKind,
  ensureUploadDirectory,
  extForMedia,
  uploadDirectoryError,
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
        { error: "Fichier trop lourd (max 10 Mo)" },
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

    const dir = await ensureUploadDirectory();
    const filename = `${randomUUID()}.${extForMedia(file, kind)}`;
    const abs = path.join(/*turbopackIgnore: true*/ dir, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(/*turbopackIgnore: true*/ abs, buf);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      kind,
      size: file.size,
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
