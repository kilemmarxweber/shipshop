import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
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

    const filename = `${randomUUID()}.${extForMedia(file, kind)}`;
    const saved = await writeUploadBuffer(
      filename,
      Buffer.from(await file.arrayBuffer()),
    );

    return NextResponse.json({
      url: saved.url,
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
