import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { suggestMediaCleanup } from "@/lib/media-suggest.server";
import { takeRateLimit } from "@/lib/rate-limit";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { disabledAt: true },
    }),
  );
  if (user?.disabledAt) {
    return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
  }

  if (!takeRateLimit(`suggest:${session.user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Quota d'analyse atteint — réessayez plus tard" },
      { status: 429 },
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image manquante" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Analyse disponible sur les images" },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const suggestions = await suggestMediaCleanup(buffer);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analyse impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
