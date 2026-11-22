import { classifyUploadedMedia } from "@/lib/catalog-vision.server";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const url = body?.url?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "Média manquant" }, { status: 400 });
  }
  try {
    const read = await classifyUploadedMedia(url);
    if (!read) {
      return NextResponse.json({ error: "Média illisible" }, { status: 404 });
    }
    return NextResponse.json(read);
  } catch {
    return NextResponse.json({ error: "Lecture du produit impossible" }, { status: 500 });
  }
}
