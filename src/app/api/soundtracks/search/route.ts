import { NextResponse } from "next/server";
import { searchOnlineAudio } from "@/lib/soundtrack-search.server";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const tracks = await searchOnlineAudio(q);
    return NextResponse.json({ tracks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recherche impossible";
    return NextResponse.json({ error: message, tracks: [] }, { status: 502 });
  }
}
